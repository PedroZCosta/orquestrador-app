import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  EventoDoMotorDeChat,
  MotorDeChat,
  PerguntaAoMotorDeChat,
  ResultadoDaResposta,
} from "../../chat/MotorDeChat";
import { AdaptadorDeEventosDoChat } from "./AdaptadorDeEventosDoChat";
import { configuracoesDaSessaoDoChat, montarAmbienteDoChat, montarArgumentosDoChat } from "./ArgumentosDoChat";
import { linhaDeEntrada } from "./ArgumentosDoClaudeCode";
import { FachadaClaudeCodeCli, SaidaDoClaudeCode } from "./FachadaClaudeCodeCli";
import { prepararPastaDeArtefatos } from "./MotorClaudeCodeCli";
import { linhaDosPluginsCarregados, PluginsPorSessao } from "./SeletorDePlugins";

/** Dono dos processos do chat no registro de processos (não é um Orquestrador). */
export const DONO_DOS_PROCESSOS_DO_CHAT = "chat";

const MOTIVO_DO_CANCELAMENTO = "Cancelada.";

function descreverSaidaSemResultado(saida: SaidaDoClaudeCode): string {
  const detalhe = saida.erroPadrao.slice(0, 600);
  const codigo = saida.codigoDeSaida === null ? "" : ` (código ${saida.codigoDeSaida})`;
  return detalhe === ""
    ? `O Claude Code encerrou sem devolver resposta${codigo}.`
    : `O Claude Code encerrou sem devolver resposta${codigo}: ${detalhe}`;
}

/**
 * `MotorDeChat` sobre o Claude Code em modo headless: um processo `claude -p`
 * por pergunta, com o login da assinatura do usuário.
 *
 * As instruções e a configuração da sessão (`--settings`, sem a atribuição
 * Co-authored-by) vão em arquivos temporários próprios da pergunta, apagados
 * ao final — no mesmo padrão dos turnos dos Orquestradores. Com o sinal
 * abortado, a fachada encerra a árvore do processo e a resposta resolve como
 * cancelada.
 */
export class MotorDeChatClaudeCodeCli implements MotorDeChat {
  /**
   * `plugins`: escolhe, antes de cada pergunta, os plugins e skills do usuário
   * que a sessão carrega. Sem ele, carrega tudo o que o usuário configurou.
   */
  constructor(
    private readonly fachada: FachadaClaudeCodeCli,
    private readonly ambienteBase: NodeJS.ProcessEnv = process.env,
    private readonly plugins: PluginsPorSessao | null = null,
  ) {}

  async responder(
    pergunta: PerguntaAoMotorDeChat,
    aoObservar: (evento: EventoDoMotorDeChat) => void,
    sinal: AbortSignal,
  ): Promise<ResultadoDaResposta> {
    if (sinal.aborted) {
      return { sucesso: false, motivo: MOTIVO_DO_CANCELAMENTO, uso: null };
    }
    const pastaTemporaria = path.join(tmpdir(), "orquestrador-chat", randomUUID());
    const arquivos = {
      instrucoes: path.join(pastaTemporaria, "instrucoes.txt"),
      configuracoes: path.join(pastaTemporaria, "configuracoes.json"),
    };

    try {
      await mkdir(pastaTemporaria, { recursive: true });
      await writeFile(arquivos.instrucoes, pergunta.instrucoes, "utf8");
      const plugins = this.plugins === null ? null : await this.plugins.escolher(pergunta.sessaoId, pergunta.textoDoUsuario);
      await writeFile(arquivos.configuracoes, JSON.stringify(configuracoesDaSessaoDoChat(plugins?.settings ?? null)), "utf8");
      const linhaDosPlugins = plugins === null ? null : linhaDosPluginsCarregados(plugins.escolha, false);
      const textoDaEntrada = linhaDosPlugins === null ? pergunta.mensagem : `${linhaDosPlugins}\n\n${pergunta.mensagem}`;
      await mkdir(pergunta.pastaDaSessao, { recursive: true });
      // Criada antes do processo e pelo caminho real, para a regra de gravação casar.
      const pastaDeArtefatos = await prepararPastaDeArtefatos(pergunta.pastaDeArtefatos);

      const imagens = await Promise.all(
        pergunta.imagens.map(async (imagem) => ({
          tipoDeMidia: imagem.tipoDeMidia,
          base64: (await readFile(imagem.caminho)).toString("base64"),
        })),
      );

      const adaptador = new AdaptadorDeEventosDoChat(pergunta.alteracoesAutorizadas);
      // A escolha só é anunciada quando o processo já falou: qualquer evento
      // do motor marca a sessão do chat como iniciada, e ela só existe a partir daí.
      let escolhaAnunciada = plugins === null;
      const inicio = Date.now();
      const saida = await this.fachada.executar(
        {
          argumentos: montarArgumentosDoChat({ ...pergunta, pastaDeArtefatos }, arquivos, linhaDosPlugins !== null),
          pasta: pergunta.pastaDaSessao,
          ambiente: montarAmbienteDoChat(this.ambienteBase, pergunta.esforco),
          entrada: linhaDeEntrada(textoDaEntrada, imagens),
          dono: { orquestradorId: DONO_DOS_PROCESSOS_DO_CHAT, sessaoId: pergunta.sessaoId },
        },
        (mensagem) => {
          if (!escolhaAnunciada && plugins !== null) {
            escolhaAnunciada = true;
            aoObservar({ tipo: "plugins_escolhidos", escolha: plugins.registro });
          }
          for (const evento of adaptador.traduzir(mensagem)) {
            aoObservar(evento);
          }
        },
        sinal,
      );

      const resultado = adaptador.resultado;
      if (sinal.aborted) {
        return { sucesso: false, motivo: MOTIVO_DO_CANCELAMENTO, uso: resultado?.uso ?? null };
      }
      if (resultado === null) {
        return { sucesso: false, motivo: descreverSaidaSemResultado(saida), uso: null };
      }
      // O tempo que interessa à tela é o de relógio, do início ao fim do processo.
      return resultado.uso === null
        ? resultado
        : { ...resultado, uso: { ...resultado.uso, duracaoMs: Date.now() - inicio } };
    } catch (erro) {
      if (sinal.aborted) {
        return { sucesso: false, motivo: MOTIVO_DO_CANCELAMENTO, uso: null };
      }
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      return { sucesso: false, motivo: `Não foi possível consultar o Claude Code: ${detalhe}`, uso: null };
    } finally {
      await rm(pastaTemporaria, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
