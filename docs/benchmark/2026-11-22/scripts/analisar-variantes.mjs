// Lê execucoes-variantes/<variante>/r*-T*-C.json e grava resumo-variantes.json: por variante e por tarefa, média,
// desvio padrão, mínimo e máximo das execuções válidas (só conta quem passou no checador) de US$, índice de custo,
// tokens por tipo, primeira chamada do Orquestrador e do executor, chamadas ao modelo e de ferramenta, subagentes e
// tempo de parede; soma das médias das 4 tarefas; diferença (valor e %) contra a linha de base C, B e A, calculada
// das execuções em execucoes/ com o mesmo código (a soma de US$, índice e tempo confere com resumo.json).
// Uso: node analisar-variantes.mjs   (imprime também uma tabela em Markdown)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(aqui, '..');
const PASTA_VARIANTES = path.join(RAIZ, 'execucoes-variantes');
const TAREFAS = ['T1', 'T2', 'T3', 'T4'];
const ORDEM = ['v1', 'v2', 'v3', 'v5', 'vr'];
const { analisarTranscricoes } = await import(pathToFileURL(path.join(aqui, 'harness.mjs')).href);

const soma = (o) => (o ? (o.entrada ?? 0) + (o.criacaoDeCache ?? 0) + (o.leituraDeCache ?? 0) + (o.saida ?? 0) : undefined);
function transcricoesDe(r) {
  if (r.transcricoes && !r.transcricoes.erro) return r.transcricoes;
  try { return analisarTranscricoes(r.sessoes ?? []); } catch { return null; }
}
const METRICAS = {
  usd: (r) => r.resumo?.usd,
  indiceDeCusto: (r) => r.resumo?.indiceDeCusto,
  tokensTotais: (r) => soma(r.resumo?.tokens),
  entrada: (r) => r.resumo?.tokens.entrada,
  criacaoDeCache: (r) => r.resumo?.tokens.criacaoDeCache,
  leituraDeCache: (r) => r.resumo?.tokens.leituraDeCache,
  saida: (r) => r.resumo?.tokens.saida,
  usdPrincipal: (r) => r.resumo?.usdPrincipal,
  usdSubagentes: (r) => r.resumo?.usdSubagentes,
  primeiraChamadaDoOrquestrador: (r) => r._tr?.orquestrador?.primeiraChamada?.total,
  primeiraChamadaDoExecutor: (r) => r._tr?.executores?.[0]?.primeiraChamada?.total,
  chamadasAoModelo: (r) => r.resumo?.mensagensDoModelo,
  chamadasDeFerramenta: (r) => (r._tr?.principal ? r._tr.principal.chamadasDeFerramenta + r._tr.subagentes.chamadasDeFerramenta : undefined),
  chamadasDeFerramentaDoOrquestrador: (r) => r._tr?.principal?.chamadasDeFerramenta,
  quantidadeDeSubagentes: (r) => r.resumo?.quantidadeDeSubagentes,
  tempoDeParedeS: (r) => r.tempoDeParedeS,
};
const NA_SOMA = Object.keys(METRICAS);

function estatistica(valores) {
  const v = valores.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (v.length === 0) return null;
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  const dp = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (v.length - 1)) : 0;
  return { n: v.length, media, desvioPadrao: dp, min: Math.min(...v), max: Math.max(...v) };
}

function carregar(pasta, filtro) {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter((f) => filtro.test(f)).map((f) => {
    const r = JSON.parse(readFileSync(path.join(pasta, f), 'utf8'));
    r._tr = transcricoesDe(r);
    return r;
  });
}

function agregar(execucoes) {
  const porTarefa = {};
  const somaDasMedias = Object.fromEntries(NA_SOMA.map((k) => [k, 0]));
  somaDasMedias.tarefasComMedia = 0;
  for (const t of TAREFAS) {
    const todas = execucoes.filter((r) => r.tarefa === t);
    const ok = todas.filter((r) => r.sucesso === true);
    const est = Object.fromEntries(Object.entries(METRICAS).map(([k, f]) => [k, estatistica(ok.map(f))]));
    porTarefa[t] = {
      execucoes: todas.length, validas: ok.length,
      falhas: todas.filter((r) => r.sucesso !== true).map((r) => ({ id: r.id, motivo: r.checagem?.motivo ?? r.erroDoHarness ?? 'desconhecido', usd: r.resumo?.usd ?? null })),
      errosDeApiRepetidos: todas.flatMap((r) => (r.tentativasAnteriores ?? []).map((x) => ({ id: r.id, tentativa: x.tentativa, tipo: x.tipo, texto: String(x.texto ?? '').slice(0, 200) }))),
      cargaAlta: todas.filter((r) => r.tempoComCargaAlta).map((r) => ({ id: r.id, ...r.cargaAlta })),
      gastoUsdTodas: todas.reduce((a, r) => a + (r.resumo?.usd ?? 0), 0),
      validasApenas: est,
    };
    for (const k of NA_SOMA) if (est[k]) somaDasMedias[k] += est[k].media;
    if (est.usd) somaDasMedias.tarefasComMedia += 1;
  }
  // Primeira chamada não se soma entre tarefas: média das médias das tarefas que têm valor.
  const mediaEntreTarefas = {};
  for (const k of ['primeiraChamadaDoOrquestrador', 'primeiraChamadaDoExecutor']) {
    const v = TAREFAS.map((t) => porTarefa[t].validasApenas[k]?.media).filter((x) => typeof x === 'number');
    mediaEntreTarefas[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  return {
    execucoes: execucoes.length, validas: execucoes.filter((r) => r.sucesso === true).length,
    gastoUsdTodas: execucoes.reduce((a, r) => a + (r.resumo?.usd ?? 0), 0),
    somaDasMedias, mediaEntreTarefas, porTarefa,
  };
}

const diferenca = (a, b) => (typeof a === 'number' && typeof b === 'number' ? { valor: a - b, pct: b !== 0 ? ((a - b) / b) * 100 : null } : null);
function comparar(alvo, ref, chaves) {
  return Object.fromEntries(chaves.map((k) => [k, diferenca(alvo?.[k], ref?.[k])]));
}

// Linha de base (A, B, C) recalculada das execuções originais, com o mesmo código.
const base = {};
const execBase = carregar(path.join(RAIZ, 'execucoes'), /^r\d+-T\d-[ABC]\.json$/);
for (const c of ['A', 'B', 'C']) base[c] = agregar(execBase.filter((r) => r.config === c));
const resumoOriginal = JSON.parse(readFileSync(path.join(RAIZ, 'resumo.json'), 'utf8'));
const conferencia = Object.fromEntries(['A', 'B', 'C'].map((c) => [c, Object.fromEntries(['usd', 'indiceDeCusto', 'tempoDeParedeS'].map((k) => [k, { resumoJson: resumoOriginal.somaDasMedias[c][k], recalculado: base[c].somaDasMedias[k] }]))]));

const variantes = {};
const nomes = existsSync(PASTA_VARIANTES) ? readdirSync(PASTA_VARIANTES).filter((d) => !d.startsWith('.')) : [];
nomes.sort((a, b) => (ORDEM.indexOf(a) + 1 || 99) - (ORDEM.indexOf(b) + 1 || 99) || a.localeCompare(b));
for (const v of nomes) {
  const ex = carregar(path.join(PASTA_VARIANTES, v), /^r\d+-T\d-C\.json$/);
  if (ex.length === 0) continue;
  const ag = agregar(ex);
  ag.concluida = existsSync(path.join(PASTA_VARIANTES, v, 'FIM')) ? readFileSync(path.join(PASTA_VARIANTES, v, 'FIM'), 'utf8').trim() : 'em andamento ou interrompida';
  ag.contraCBase = comparar(ag.somaDasMedias, base.C.somaDasMedias, NA_SOMA);
  ag.contraB = comparar(ag.somaDasMedias, base.B.somaDasMedias, NA_SOMA);
  ag.contraA = comparar(ag.somaDasMedias, base.A.somaDasMedias, NA_SOMA);
  ag.primeiraChamadaContraCBase = comparar(ag.mediaEntreTarefas, base.C.mediaEntreTarefas, ['primeiraChamadaDoOrquestrador', 'primeiraChamadaDoExecutor']);
  for (const t of TAREFAS) {
    const m = (x) => Object.fromEntries(NA_SOMA.map((k) => [k, x.porTarefa[t].validasApenas[k]?.media]));
    ag.porTarefa[t].contraCBase = comparar(m(ag), m(base.C), NA_SOMA);
    ag.porTarefa[t].contraB = comparar(m(ag), m(base.B), ['usd', 'indiceDeCusto', 'tokensTotais', 'tempoDeParedeS']);
    ag.porTarefa[t].contraA = comparar(m(ag), m(base.A), ['usd', 'indiceDeCusto', 'tokensTotais', 'tempoDeParedeS']);
  }
  variantes[v] = ag;
}

const limpar = (o) => JSON.parse(JSON.stringify(o, (k, x) => (k === '_tr' ? undefined : x)));
const resumo = {
  geradoEm: new Date().toISOString(),
  observacao: 'Só execuções que passaram no checador entram nas médias (validasApenas e somaDasMedias). somaDasMedias soma as médias das 4 tarefas (tarefa sem execução válida fica fora e reduz tarefasComMedia). Diferenças: variante menos referência; pct relativo à referência. Linha de base recalculada de execucoes/ (config C = app 45b1b81 sem variante, Sonnet 5.5). Tokens totais = entrada + criação de cache + leitura de cache + saída. Primeira chamada = tokens de entrada (entrada + criação + leitura de cache) da primeira resposta do Orquestrador e do primeiro executor. Chamadas ao modelo = mensagens do modelo medidas pelo app; chamadas de ferramenta = blocos tool_use nas transcrições (Orquestrador + subagentes). US$ = equivalente de API (ver DECISOES.md).',
  conferenciaDaLinhaDeBase: conferencia,
  linhaDeBase: limpar(base),
  variantes: limpar(variantes),
};
writeFileSync(path.join(RAIZ, 'resumo-variantes.json'), `${JSON.stringify(resumo, null, 1)}\n`);

const f2 = (x, d = 3) => (typeof x === 'number' ? x.toFixed(d) : '-');
const pct = (d) => (d?.pct === null || d?.pct === undefined ? '-' : `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%`);
const k = (x) => (typeof x === 'number' ? Math.round(x).toLocaleString('pt-BR') : '-');
console.log(`resumo-variantes.json: ${Object.keys(variantes).length} variante(s)`);
console.log('| Variante | US$ | Índice | Tokens totais | 1a chamada orq. | 1a chamada exec. | Chamadas ao modelo | Ferramentas | Subagentes | Tempo (s) | Válidas | vs C base (US$) | vs B (US$) | vs A (US$) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const linha = (nome, a, cmp) => console.log(`| ${nome} | ${f2(a.somaDasMedias.usd, 4)} | ${k(a.somaDasMedias.indiceDeCusto)} | ${k(a.somaDasMedias.tokensTotais)} | ${k(a.mediaEntreTarefas.primeiraChamadaDoOrquestrador)} | ${k(a.mediaEntreTarefas.primeiraChamadaDoExecutor)} | ${f2(a.somaDasMedias.chamadasAoModelo, 1)} | ${f2(a.somaDasMedias.chamadasDeFerramenta, 1)} | ${f2(a.somaDasMedias.quantidadeDeSubagentes, 2)} | ${f2(a.somaDasMedias.tempoDeParedeS, 1)} | ${a.validas}/${a.execucoes} | ${cmp ? pct(cmp.c.usd) : '-'} | ${cmp ? pct(cmp.b.usd) : '-'} | ${cmp ? pct(cmp.a.usd) : '-'} |`);
for (const c of ['A', 'B', 'C']) linha(`${c} (base)`, base[c], null);
for (const [v, a] of Object.entries(variantes)) linha(v, a, { c: a.contraCBase, b: a.contraB, a: a.contraA });
