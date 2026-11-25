/**
 * Escolhe, antes de cada turno, quais plugins e skills a sessão carrega.
 *
 * Achados (docs + sondas no CLI 2.1.322, evento system/init):
 * - Plugins: `--settings '{"enabledPlugins":{"plugin@marketplace":false}}'` tira o
 *   plugin e as skills dele; o `--settings` fica acima dos arquivos do usuário e
 *   do projeto (https://code.claude.com/docs/en/settings#settings-precedence).
 *   Os sincronizados do claude.ai usam a chave `plugin@synced`.
 * - Skills que não são de plugin TÊM controle por skill: `skillOverrides`
 *   (`{"nome":"off"}`) vale para as do usuário, as embutidas e as sincronizadas
 *   (`anthropic-skills:docx` ou só `docx`); não vale para skills de plugin
 *   (https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings).
 * - `Skill(nome)` em `--disallowedTools` só bloqueia o uso: a skill continua
 *   listada no init. `--disable-slash-commands` zera todas as skills, mas os
 *   plugins (e os hooks deles) continuam carregados.
 */
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";

import type { PluginsDoTurno } from "../../orquestracao/EventoDeOrquestracao";
import type { SettingsDosPlugins } from "./ArgumentosDoClaudeCode";
import type { Catalogo, SkillDoCatalogo } from "./CatalogoDePlugins";
import type { FachadaClaudeCodeCli } from "./FachadaClaudeCodeCli";
import { ehObjeto, numero, objeto, texto } from "./MedicaoDasTranscricoes";

export type OrigemDaEscolha = "citado" | "modelo" | "anterior" | "nenhum";

export interface ConsumoDaSelecao {
  custoUsd: number;
  tokensDeEntrada: number;
  tokensDeSaida: number;
  duracaoMs: number;
}

export interface EscolhaDePlugins {
  /** Chaves `plugin@marketplace` a ligar; os demais plugins do catálogo ficam desligados. */
  plugins: string[];
  /** Nomes das skills avulsas (usuário, sincronizadas, embutidas) a ligar; as demais do catálogo ficam desligadas. */
  skillsAvulsas: string[];
  /** Verdadeiro quando alguma skill avulsa foi escolhida. */
  skillsAvulsasLigadas: boolean;
  motivo: string;
  origem: OrigemDaEscolha;
  /** Só na origem `modelo`: o que a chamada ao Haiku gastou. */
  consumo?: ConsumoDaSelecao;
}

export interface SaidaDoSeletor {
  codigoDeSaida: number | null;
  /** Mensagens JSON que o CLI imprimiu (com `--output-format json`, só o `result`). */
  mensagens: unknown[];
  erroPadrao: string;
}

/** Roda o CLI com estes argumentos e o texto no stdin. Injetado para testar sem rede. */
export type ExecutorDoSeletor = (argumentos: readonly string[], entrada: string, sinal: AbortSignal) => Promise<SaidaDoSeletor>;

export interface FonteDoCatalogo {
  ler(): Promise<Catalogo>;
}

export const TEMPO_LIMITE_PADRAO_MS = 8_000;
const LIMITE_DO_PEDIDO = 4_000;
const LIMITE_DO_MOTIVO = 200;

/** Nomes que são palavras comuns: só contam como citação com `/` antes ou com o prefixo do plugin. */
const PALAVRAS_COMUNS = new Set([
  "run", "loop", "debug", "verify", "batch", "design", "docs", "learn", "morning", "schedule", "doctor",
  "simplify", "review", "github",
]);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * O trecho de `--settings` que aplica a escolha: liga os plugins escolhidos,
 * desliga os outros do catálogo e esconde as skills avulsas não escolhidas.
 * Nunca manda `"on"`: uma skill que o usuário desligou continua desligada.
 */
export function settingsDaEscolha(catalogo: Catalogo, escolha: Pick<EscolhaDePlugins, "plugins" | "skillsAvulsas">): {
  enabledPlugins: Record<string, boolean>;
  skillOverrides: Record<string, "off">;
} {
  const enabledPlugins: Record<string, boolean> = {};
  for (const plugin of catalogo.plugins) {
    enabledPlugins[plugin.chave] = escolha.plugins.includes(plugin.chave);
  }
  const skillOverrides: Record<string, "off"> = {};
  for (const skill of catalogo.skillsAvulsas) {
    if (!escolha.skillsAvulsas.includes(skill.nome)) {
      skillOverrides[skill.nome] = "off";
    }
  }
  return { enabledPlugins, skillOverrides };
}

// ---------------------------------------------------------------------------
// Citação direta
// ---------------------------------------------------------------------------

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** O nome aparece no pedido como palavra inteira (com `/` de comando ou não), sem diferenciar maiúsculas. */
function aparece(pedido: string, nome: string, exigeBarra: boolean): boolean {
  const antes = exigeBarra ? "(?:^|[^\\w:/-])/" : "(?:^|[^\\w:-])/?";
  return new RegExp(`${antes}${escapar(nome)}(?![\\w-])`, "i").test(pedido);
}

function citadoPeloNomeCurto(pedido: string, nome: string): boolean {
  const comum = nome.length < 3 || PALAVRAS_COMUNS.has(nome.toLowerCase());
  return aparece(pedido, nome, comum);
}

function nomeCurto(skill: SkillDoCatalogo): string {
  return skill.nome.split(":").pop() ?? skill.nome;
}

/** Plugins e skills avulsas citados pelo nome no pedido. */
export function citadosNoPedido(pedido: string, catalogo: Catalogo): { plugins: string[]; skillsAvulsas: string[] } {
  const plugins = catalogo.plugins
    .filter(
      (plugin) =>
        citadoPeloNomeCurto(pedido, plugin.nome) ||
        // `plugin:qualquer-coisa` (skill ou comando do plugin).
        new RegExp(`(?:^|[^\\w-])/?${escapar(plugin.nome)}:[\\w-]`, "i").test(pedido) ||
        plugin.skills.some((skill) => citadoPeloNomeCurto(pedido, nomeCurto(skill))),
    )
    .map((plugin) => plugin.chave);
  const skillsAvulsas = catalogo.skillsAvulsas
    .filter(
      (skill) =>
        (skill.nome.includes(":") && aparece(pedido, skill.nome, false)) || citadoPeloNomeCurto(pedido, nomeCurto(skill)),
    )
    .map((skill) => skill.nome);
  return { plugins, skillsAvulsas };
}

// ---------------------------------------------------------------------------
// Chamada ao modelo
// ---------------------------------------------------------------------------

export const PROMPT_DO_SELETOR = [
  "Você escolhe quais skills carregar para um pedido feito a um agente de programação.",
  'Responda só com JSON, sem texto fora dele: {"skills": ["nome"], "motivo": "frase curta"}.',
  "Escolha uma skill só quando ela claramente ajuda a cumprir o pedido; na dúvida, deixe de fora.",
  "Lista vazia é uma resposta válida. Use exatamente os nomes da lista.",
].join("\n");

/** Linhas `- nome: descrição` do catálogo; plugin sem skill entra pelo próprio nome. */
export function montarEntradaDoSeletor(pedido: string, catalogo: Catalogo): string {
  const linhas: string[] = [];
  for (const plugin of catalogo.plugins) {
    if (plugin.skills.length === 0) {
      linhas.push(`- ${plugin.nome}: ${plugin.descricao}`);
    }
    for (const skill of plugin.skills) {
      linhas.push(`- ${skill.nome}: ${skill.descricao}`);
    }
  }
  for (const skill of catalogo.skillsAvulsas) {
    linhas.push(`- ${skill.nome}: ${skill.descricao}`);
  }
  return `Skills disponíveis:\n${linhas.join("\n")}\n\nPedido:\n<<<\n${pedido.slice(0, LIMITE_DO_PEDIDO)}\n>>>`;
}

/** Argumentos da chamada barata: sem ferramentas, skills, MCP, hooks nem plugins. */
export function argumentosDoSeletor(catalogo: Catalogo, modelo: string): string[] {
  const settings = {
    ...settingsDaEscolha(catalogo, { plugins: [], skillsAvulsas: [] }),
    syncClaudeAiPlugins: false,
    syncClaudeAiSkills: false,
    disableBundledSkills: true,
    disableAllHooks: true,
  };
  return [
    "-p",
    "--model",
    modelo,
    "--output-format",
    "json",
    "--max-turns",
    "1",
    "--tools",
    "",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--system-prompt",
    PROMPT_DO_SELETOR,
    "--settings",
    JSON.stringify(settings),
  ];
}

function textoDoResultado(mensagens: readonly unknown[]): { texto: string; consumo: ConsumoDaSelecao } | null {
  const resultado = mensagens.filter(ehObjeto).find((mensagem) => mensagem["type"] === "result");
  if (resultado === undefined || resultado["is_error"] === true || typeof resultado["result"] !== "string") {
    return null;
  }
  const uso = objeto(resultado, "usage");
  return {
    texto: resultado["result"],
    consumo: {
      custoUsd: numero(resultado, "total_cost_usd"),
      tokensDeEntrada:
        numero(uso, "input_tokens") + numero(uso, "cache_creation_input_tokens") + numero(uso, "cache_read_input_tokens"),
      tokensDeSaida: numero(uso, "output_tokens"),
      duracaoMs: numero(resultado, "duration_ms"),
    },
  };
}

/**
 * Lê o JSON que o modelo devolveu e traduz os nomes para plugins e skills do
 * catálogo. Nome que não existe é ignorado. Nulo se a resposta não for o JSON pedido.
 */
export function lerRespostaDoModelo(
  resposta: string,
  catalogo: Catalogo,
): { plugins: string[]; skillsAvulsas: string[]; motivo: string } | null {
  const inicio = resposta.indexOf("{");
  const fim = resposta.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) {
    return null;
  }
  let valor: unknown;
  try {
    valor = JSON.parse(resposta.slice(inicio, fim + 1));
  } catch {
    return null;
  }
  if (!ehObjeto(valor) || !Array.isArray(valor["skills"])) {
    return null;
  }

  const destinos = new Map<string, { plugin: string } | { skill: string }>();
  for (const plugin of catalogo.plugins) {
    destinos.set(plugin.nome.toLowerCase(), { plugin: plugin.chave });
    destinos.set(plugin.chave.toLowerCase(), { plugin: plugin.chave });
    for (const skill of plugin.skills) {
      destinos.set(skill.nome.toLowerCase(), { plugin: plugin.chave });
    }
  }
  for (const skill of catalogo.skillsAvulsas) {
    destinos.set(skill.nome.toLowerCase(), { skill: skill.nome });
    if (!destinos.has(nomeCurto(skill).toLowerCase())) {
      destinos.set(nomeCurto(skill).toLowerCase(), { skill: skill.nome });
    }
  }

  const plugins = new Set<string>();
  const skillsAvulsas = new Set<string>();
  for (const nome of valor["skills"]) {
    if (typeof nome !== "string") {
      continue;
    }
    const destino = destinos.get(nome.trim().replace(/^\//, "").toLowerCase());
    if (destino !== undefined && "plugin" in destino) {
      plugins.add(destino.plugin);
    } else if (destino !== undefined) {
      skillsAvulsas.add(destino.skill);
    }
  }
  const motivo = texto(valor, "motivo").replace(/\s+/g, " ").trim().slice(0, LIMITE_DO_MOTIVO);
  return { plugins: [...plugins], skillsAvulsas: [...skillsAvulsas], motivo };
}

// ---------------------------------------------------------------------------
// Seletor
// ---------------------------------------------------------------------------

/** Abaixo disto, sem citação, a mensagem não traz tarefa nova o bastante para chamar o modelo. */
const TAMANHO_MINIMO_DE_TAREFA = 40;
/** Começos de mensagem que só dão andamento ao que já está em curso (a aprovação do plano vem do app). */
const COMECO_DE_CONTINUACAO = /^(?:plano aprovado\.|continue\b|continua\b|prossiga\b|ok\b|sim\b)/i;

/**
 * Mensagem que só dá andamento ("Plano aprovado.", "continue", "ok", "sim") ou
 * curta demais para trazer tarefa nova: com escolha anterior na sessão, o
 * modelo não é chamado e a escolha se repete.
 */
export function ehMensagemDeContinuacao(pedido: string): boolean {
  const limpo = pedido.trim();
  return limpo.length < TAMANHO_MINIMO_DE_TAREFA || COMECO_DE_CONTINUACAO.test(limpo);
}

/** A escolha anterior só com o que ainda existe no catálogo. */
function aindaNoCatalogo(anterior: EscolhaDePlugins, catalogo: Catalogo | null): { plugins: string[]; skillsAvulsas: string[] } {
  if (catalogo === null) {
    return { plugins: anterior.plugins, skillsAvulsas: anterior.skillsAvulsas };
  }
  return {
    plugins: anterior.plugins.filter((chave) => catalogo.plugins.some((p) => p.chave === chave)),
    skillsAvulsas: anterior.skillsAvulsas.filter((nome) => catalogo.skillsAvulsas.some((s) => s.nome === nome)),
  };
}

/**
 * Soma a escolha nova à anterior da sessão: o que já foi carregado nunca sai
 * (a skill segue disponível depois de "Plano aprovado." e o `--settings` não
 * muda a cada turno, o que invalidaria o cache do prompt). Origem, motivo e
 * consumo são os do turno; o motivo cita o que veio de turnos anteriores.
 */
function acumular(anterior: EscolhaDePlugins | null, catalogo: Catalogo, nova: EscolhaDePlugins): EscolhaDePlugins {
  if (anterior === null) {
    return nova;
  }
  const mantidas = aindaNoCatalogo(anterior, catalogo);
  const nomesMantidos = nomesCarregados(mantidas);
  if (nomesMantidos.length === 0) {
    return nova;
  }
  const plugins = [...new Set([...mantidas.plugins, ...nova.plugins])];
  const skillsAvulsas = [...new Set([...mantidas.skillsAvulsas, ...nova.skillsAvulsas])];
  const novidades = nomesCarregados(nova).filter((nome) => !nomesMantidos.includes(nome));
  const motivo = `${nova.motivo}; ${novidades.length === 0 ? "nada novo, " : ""}mantidas da sessão: ${nomesMantidos.join(", ")}`;
  const somada = escolha(plugins, skillsAvulsas, motivo, nova.origem);
  return nova.consumo === undefined ? somada : { ...somada, consumo: nova.consumo };
}

function escolha(
  plugins: readonly string[],
  skillsAvulsas: readonly string[],
  motivo: string,
  origem: OrigemDaEscolha,
): EscolhaDePlugins {
  return {
    plugins: [...plugins],
    skillsAvulsas: [...skillsAvulsas],
    skillsAvulsasLigadas: skillsAvulsas.length > 0,
    motivo,
    origem,
  };
}

export interface OpcoesDoSeletor {
  catalogo: FonteDoCatalogo;
  executar: ExecutorDoSeletor;
  /** Padrão 8 s. */
  tempoLimiteMs?: number;
  /** Padrão `haiku`. */
  modelo?: string;
}

export class SeletorDePlugins {
  private readonly tempoLimiteMs: number;
  private readonly modelo: string;

  constructor(private readonly opcoes: OpcoesDoSeletor) {
    this.tempoLimiteMs = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
    this.modelo = opcoes.modelo ?? "haiku";
  }

  /**
   * Citado pelo nome entra direto, sem modelo; senão o Haiku escolhe. A escolha
   * é cumulativa na sessão: soma-se à anterior, sem tirar nada. Mensagem de
   * continuação (`ehMensagemDeContinuacao`) com anterior, falha ou tempo
   * esgotado repetem a escolha do turno anterior (ou nenhuma).
   */
  async selecionar(pedido: string, anterior: EscolhaDePlugins | null = null): Promise<EscolhaDePlugins> {
    let catalogo: Catalogo;
    try {
      catalogo = await this.opcoes.catalogo.ler();
    } catch (erro) {
      return this.repetir(anterior, null, `catálogo ilegível (${erro instanceof Error ? erro.message : String(erro)})`);
    }
    if (catalogo.plugins.length === 0 && catalogo.skillsAvulsas.length === 0) {
      return escolha([], [], "não há plugin nem skill no catálogo", "nenhum");
    }

    const citados = citadosNoPedido(pedido, catalogo);
    if (citados.plugins.length > 0 || citados.skillsAvulsas.length > 0) {
      const nomes = [...citados.plugins.map((chave) => chave.split("@")[0]), ...citados.skillsAvulsas];
      return acumular(
        anterior,
        catalogo,
        escolha(citados.plugins, citados.skillsAvulsas, `citado no pedido: ${nomes.join(", ")}`, "citado"),
      );
    }
    if (pedido.trim() === "") {
      return this.repetir(anterior, catalogo, "pedido sem texto");
    }
    if (anterior !== null && ehMensagemDeContinuacao(pedido)) {
      return this.repetir(anterior, catalogo, "mensagem sem tarefa nova");
    }

    try {
      const saida = await this.chamarModelo(pedido, catalogo);
      const resultado = textoDoResultado(saida.mensagens);
      if (resultado === null) {
        const detalhe = saida.erroPadrao.split("\n")[0]?.slice(0, 200) ?? "";
        throw new Error(`o CLI saiu com código ${saida.codigoDeSaida} sem resultado${detalhe === "" ? "" : `: ${detalhe}`}`);
      }
      const lida = lerRespostaDoModelo(resultado.texto, catalogo);
      if (lida === null) {
        throw new Error("a resposta do modelo não é o JSON pedido");
      }
      const motivo = lida.motivo === "" ? "escolha do modelo" : lida.motivo;
      return acumular(anterior, catalogo, {
        ...escolha(lida.plugins, lida.skillsAvulsas, motivo, "modelo"),
        consumo: resultado.consumo,
      });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.warn(`[seletor-de-plugins] ${motivo}`);
      return this.repetir(anterior, catalogo, motivo);
    }
  }

  private async chamarModelo(pedido: string, catalogo: Catalogo): Promise<SaidaDoSeletor> {
    const controle = new AbortController();
    let temporizador: NodeJS.Timeout | undefined;
    const limite = new Promise<never>((_, rejeitar) => {
      temporizador = setTimeout(() => {
        controle.abort();
        rejeitar(new Error(`tempo limite de ${this.tempoLimiteMs} ms esgotado`));
      }, this.tempoLimiteMs);
    });
    try {
      return await Promise.race([
        this.opcoes.executar(argumentosDoSeletor(catalogo, this.modelo), montarEntradaDoSeletor(pedido, catalogo), controle.signal),
        limite,
      ]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  /** A escolha anterior, só com o que ainda existe no catálogo; sem anterior, nenhuma. */
  private repetir(anterior: EscolhaDePlugins | null, catalogo: Catalogo | null, falha: string): EscolhaDePlugins {
    if (anterior === null) {
      return escolha([], [], `${falha}; sem escolha anterior, nada ligado`, "nenhum");
    }
    const mantidas = aindaNoCatalogo(anterior, catalogo);
    return escolha(mantidas.plugins, mantidas.skillsAvulsas, `${falha}; mantida a escolha do turno anterior`, "anterior");
  }
}

// ---------------------------------------------------------------------------
// Escolha por sessão, usada pelos motores
// ---------------------------------------------------------------------------

/** Nomes do que foi carregado, como o agente os reconhece: o plugin pelo nome, a skill avulsa pelo nome. */
function nomesCarregados(escolha: Pick<EscolhaDePlugins, "plugins" | "skillsAvulsas">): string[] {
  return [...escolha.plugins.map((chave) => chave.split("@")[0] ?? chave), ...escolha.skillsAvulsas];
}

/**
 * Linha que vai na mensagem do turno quando algo foi carregado; nula sem nada.
 * Vai na mensagem (stdin), e não no prompt de sistema: o motivo muda a cada
 * pedido, e um prompt de sistema diferente a cada turno perderia o cache de
 * toda a conversa retomada.
 */
export function linhaDosPluginsCarregados(escolha: EscolhaDePlugins, comSubagentes: boolean): string | null {
  const nomes = nomesCarregados(escolha);
  if (nomes.length === 0) {
    return null;
  }
  const delegar = comSubagentes ? "; ao delegar, diga no brief qual skill o subagente deve usar" : "";
  return `<skills-do-pedido>Carregadas para este pedido: ${nomes.join(", ")} (${escolha.motivo}). Quando servirem, use-as direto, sem pedir licença nem perguntar${delegar}.</skills-do-pedido>`;
}

export interface PluginsEscolhidos {
  escolha: EscolhaDePlugins;
  /** Chaves a mesclar no `--settings`; nulo se o catálogo não pôde ser lido (fica tudo como o usuário configurou). */
  settings: SettingsDosPlugins | null;
  /** O que vai para o evento `plugins_escolhidos`. */
  registro: PluginsDoTurno;
}

/**
 * Guarda a última escolha de cada sessão (em memória: reiniciar o app zera) e
 * a passa ao seletor como anterior; como a escolha é cumulativa, ela só cresce
 * dentro da sessão. Nunca rejeita: se o seletor falhar, repete
 * a anterior ou não liga nada, e o turno segue.
 */
export class PluginsPorSessao {
  private readonly anteriores = new Map<string, EscolhaDePlugins>();

  constructor(
    private readonly seletor: Pick<SeletorDePlugins, "selecionar">,
    private readonly catalogo: FonteDoCatalogo,
    private readonly agora: () => number = Date.now,
  ) {}

  async escolher(sessaoId: string, pedido: string): Promise<PluginsEscolhidos> {
    const inicio = this.agora();
    const anterior = this.anteriores.get(sessaoId) ?? null;
    let escolhida: EscolhaDePlugins;
    try {
      escolhida = await this.seletor.selecionar(pedido, anterior);
    } catch (erro) {
      const falha = erro instanceof Error ? erro.message : String(erro);
      console.warn(`[seletor-de-plugins] ${falha}`);
      escolhida =
        anterior === null
          ? escolha([], [], `${falha}; sem escolha anterior, nada ligado`, "nenhum")
          : escolha(anterior.plugins, anterior.skillsAvulsas, `${falha}; mantida a escolha do turno anterior`, "anterior");
    }
    this.anteriores.set(sessaoId, escolhida);

    let settings: SettingsDosPlugins | null = null;
    try {
      settings = settingsDaEscolha(await this.catalogo.ler(), escolhida);
    } catch (erro) {
      console.warn(`[seletor-de-plugins] catálogo ilegível, plugins como o usuário configurou: ${erro instanceof Error ? erro.message : String(erro)}`);
    }

    return {
      escolha: escolhida,
      settings,
      registro: {
        plugins: escolhida.plugins,
        skills: escolhida.skillsAvulsas,
        motivo: escolhida.motivo,
        origem: escolhida.origem,
        custoUsd: escolhida.consumo?.custoUsd ?? 0,
        tokensDeEntrada: escolhida.consumo?.tokensDeEntrada ?? 0,
        tokensDeSaida: escolhida.consumo?.tokensDeSaida ?? 0,
        duracaoMs: Math.max(0, this.agora() - inicio),
      },
    };
  }
}

/**
 * Executor real: roda o CLI pela `FachadaClaudeCodeCli` (mesmo binário de
 * `CLAUDE_CODE_BIN`, mesmas novas tentativas e registro de processos), numa
 * pasta temporária para não ler o `.claude/` do projeto.
 */
export function executorPelaFachada(
  fachada: FachadaClaudeCodeCli,
  opcoes: { pasta?: string; ambiente?: NodeJS.ProcessEnv; orquestradorId?: string } = {},
): ExecutorDoSeletor {
  return async (argumentos, entrada, sinal) => {
    const mensagens: unknown[] = [];
    const saida = await fachada.executar(
      {
        argumentos,
        pasta: opcoes.pasta ?? tmpdir(),
        ambiente: opcoes.ambiente ?? process.env,
        entrada,
        dono: { orquestradorId: opcoes.orquestradorId ?? "seletor-de-plugins", sessaoId: randomUUID() },
      },
      (mensagem) => mensagens.push(mensagem),
      sinal,
    );
    return { ...saida, mensagens };
  };
}
