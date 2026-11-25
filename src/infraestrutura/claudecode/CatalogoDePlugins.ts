import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { ehObjeto, Objeto, objeto } from "./MedicaoDasTranscricoes";
import { pastaDoClaude } from "./TranscricoesDoClaudeCode";

/**
 * Catálogo do que o Claude Code carrega em toda sessão: os plugins instalados
 * e ligados (com as skills de cada um) e as skills avulsas, que não vêm de
 * plugin (do usuário, sincronizadas do claude.ai e embutidas no CLI). Guarda só
 * nome e descrição curta, para o `SeletorDePlugins` escolher o que ligar por turno.
 */

export type OrigemDaSkill = "plugin" | "usuario" | "sincronizada" | "embutida";

export interface SkillDoCatalogo {
  /** Como aparece na sessão: `plugin:skill` nas de plugin; `anthropic-skills:nome` nas sincronizadas. */
  nome: string;
  descricao: string;
  origem: OrigemDaSkill;
  /** Chave `plugin@marketplace` do plugin dono; nulo nas avulsas. */
  plugin: string | null;
}

export interface PluginDoCatalogo {
  /** Chave de `enabledPlugins`: `plugin@marketplace` (os sincronizados do claude.ai usam `plugin@synced`). */
  chave: string;
  nome: string;
  descricao: string;
  skills: SkillDoCatalogo[];
}

export interface Catalogo {
  plugins: PluginDoCatalogo[];
  /** Skills que não são de plugin; ligadas e desligadas uma a uma por `skillOverrides`. */
  skillsAvulsas: SkillDoCatalogo[];
}

export const LIMITE_DA_DESCRICAO = 200;
/** Prefixo com que o Claude Code mostra as skills sincronizadas do claude.ai. */
export const PREFIXO_DAS_SINCRONIZADAS = "anthropic-skills";
const MARKETPLACE_DOS_SINCRONIZADOS = "synced";

/**
 * Skills embutidas no CLI que `skillOverrides` desliga uma a uma (conferido na
 * versão 2.1.322). As que não estão aqui ficam como o Claude Code decidir.
 */
export const SKILLS_EMBUTIDAS: readonly SkillDoCatalogo[] = [
  ["dataviz", "Create any chart, graph, plot, dashboard or data visualization (HTML, SVG, matplotlib, plotly, d3...)."],
  ["code-review", "Review the current diff, a PR or a path for correctness bugs."],
  ["simplify", "Review changed code for reuse, simplification and efficiency cleanups, then apply the fixes."],
  ["claude-api", "Reference for the Claude API and Anthropic SDK: model ids, pricing, streaming, tool use, caching, agents."],
  ["update-config", "Configure the Claude Code harness via settings.json: hooks, permissions, env vars."],
  ["fewer-permission-prompts", "Scan transcripts and add an allowlist of read-only commands to the project settings."],
  ["loop", "Run a prompt or slash command on a recurring interval."],
  ["schedule", "Create, update, list or run scheduled cloud agents on a cron schedule."],
  ["workflow-authoring", "Reference for writing a Workflow tool script."],
  ["run", "Launch and drive this project's app to see a change working (run, start, screenshot)."],
].map(([nome, descricao]): SkillDoCatalogo => ({ nome: nome ?? "", descricao: descricao ?? "", origem: "embutida", plugin: null }));

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

export function encurtar(texto: string, limite = LIMITE_DA_DESCRICAO): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite - 1).trimEnd()}…`;
}

function semAspas(valor: string): string {
  const v = valor.trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Lê `name` e `description` do frontmatter de um SKILL.md. Cobre o YAML que
 * aparece nas skills: valor na mesma linha (com ou sem aspas), bloco `>`/`|`
 * e continuação em linhas recuadas.
 */
export function lerFrontmatter(conteudo: string): { nome: string; descricao: string } {
  const linhas = conteudo.replace(/^﻿/, "").split(/\r?\n/);
  if (linhas[0]?.trim() !== "---") {
    return { nome: "", descricao: "" };
  }
  const campos: Record<string, string> = {};
  let atual: string | null = null;
  for (const linha of linhas.slice(1)) {
    if (linha.trim() === "---") {
      break;
    }
    const chave = /^([A-Za-z_-]+):\s*(.*)$/.exec(linha);
    if (chave !== null) {
      atual = chave[1] ?? "";
      const valor = chave[2] ?? "";
      campos[atual] = /^[>|][+-]?$/.test(valor.trim()) ? "" : semAspas(valor);
      continue;
    }
    if (atual !== null && /^\s+\S/.test(linha)) {
      campos[atual] = `${campos[atual] ?? ""} ${linha.trim()}`;
    }
  }
  return { nome: (campos["name"] ?? "").trim(), descricao: encurtar(campos["description"] ?? "") };
}

// ---------------------------------------------------------------------------
// Leitura do disco
// ---------------------------------------------------------------------------

async function lerJson(caminho: string): Promise<Objeto | null> {
  try {
    const valor: unknown = JSON.parse(await readFile(caminho, "utf8"));
    return ehObjeto(valor) ? valor : null;
  } catch {
    return null;
  }
}

async function subpastas(pasta: string): Promise<string[]> {
  try {
    const entradas = await readdir(pasta, { withFileTypes: true });
    return entradas
      .filter((entrada) => entrada.isDirectory() && !entrada.name.startsWith("."))
      .map((entrada) => entrada.name)
      .sort();
  } catch {
    return [];
  }
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

/** Skills de uma pasta no formato `<pasta>/<skill>/SKILL.md`. */
async function skillsDaPasta(
  pasta: string,
  montar: (nome: string, descricao: string) => SkillDoCatalogo,
): Promise<SkillDoCatalogo[]> {
  const skills: SkillDoCatalogo[] = [];
  for (const subpasta of await subpastas(pasta)) {
    let conteudo: string;
    try {
      conteudo = await readFile(path.join(pasta, subpasta, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    const frontmatter = lerFrontmatter(conteudo);
    skills.push(montar(frontmatter.nome || subpasta, frontmatter.descricao));
  }
  return skills;
}

/** Pastas de skills do plugin: `skills/` e as que o `plugin.json` declarar em `skills`. */
function pastasDeSkillsDoPlugin(raiz: string, manifesto: Objeto | null): string[] {
  const declaradas = manifesto?.["skills"];
  const lista = typeof declaradas === "string" ? [declaradas] : Array.isArray(declaradas) ? declaradas : [];
  const pastas = [path.join(raiz, "skills")];
  for (const item of lista) {
    if (typeof item === "string" && item.trim() !== "") {
      const pasta = path.resolve(raiz, item);
      if (!pastas.includes(pasta)) {
        pastas.push(pasta);
      }
    }
  }
  return pastas;
}

async function lerPlugin(chave: string, raiz: string): Promise<PluginDoCatalogo> {
  const manifesto = await lerJson(path.join(raiz, ".claude-plugin", "plugin.json"));
  const nomeDaChave = chave.split("@")[0] ?? chave;
  const nome = typeof manifesto?.["name"] === "string" && manifesto["name"] !== "" ? manifesto["name"] : nomeDaChave;
  const descricao = typeof manifesto?.["description"] === "string" ? encurtar(manifesto["description"]) : "";
  const skills: SkillDoCatalogo[] = [];
  for (const pasta of pastasDeSkillsDoPlugin(raiz, manifesto)) {
    skills.push(
      ...(await skillsDaPasta(pasta, (nomeDaSkill, descricaoDaSkill) => ({
        nome: `${nome}:${nomeDaSkill}`,
        descricao: descricaoDaSkill,
        origem: "plugin",
        plugin: chave,
      }))),
    );
  }
  return { chave, nome, descricao, skills };
}

/**
 * Qual instalação do plugin vale: a de escopo `user`; senão a atualizada por
 * último. Se a pasta registrada sumiu, nula.
 */
async function pastaInstalada(entradas: unknown): Promise<string | null> {
  if (!Array.isArray(entradas)) {
    return null;
  }
  const validas = entradas.filter(ehObjeto).filter((entrada) => typeof entrada["installPath"] === "string");
  const ordenadas = [...validas].sort((a, b) => {
    const escopo = Number(b["scope"] === "user") - Number(a["scope"] === "user");
    return escopo !== 0 ? escopo : String(b["lastUpdated"] ?? "").localeCompare(String(a["lastUpdated"] ?? ""));
  });
  for (const entrada of ordenadas) {
    const pasta = entrada["installPath"] as string;
    if (await existe(pasta)) {
      return pasta;
    }
  }
  return null;
}

export interface OpcoesDoCatalogo {
  /** Pasta de configuração do Claude Code; padrão `~/.claude` (ou `CLAUDE_CONFIG_DIR`). */
  pastaDoClaude?: string;
  /** Skills embutidas no CLI conhecidas; padrão `SKILLS_EMBUTIDAS`. */
  skillsEmbutidas?: readonly SkillDoCatalogo[];
}

/**
 * Lê o catálogo do disco. Guarda em memória e só relê quando muda o `mtime` de
 * `plugins/installed_plugins.json`, de `settings.json` ou da pasta `skills/`.
 */
export class CatalogoDePlugins {
  private readonly pasta: string;
  private readonly embutidas: readonly SkillDoCatalogo[];
  private cache: { assinatura: string; catalogo: Promise<Catalogo> } | null = null;

  constructor(opcoes: OpcoesDoCatalogo = {}) {
    this.pasta = opcoes.pastaDoClaude ?? pastaDoClaude();
    this.embutidas = opcoes.skillsEmbutidas ?? SKILLS_EMBUTIDAS;
  }

  async ler(): Promise<Catalogo> {
    const assinatura = await this.assinatura();
    if (this.cache === null || this.cache.assinatura !== assinatura) {
      const catalogo = this.lerDoDisco();
      this.cache = { assinatura, catalogo };
      // Uma leitura que falhou não fica guardada.
      catalogo.catch(() => {
        if (this.cache?.catalogo === catalogo) {
          this.cache = null;
        }
      });
    }
    return this.cache.catalogo;
  }

  private async assinatura(): Promise<string> {
    const arquivos = [
      path.join(this.pasta, "plugins", "installed_plugins.json"),
      path.join(this.pasta, "settings.json"),
      path.join(this.pasta, "skills"),
    ];
    const marcas = await Promise.all(
      arquivos.map(async (arquivo) => {
        try {
          return String((await stat(arquivo)).mtimeMs);
        } catch {
          return "ausente";
        }
      }),
    );
    return marcas.join("|");
  }

  private async lerDoDisco(): Promise<Catalogo> {
    const configuracao = (await lerJson(path.join(this.pasta, "settings.json"))) ?? {};
    const ligados = objeto(configuracao, "enabledPlugins");
    const sobreposicoes = objeto(configuracao, "skillOverrides");
    // Nas sincronizadas o `skillOverrides` aceita o nome com ou sem o prefixo.
    const visivel = (skill: SkillDoCatalogo): boolean =>
      sobreposicoes[skill.nome] !== "off" && sobreposicoes[skill.nome.split(":").pop() ?? ""] !== "off";

    const plugins: PluginDoCatalogo[] = [];
    const instalados = objeto((await lerJson(path.join(this.pasta, "plugins", "installed_plugins.json"))) ?? {}, "plugins");
    for (const [chave, entradas] of Object.entries(instalados).sort(([a], [b]) => a.localeCompare(b))) {
      if (ligados[chave] !== true) {
        continue;
      }
      const pasta = await pastaInstalada(entradas);
      if (pasta !== null) {
        plugins.push(await lerPlugin(chave, pasta));
      }
    }

    // Plugins sincronizados do claude.ai: `plugins/synced/<lote>/<plugin>~gN/`.
    if (configuracao["syncClaudeAiPlugins"] !== false) {
      const raiz = path.join(this.pasta, "plugins", "synced");
      for (const lote of await subpastas(raiz)) {
        for (const pastaDoPlugin of await subpastas(path.join(raiz, lote))) {
          const pasta = path.join(raiz, lote, pastaDoPlugin);
          if (!(await existe(path.join(pasta, ".claude-plugin", "plugin.json")))) {
            continue;
          }
          const nome = pastaDoPlugin.replace(/~g\d+$/, "");
          const chave = `${nome}@${MARKETPLACE_DOS_SINCRONIZADOS}`;
          if (ligados[chave] !== false && !plugins.some((plugin) => plugin.chave === chave)) {
            plugins.push(await lerPlugin(chave, pasta));
          }
        }
      }
    }

    const pastaDeSkills = path.join(this.pasta, "skills");
    const doUsuario = await skillsDaPasta(pastaDeSkills, (nome, descricao) => ({
      nome,
      descricao,
      origem: "usuario",
      plugin: null,
    }));

    const sincronizadas: SkillDoCatalogo[] = [];
    if (configuracao["syncClaudeAiSkills"] !== false) {
      for (const lote of await subpastas(path.join(pastaDeSkills, "synced"))) {
        sincronizadas.push(
          ...(await skillsDaPasta(path.join(pastaDeSkills, "synced", lote), (nome, descricao) => ({
            nome: `${PREFIXO_DAS_SINCRONIZADAS}:${nome}`,
            descricao,
            origem: "sincronizada",
            plugin: null,
          }))),
        );
      }
    }

    const embutidas = configuracao["disableBundledSkills"] === true ? [] : this.embutidas;
    const skillsAvulsas = [...doUsuario, ...sincronizadas, ...embutidas].filter(visivel);
    return { plugins, skillsAvulsas };
  }
}
