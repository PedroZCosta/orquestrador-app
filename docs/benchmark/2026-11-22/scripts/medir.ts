// Mede uma execução pelas transcrições do Claude Code com o MESMO código do app
// (versão 45b1b81, exportada em /tmp/bench-gosub/app-45b1b81), sem alterá-lo.
// Uso: tsx medir.ts '<json>' com { pasta, sessoes: [...] }.
// Saída (stdout): JSON com a medição do app (medirTranscricoes) e o custo em US$
// por modelo, separando a criação de cache de 5 min e de 1 h quando a linha traz
// `usage.cache_creation`.
import { lerTranscricoes, localizarTranscricoes } from "/tmp/bench-gosub/app-45b1b81/src/infraestrutura/claudecode/TranscricoesDoClaudeCode";
import {
  ehCompactacao,
  ehObjeto,
  indiceDeCusto,
  medirTranscricoes,
  MODELO_SINTETICO,
} from "/tmp/bench-gosub/app-45b1b81/src/infraestrutura/claudecode/MedicaoDasTranscricoes";

type Preco = { entrada: number; cache5m: number; cache1h: number; leitura: number; saida: number };

// US$ por milhão de tokens. Fonte: https://platform.claude.com/docs/en/about-claude/pricing (lida em 2026-11-23).
const PRECOS: Record<string, Preco> = {
  "claude-opus-5-5": { entrada: 4, cache5m: 5, cache1h: 8, leitura: 0.2, saida: 20 },
  "claude-opus-5": { entrada: 5, cache5m: 6.25, cache1h: 10, leitura: 0.5, saida: 25 },
  "claude-opus-4-8": { entrada: 5, cache5m: 6.25, cache1h: 10, leitura: 0.5, saida: 25 },
  "claude-opus-4-7": { entrada: 5, cache5m: 6.25, cache1h: 10, leitura: 0.5, saida: 25 },
  "claude-opus-4-6": { entrada: 5, cache5m: 6.25, cache1h: 10, leitura: 0.5, saida: 25 },
  "claude-sonnet-5-5": { entrada: 2, cache5m: 2.5, cache1h: 4, leitura: 0.1, saida: 10 },
  "claude-sonnet-5": { entrada: 2, cache5m: 2.5, cache1h: 4, leitura: 0.2, saida: 10 },
  "claude-sonnet-4-6": { entrada: 3, cache5m: 3.75, cache1h: 6, leitura: 0.3, saida: 15 },
  "claude-haiku-5-5": { entrada: 0.1, cache5m: 0.125, cache1h: 0.2, leitura: 0.01, saida: 0.5 },
  "claude-haiku-5-5@longo": { entrada: 0.5, cache5m: 0.625, cache1h: 1, leitura: 0.05, saida: 2.5 },
  "claude-haiku-4-5": { entrada: 1, cache5m: 1.25, cache1h: 2, leitura: 0.1, saida: 5 },
};

function precoDe(modelo: string): { chave: string; preco: Preco } | null {
  const base = modelo.replace(/\[.*\]$/, "").replace(/-\d{8}$/, "");
  const chaves = Object.keys(PRECOS).filter((k) => !k.includes("@")).sort((a, b) => b.length - a.length);
  const chave = chaves.find((k) => base === k) ?? chaves.find((k) => base.startsWith(`${k}-`)) ?? null;
  return chave === null ? null : { chave, preco: PRECOS[chave] };
}

const n = (o: Record<string, unknown>, c: string): number => (typeof o[c] === "number" ? (o[c] as number) : 0);

async function principal(): Promise<void> {
  const { pasta, sessoes } = JSON.parse(process.argv[2] ?? "{}") as { pasta: string; sessoes: string[] };
  const arquivos = await localizarTranscricoes(pasta, sessoes);
  const transcricoes = await lerTranscricoes(arquivos);
  const medicao = medirTranscricoes(transcricoes);

  // Custo em US$: uma vez por message.id (o maior de cada campo), como o app.
  type Msg = { modelo: string; papel: string; entrada: number; c5: number; c1: number; cTotal: number; leitura: number; saida: number };
  const msgs = new Map<string, Msg>();
  let semId = 0;
  for (const t of transcricoes) {
    const compactacao = t.papel === "subagente" && ehCompactacao(t.agenteId);
    for (const linha of t.linhas) {
      if (!ehObjeto(linha) || linha["type"] !== "assistant") continue;
      const m = ehObjeto(linha["message"]) ? (linha["message"] as Record<string, unknown>) : {};
      const modelo = typeof m["model"] === "string" ? (m["model"] as string) : "desconhecido";
      if (modelo === MODELO_SINTETICO) continue;
      const u = ehObjeto(m["usage"]) ? (m["usage"] as Record<string, unknown>) : {};
      const cc = ehObjeto(u["cache_creation"]) ? (u["cache_creation"] as Record<string, unknown>) : null;
      const cTotal = n(u, "cache_creation_input_tokens");
      const c1 = cc ? n(cc, "ephemeral_1h_input_tokens") : 0;
      const c5 = cc ? n(cc, "ephemeral_5m_input_tokens") : cTotal;
      const papel = compactacao ? "principal" : t.papel === "subagente" || linha["isSidechain"] === true ? "subagente" : "principal";
      const novo: Msg = { modelo, papel, entrada: n(u, "input_tokens"), c5, c1, cTotal, leitura: n(u, "cache_read_input_tokens"), saida: n(u, "output_tokens") };
      const id = typeof m["id"] === "string" && m["id"] !== "" ? (m["id"] as string) : `sem-id-${semId++}`;
      const ant = msgs.get(id);
      msgs.set(id, ant === undefined ? novo : {
        ...ant,
        entrada: Math.max(ant.entrada, novo.entrada), c5: Math.max(ant.c5, novo.c5), c1: Math.max(ant.c1, novo.c1),
        cTotal: Math.max(ant.cTotal, novo.cTotal), leitura: Math.max(ant.leitura, novo.leitura), saida: Math.max(ant.saida, novo.saida),
      });
    }
  }
  const porModelo: Record<string, { usd: number; usdPrincipal: number; usdSubagentes: number; tokens: Record<string, number>; tabela: string | null }> = {};
  const semPreco = new Set<string>();
  let usd = 0, usdPrincipal = 0, usdSubagentes = 0;
  for (const msg of msgs.values()) {
    const achado = precoDe(msg.modelo);
    let p = achado?.preco ?? null;
    let tabela = achado?.chave ?? null;
    if (achado?.chave === "claude-haiku-5-5" && msg.entrada + msg.cTotal + msg.leitura > 100_000) {
      p = PRECOS["claude-haiku-5-5@longo"];
      tabela = "claude-haiku-5-5@longo";
    }
    const reg = (porModelo[msg.modelo] ??= { usd: 0, usdPrincipal: 0, usdSubagentes: 0, tokens: { entrada: 0, cache5m: 0, cache1h: 0, leituraDeCache: 0, saida: 0 }, tabela });
    reg.tokens.entrada += msg.entrada; reg.tokens.cache5m += msg.c5; reg.tokens.cache1h += msg.c1;
    reg.tokens.leituraDeCache += msg.leitura; reg.tokens.saida += msg.saida;
    if (p === null) { semPreco.add(msg.modelo); continue; }
    const v = (msg.entrada * p.entrada + msg.c5 * p.cache5m + msg.c1 * p.cache1h + msg.leitura * p.leitura + msg.saida * p.saida) / 1e6;
    reg.usd += v; usd += v;
    if (msg.papel === "principal") { reg.usdPrincipal += v; usdPrincipal += v; } else { reg.usdSubagentes += v; usdSubagentes += v; }
  }

  process.stdout.write(JSON.stringify({
    arquivos: arquivos.map((a) => ({ caminho: a.caminho, papel: a.papel, tipoDeAgente: a.tipoDeAgente })),
    medicaoDoApp: { ...medicao, indiceDeCusto: indiceDeCusto(medicao.total), indicePrincipal: indiceDeCusto(medicao.principal), indiceSubagentes: indiceDeCusto(medicao.subagentes) },
    custo: { usd, usdPrincipal, usdSubagentes, porModelo, modelosSemPreco: [...semPreco] },
  }));
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
