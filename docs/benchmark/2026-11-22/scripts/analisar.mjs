// Lê execucoes/*.json e grava resumo.json: por tarefa e configuração, média,
// desvio padrão (amostral), mínimo e máximo das execuções bem-sucedidas;
// contagem de falhas com motivo; soma das médias das 4 tarefas por configuração
// e as razões C/A, C/B e B/A. Uso: node analisar.mjs [pastaDasExecucoes]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(aqui, '..');
const pasta = path.resolve(process.argv[2] ?? path.join(RAIZ, 'execucoes'));
const TAREFAS = ['T1', 'T2', 'T3', 'T4'];
const CONFIGS = ['A', 'B', 'C'];

const METRICAS = {
  usd: (r) => r.resumo?.usd,
  indiceDeCusto: (r) => r.resumo?.indiceDeCusto,
  tempoDeParedeS: (r) => r.tempoDeParedeS,
  entrada: (r) => r.resumo?.tokens.entrada,
  criacaoDeCache: (r) => r.resumo?.tokens.criacaoDeCache,
  leituraDeCache: (r) => r.resumo?.tokens.leituraDeCache,
  saida: (r) => r.resumo?.tokens.saida,
  usdPrincipal: (r) => r.resumo?.usdPrincipal,
  usdSubagentes: (r) => r.resumo?.usdSubagentes,
  quantidadeDeSubagentes: (r) => r.resumo?.quantidadeDeSubagentes,
  turnosDoUsuario: (r) => r.resumo?.turnosDoUsuario,
};

function estatistica(valores) {
  const v = valores.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (v.length === 0) return null;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const dp = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (v.length - 1)) : 0;
  return { n: v.length, media, desvioPadrao: dp, min: Math.min(...v), max: Math.max(...v) };
}

const execucoes = readdirSync(pasta)
  .filter((f) => /^r\d+-T\d-[ABC]\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(path.join(pasta, f), 'utf8')));

const porTarefa = {};
const somaDasMedias = {};
for (const c of CONFIGS) somaDasMedias[c] = { usd: 0, indiceDeCusto: 0, tempoDeParedeS: 0, tarefasComMedia: 0 };

for (const t of TAREFAS) {
  porTarefa[t] = {};
  for (const c of CONFIGS) {
    const todas = execucoes.filter((r) => r.tarefa === t && r.config === c);
    const ok = todas.filter((r) => r.sucesso === true);
    const falhas = todas.filter((r) => r.sucesso !== true);
    const est = {};
    for (const [nome, f] of Object.entries(METRICAS)) est[nome] = estatistica(ok.map(f));
    porTarefa[t][c] = {
      execucoes: todas.length,
      sucessos: ok.length,
      falhas: falhas.length,
      motivosDasFalhas: falhas.map((r) => ({ id: r.id, motivo: r.checagem?.motivo ?? r.erroDoHarness ?? 'desconhecido' })),
      modelos: [...new Set(todas.flatMap((r) => r.resumo?.modelos ?? []))],
      sucessosApenas: est,
      // Custo gasto também nas falhas (o gasto existe mesmo quando a tarefa falha).
      todasAsExecucoes: { usd: estatistica(todas.map(METRICAS.usd)), indiceDeCusto: estatistica(todas.map(METRICAS.indiceDeCusto)), tempoDeParedeS: estatistica(todas.map(METRICAS.tempoDeParedeS)) },
      tentativasRepetidasPorErroDeApi: todas.reduce((a, r) => a + (r.tentativasAnteriores?.length ?? 0), 0),
    };
    for (const k of ['usd', 'indiceDeCusto', 'tempoDeParedeS']) {
      if (est[k]) somaDasMedias[c][k] += est[k].media;
    }
    if (est.usd) somaDasMedias[c].tarefasComMedia += 1;
  }
}

const razao = (a, b, k) => (somaDasMedias[b][k] > 0 ? somaDasMedias[a][k] / somaDasMedias[b][k] : null);
const razoes = {};
for (const k of ['usd', 'indiceDeCusto', 'tempoDeParedeS']) {
  razoes[k] = { 'C/A': razao('C', 'A', k), 'C/B': razao('C', 'B', k), 'B/A': razao('B', 'A', k) };
}

const resumo = {
  geradoEm: new Date().toISOString(),
  pasta,
  totalDeExecucoes: execucoes.length,
  sucessos: execucoes.filter((r) => r.sucesso === true).length,
  falhasPorConfig: Object.fromEntries(CONFIGS.map((c) => [c, execucoes.filter((r) => r.config === c && r.sucesso !== true).length])),
  observacao: 'Estatísticas em "sucessosApenas" só usam execuções bem-sucedidas. somaDasMedias soma as médias das 4 tarefas (uma tarefa sem sucesso fica fora e reduz tarefasComMedia). US$ = equivalente de API pelos preços oficiais (ver DECISOES.md).',
  somaDasMedias,
  razoesDaSomaDasMedias: razoes,
  porTarefa,
};
writeFileSync(path.join(RAIZ, 'resumo.json'), `${JSON.stringify(resumo, null, 1)}\n`);
const f = (x) => (x === null ? '-' : x.toFixed(3));
console.log(`resumo.json: ${execucoes.length} execuções, ${resumo.sucessos} sucessos`);
for (const c of CONFIGS) console.log(`${c}: soma das médias US$ ${f(somaDasMedias[c].usd)} | índice ${Math.round(somaDasMedias[c].indiceDeCusto)} | ${Math.round(somaDasMedias[c].tempoDeParedeS)} s | tarefas com média ${somaDasMedias[c].tarefasComMedia}`);
console.log(`razões US$: C/A ${f(razoes.usd['C/A'])} C/B ${f(razoes.usd['C/B'])} B/A ${f(razoes.usd['B/A'])}`);
