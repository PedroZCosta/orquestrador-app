// Anatomia do custo: lê as transcrições das execuções B e C do benchmark de
// 22/11 (caminhos em execucoes/<id>.json, campo medicao.arquivos) e grava
// anatomia.json. Uso: node scripts/anatomia.mjs [--so=r1-T1-C]
//
// Método (por sessão: principal/orquestrador e cada subagente):
// - Chamada à API = um message.id do assistente (campos de uso pelo maior valor,
//   como o app). Tamanho do contexto da chamada k: T_k = entrada + criação + leitura.
// - Primeira chamada: composição real lida da própria transcrição
//   (api-request-shape: sistema e ferramentas; api-request-blob: mensagens
//   system/user enviadas). Tokens por componente = caracteres × (T_1 / caracteres
//   totais da primeira chamada), uma razão calibrada por sessão.
// - Chamadas seguintes: Δ_k = T_k − T_{k−1} é o que entrou no contexto desde a
//   chamada anterior (blocos do assistente + resultados de ferramenta + avisos).
//   Δ_k é repartido entre esses itens na proporção dos caracteres.
// - Custo de entrada da chamada k: atribuição posicional sobre o prefixo
//   (leitura de cache cobre os primeiros r_k tokens, criação os c_k seguintes,
//   entrada o resto). Saída: o_k repartida pelos blocos da própria chamada
//   (pensamento pelo thinking_tokens; o resto na proporção dos caracteres).
// - Índice = entrada + 1,25×criação + 0,1×leitura + 5×saída (UsoDeTokens do app).
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(aqui, '..');
const EXEC = path.join(RAIZ, 'execucoes');
const SAIDA = path.join(RAIZ, 'anatomia.json');
const so = (process.argv.find((a) => a.startsWith('--so=')) ?? '').slice(5);

// US$ por milhão de tokens (DECISOES.md, lidos em 23/11/2026).
const PRECOS = {
  'claude-sonnet-5-5': { entrada: 2, cache5m: 2.5, cache1h: 4, leitura: 0.1, saida: 10 },
  'claude-opus-5-5': { entrada: 4, cache5m: 5, cache1h: 8, leitura: 0.2, saida: 20 },
};
const precoDe = (m) => PRECOS[Object.keys(PRECOS).find((k) => (m ?? '').startsWith(k))] ?? PRECOS['claude-sonnet-5-5'];
const indice = (t) => t.entrada + 1.25 * t.criacao + 0.1 * t.leitura + 5 * t.saida;
const LEITURA_SO = new Set(['Read', 'Grep', 'Glob']);
const BASH_SO_LEITURA = /^\s*(cd [^;&|]+(&&|;)\s*)?(ls|cat|head|tail|sed -n|grep|rg|find|wc|git (status|diff|log|show)|nl)\b/;

const ehObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const tam = (x) => (typeof x === 'string' ? x.length : JSON.stringify(x ?? '').length);
const textoDe = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => (typeof b?.text === 'string' ? b.text : JSON.stringify(b))).join('\n') : JSON.stringify(c ?? ''));

function lerLinhas(arq) {
  const out = [];
  for (const s of readFileSync(arq, 'utf8').split('\n')) {
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* linha parcial */ }
  }
  return out;
}

// ---------- composição da primeira chamada ----------
function comporPrimeiraChamada(L, papel) {
  const blobs = new Map();
  for (const l of L) if (l.type === 'api-request-blob') blobs.set(l.hash, l.message);
  const shape = L.find((l) => l.type === 'api-request-shape')?.shape;
  const req = L.find((l) => l.type === 'api-request');
  const snap = L.find((l) => l.type === 'attachment' && l.attachment?.type === 'prompt_snapshot')?.attachment?.systemPrompt ?? [];
  const comp = {}; // componente -> caracteres
  const somar = (k, n) => { comp[k] = (comp[k] ?? 0) + n; };
  const ferramentas = {};
  const textos = { instrucoesDoApp: '', pedido: '' };
  if (shape) {
    const sysTotal = shape.system.reduce((a, s) => a + (s.text?.length ?? 0), 0);
    let app = 0, mem = 0;
    for (const p of snap) {
      if (/^Você é (o ORQUESTRADOR|um subagente)/.test(p.trimStart())) { app += p.length; textos.instrucoesDoApp += p; }
      else if (p.startsWith('# Memory')) mem += p.length;
    }
    somar('sistemaBaseDoClaudeCode', sysTotal - app - mem);
    if (mem) somar('memoriaAutomatica', mem);
    if (app) somar(papel === 'subagente' ? 'promptDoExecutor(--agents)' : 'instrucoesDoApp(--append-system-prompt-file)', app);
    for (const t of shape.tools) { const n = JSON.stringify(t).length; ferramentas[t.name] = n; somar('definicoesDeFerramentas', n); }
  }
  let faltando = 0;
  for (const h of req?.tail ?? []) {
    const m = blobs.get(h);
    if (!m) { faltando++; continue; }
    const blocos = Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content) }];
    if (m.role === 'system') {
      for (const b of blocos) {
        if (typeof b.text !== 'string') { somar('ferramentasAdiadasEMcp', tam(b)); continue; }
        const s = b.text;
        const marcas = [
          ['hookSessionStart', s.indexOf('SessionStart hook additional context')],
          ['ambienteEIdioma', s.indexOf('# Environment')],
          ['listaDeAgentes', s.indexOf('Available agent types for the Agent tool')],
          ['listaDeSkills', s.indexOf('The following skills are available')],
          ['ambienteEIdioma#data', s.indexOf("Today's date is")],
        ].filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
        if (marcas.length === 0 || marcas[0][1] > 0) somar(/MCP|mcp/.test(s.slice(0, 400)) ? 'ferramentasAdiadasEMcp' : 'outrosDoSistema', marcas.length ? marcas[0][1] : s.length);
        marcas.forEach(([k, i], j) => somar(k.split('#')[0], (marcas[j + 1]?.[1] ?? s.length) - i));
      }
    } else {
      blocos.forEach((b, j) => {
        const s = typeof b.text === 'string' ? b.text : JSON.stringify(b);
        const ultimo = j === blocos.length - 1;
        if (s.includes('Contents of ')) {
          const partes = s.split(/(?=Contents of )/);
          somar('claudeMdDoUsuario', partes[0].length);
          for (const p of partes.slice(1)) {
            const cam = (p.match(/^Contents of (\S+)/) ?? [])[1] ?? '';
            if (/\/\.claude\/CLAUDE\.md$/.test(cam)) somar('claudeMdDoUsuario', p.length);
            else if (/\/\.claude\/rules\//.test(cam)) somar('regrasDoUsuario(rules/*.md)', p.length);
            else if (/\/memory\/MEMORY\.md$/.test(cam)) somar('memoriaAutomatica', p.length);
            else somar('claudeMdDoProjeto', p.length);
          }
        } else if (/As you answer the user's questions|# userEmail|# gitStatus/.test(s) && !ultimo) somar('contextoDaSessao', s.length);
        else if (s.includes('Attribution for git')) somar('atribuicaoGit', s.length);
        else if (ultimo) {
          const fim = s.indexOf('</configuracao-do-pedido>');
          if (s.startsWith('<configuracao-do-pedido>') && fim > 0) {
            const corte = fim + '</configuracao-do-pedido>'.length;
            somar('instrucoesDoApp(configuracao-do-pedido)', corte);
            textos.instrucoesDoApp += s.slice(0, corte);
            somar('pedido', s.length - corte);
            textos.pedido = s.slice(corte);
          } else { somar('pedido', s.length); textos.pedido = s; }
        } else somar('outrosDaMensagem', s.length);
      });
    }
  }
  return { comp, ferramentas, faltando, textos };
}

// ---------- sessão ----------
function analisarSessao(arq, papel) {
  const L = lerLinhas(arq);
  const idDaFerramenta = new Map(); // tool_use_id -> nome
  const chamadas = [];
  const porId = new Map();
  let pendentes = [];
  let anterior = null;
  for (const l of L) {
    if (l.type === 'assistant' && ehObj(l.message)) {
      const m = l.message;
      if (m.model === '<synthetic>') continue;
      const id = m.id ?? `sem-id-${chamadas.length}`;
      let c = porId.get(id);
      if (!c) {
        c = { id, modelo: m.model, u: { entrada: 0, criacao: 0, leitura: 0, saida: 0, c1h: 0, c5m: 0, pensamento: 0 }, blocos: [], vistos: new Set(), adicionados: [] };
        if (anterior) c.adicionados.push(...anterior.blocos.map((b) => ({ cat: b.catContexto, chars: b.chars })));
        c.adicionados.push(...pendentes);
        pendentes = [];
        porId.set(id, c); chamadas.push(c); anterior = c;
      }
      const u = m.usage ?? {};
      const mx = (k, v) => { c.u[k] = Math.max(c.u[k], typeof v === 'number' ? v : 0); };
      mx('entrada', u.input_tokens); mx('criacao', u.cache_creation_input_tokens); mx('leitura', u.cache_read_input_tokens); mx('saida', u.output_tokens);
      mx('c1h', u.cache_creation?.ephemeral_1h_input_tokens); mx('c5m', u.cache_creation?.ephemeral_5m_input_tokens);
      mx('pensamento', u.output_tokens_details?.thinking_tokens);
      for (const b of Array.isArray(m.content) ? m.content : []) {
        const chave = b.id ?? `${b.type}:${(b.text ?? b.thinking ?? '').slice(0, 80)}`;
        if (c.vistos.has(chave)) continue;
        c.vistos.add(chave);
        if (b.type === 'tool_use') {
          idDaFerramenta.set(b.id, b.name);
          const chars = JSON.stringify(b.input ?? {}).length;
          c.blocos.push({ tipo: 'tool_use', nome: b.name, input: b.input, chars, catContexto: b.name === 'Agent' ? 'brief(no contexto do orquestrador)' : `ferramenta:${b.name}`, catSaida: b.name === 'Agent' ? 'saida:brief' : `saida:${b.name}` });
        } else if (b.type === 'text') c.blocos.push({ tipo: 'text', chars: b.text.length, texto: b.text, catContexto: 'textoDoModelo', catSaida: 'saida:texto' });
        else if (b.type === 'thinking' || b.type === 'redacted_thinking') c.blocos.push({ tipo: 'thinking', chars: (b.thinking ?? b.data ?? '').length, catContexto: 'pensamento', catSaida: null });
      }
      continue;
    }
    if (l.type === 'user' && ehObj(l.message) && chamadas.length > 0) {
      const cont = l.message.content;
      if (typeof cont === 'string') {
        // Notificação de fim de subagente e lembretes chegam como texto simples
        // (na API vão juntos num bloco com system-reminder).
        pendentes.push({ cat: cont.includes('<task-notification>') ? 'relatorio' : 'lembretesDoSistema', chars: cont.length, texto: cont });
        continue;
      }
      for (const b of Array.isArray(cont) ? cont : []) {
        if (b.type === 'tool_result') {
          const nome = idDaFerramenta.get(b.tool_use_id) ?? '?';
          pendentes.push({ cat: nome === 'Agent' ? 'lancamentoDoSubagente(metadado)' : `ferramenta:${nome}`, chars: tam(b.content), nome, toolUseId: b.tool_use_id });
        } else if (b.type === 'text') {
          pendentes.push({ cat: b.text.includes('<task-notification>') ? 'relatorio' : 'lembretesDoSistema', chars: b.text.length, texto: b.text });
        } else pendentes.push({ cat: 'outros', chars: tam(b) });
      }
    }
  }

  const prim = comporPrimeiraChamada(L, papel);
  const T = chamadas.map((c) => c.u.entrada + c.u.criacao + c.u.leitura);
  const charsPrim = Object.values(prim.comp).reduce((a, b) => a + b, 0);
  const razao = charsPrim > 0 && T[0] ? T[0] / charsPrim : 0.27;
  const pedidoTok = Math.round((prim.comp.pedido ?? 0) * razao);
  const catPedido = papel === 'subagente' ? 'briefRecebido' : 'pedidoDoUsuario';
  const segmentos = [{ cat: 'contextoFixo', tok: (T[0] ?? 0) - pedidoTok }, { cat: catPedido, tok: pedidoTok }];
  const cats = {}; // cat -> {entrada, criacao, leitura, saida, usd}
  const reg = (k) => (cats[k] ??= { entrada: 0, criacao: 0, leitura: 0, saida: 0, usd: 0 });
  const avisos = [];
  let charsDepois = 0, deltaDepois = 0;
  const viagens = {}; // ferramenta -> {usos, leituraProvocada, usdProvocado}
  const custoEntradaDaChamada = [];

  chamadas.forEach((c, k) => {
    const p = precoDe(c.modelo);
    if (k > 0) {
      let delta = T[k] - T[k - 1];
      if (delta < 0) { avisos.push(`chamada ${k + 1}: contexto encolheu ${delta}`); delta = 0; }
      const soma = c.adicionados.reduce((a, x) => a + x.chars, 0);
      if (soma === 0) { if (delta) segmentos.push({ cat: 'outros', tok: delta }); }
      else {
        charsDepois += soma; deltaDepois += delta;
        for (const x of c.adicionados) if (x.chars) segmentos.push({ cat: x.cat, tok: (delta * x.chars) / soma });
      }
    }
    // Entrada: posicional.
    const precoCriacao = c.u.criacao > 0 ? ((c.u.c1h || 0) * p.cache1h + (c.u.c5m || (c.u.c1h ? 0 : c.u.criacao)) * p.cache5m) / c.u.criacao : 0;
    let restLeit = c.u.leitura, restCri = c.u.criacao, restEnt = c.u.entrada;
    for (const s of segmentos) {
      let t = s.tok;
      const r = reg(s.cat);
      const a = Math.min(t, restLeit); restLeit -= a; t -= a; r.leitura += a; r.usd += (a * p.leitura) / 1e6;
      const b = Math.min(t, restCri); restCri -= b; t -= b; r.criacao += b; r.usd += (b * precoCriacao) / 1e6;
      const e = Math.min(t, restEnt); restEnt -= e; t -= e; r.entrada += e; r.usd += (e * p.entrada) / 1e6;
    }
    const sobra = restLeit + restCri + restEnt;
    if (sobra > 0.5) { const r = reg('outros'); r.leitura += restLeit; r.criacao += restCri; r.entrada += restEnt; r.usd += (restLeit * p.leitura + restCri * precoCriacao + restEnt * p.entrada) / 1e6; }
    custoEntradaDaChamada.push((c.u.leitura * p.leitura + c.u.criacao * precoCriacao + c.u.entrada * p.entrada) / 1e6);
    // Saída.
    const pens = Math.min(c.u.pensamento, c.u.saida);
    if (pens) { const r = reg('saida:pensamento'); r.saida += pens; r.usd += (pens * p.saida) / 1e6; }
    const resto = c.u.saida - pens;
    const vis = c.blocos.filter((b) => b.catSaida);
    const somaVis = vis.reduce((a, b) => a + b.chars, 0);
    if (resto > 0) {
      if (somaVis === 0) { const r = reg('saida:outros'); r.saida += resto; r.usd += (resto * p.saida) / 1e6; }
      else for (const b of vis) { const t = (resto * b.chars) / somaVis; const r = reg(k === chamadas.length - 1 && b.tipo === 'text' ? 'saida:respostaFinal' : b.catSaida); r.saida += t; r.usd += (t * p.saida) / 1e6; }
    }
  });
  // (b) idas e vindas: a chamada seguinte é provocada pelas ferramentas desta.
  chamadas.forEach((c, k) => {
    const usos = c.blocos.filter((b) => b.tipo === 'tool_use');
    for (const b of usos) { const v = (viagens[b.nome] ??= { usos: 0, chamadasComEla: 0, leituraProvocada: 0, criacaoProvocada: 0, usdProvocado: 0 }); v.usos++; }
    const nomes = [...new Set(usos.map((b) => b.nome))];
    for (const n of nomes) viagens[n].chamadasComEla++;
    if (k + 1 < chamadas.length && usos.length) {
      const prox = chamadas[k + 1];
      for (const b of usos) {
        const v = viagens[b.nome];
        v.leituraProvocada += prox.u.leitura / usos.length;
        v.criacaoProvocada += prox.u.criacao / usos.length;
        v.usdProvocado += custoEntradaDaChamada[k + 1] / usos.length;
      }
    }
  });
  // Corte 4: sequências de chamadas só de leitura (Read/Grep/Glob) sem edição entre elas.
  const sequencias = (pred) => {
    const seqs = []; let atual = [];
    chamadas.forEach((c, k) => {
      const usos = c.blocos.filter((b) => b.tipo === 'tool_use');
      if (usos.length && usos.every(pred)) atual.push(k);
      else { if (atual.length >= 2) seqs.push(atual); atual = []; }
    });
    if (atual.length >= 2) seqs.push(atual);
    let eliminadas = 0, leitura = 0, usd = 0, usos = 0;
    for (const s of seqs) for (const k of s.slice(1)) {
      eliminadas++; const c = chamadas[k]; const p = precoDe(c.modelo);
      leitura += c.u.leitura; usd += (c.u.leitura * p.leitura + c.u.entrada * p.entrada) / 1e6;
    }
    for (const s of seqs) for (const k of s) usos += chamadas[k].blocos.filter((b) => b.tipo === 'tool_use').length;
    return { sequencias: seqs.map((s) => s.length), chamadasNasSequencias: seqs.reduce((a, s) => a + s.length, 0), usosDeFerramentaNasSequencias: usos, chamadasEliminadas: eliminadas, leituraDeCacheEvitada: leitura, usdEvitado: usd };
  };
  const corte4 = {
    soReadGrepGlob: sequencias((b) => LEITURA_SO.has(b.nome)),
    comBashDeLeitura: sequencias((b) => LEITURA_SO.has(b.nome) || (b.nome === 'Bash' && BASH_SO_LEITURA.test(String(b.input?.command ?? '')))),
  };

  // Usos de ferramenta com alvo (para achar releituras).
  const usos = [];
  chamadas.forEach((c, k) => c.blocos.filter((b) => b.tipo === 'tool_use').forEach((b) => usos.push({ chamada: k, nome: b.nome, alvo: b.input?.file_path ?? b.input?.path ?? b.input?.pattern ?? null, comando: b.nome === 'Bash' ? String(b.input?.command ?? '') : null, input: b.nome === 'Agent' ? b.input : undefined })));
  const notificacoes = [];
  chamadas.forEach((c, k) => c.adicionados.filter((x) => x.cat === 'relatorio').forEach((x) => {
    const r = (x.texto.match(/<result>([\s\S]*?)<\/result>/) ?? [])[1] ?? '';
    notificacoes.push({ antesDaChamada: k, charsTotal: x.chars, charsResultado: r.length });
  }));
  const lancamentos = [];
  chamadas.forEach((c, k) => c.adicionados.filter((x) => x.cat === 'lancamentoDoSubagente(metadado)').forEach((x) => lancamentos.push({ antesDaChamada: k, chars: x.chars })));

  const somaU = chamadas.reduce((a, c) => ({ entrada: a.entrada + c.u.entrada, criacao: a.criacao + c.u.criacao, leitura: a.leitura + c.u.leitura, saida: a.saida + c.u.saida }), { entrada: 0, criacao: 0, leitura: 0, saida: 0 });
  const fixoTok = segmentos[0].tok;
  const p0 = precoDe(chamadas[0]?.modelo);
  const ultima = chamadas[chamadas.length - 1];
  return {
    arquivo: arq,
    papel,
    modelo: chamadas[0]?.modelo ?? null,
    chamadasAPI: chamadas.length,
    tokens: somaU,
    indice: indice(somaU),
    primeiraChamada: {
      entrada: chamadas[0]?.u.entrada, criacao: chamadas[0]?.u.criacao, leitura: chamadas[0]?.u.leitura, total: T[0],
      tokensPorCaractere: razao, caracteres: charsPrim, blobsFaltando: prim.faltando,
      componentes: Object.fromEntries(Object.entries(prim.comp).map(([k, v]) => [k, { caracteres: v, tokensEstimados: Math.round(v * razao) }])),
      ferramentasDefinidas: prim.ferramentas,
      caracteresDasInstrucoesDoApp: prim.textos.instrucoesDoApp.length,
    },
    porChamada: chamadas.map((c, k) => ({ entrada: c.u.entrada, criacao: c.u.criacao, leitura: c.u.leitura, saida: c.u.saida, usd: +(custoEntradaDaChamada[k] + (c.u.saida * precoDe(c.modelo).saida) / 1e6).toFixed(5), ferramentas: c.blocos.filter((b) => b.tipo === 'tool_use').map((b) => b.nome) })),
    contextoFixo: { tokens: fixoTok, chamadas: chamadas.length, tokensSomadosEmTodasAsChamadas: fixoTok * chamadas.length, leituraDeCacheDoFixo: cats.contextoFixo?.leitura ?? 0 },
    tokensPorCaractereDepoisDaPrimeira: charsDepois ? deltaDepois / charsDepois : null,
    categorias: cats,
    idasEVindas: viagens,
    corte4,
    usos,
    notificacoes,
    lancamentos,
    textoFinal: ultima ? ultima.blocos.filter((b) => b.tipo === 'text').map((b) => b.texto).join('\n') : '',
    saidaDaUltimaChamada: ultima?.u.saida ?? 0,
    precoSaida: p0.saida,
    briefRecebido: papel === 'subagente' ? prim.textos.pedido : undefined,
    avisos,
  };
}

// ---------- agregação ----------
const GRUPO = (cat) => {
  if (cat === 'contextoFixo') return 'contextoFixo';
  if (cat.startsWith('saida:')) return 'saida';
  if (cat.startsWith('ferramenta:')) return 'ferramentas(idasEVindas)';
  if (['brief(no contexto do orquestrador)', 'briefRecebido', 'relatorio', 'lancamentoDoSubagente(metadado)'].includes(cat)) return 'briefsERelatorios';
  if (cat === 'pedidoDoUsuario') return 'pedidoDoUsuario';
  return 'outros(texto do modelo, lembretes)';
};
const vazio = () => ({ entrada: 0, criacao: 0, leitura: 0, saida: 0, usd: 0 });
function somarCats(dest, cats) {
  for (const [k, v] of Object.entries(cats)) {
    const d = (dest[k] ??= vazio());
    for (const c of Object.keys(d)) d[c] += v[c];
  }
}
function fechar(cats) {
  const grupos = {};
  for (const [k, v] of Object.entries(cats)) somarCats(grupos, { [GRUPO(k)]: v });
  const tot = Object.values(grupos).reduce((a, v) => a + v.usd, 0);
  const totI = Object.values(grupos).reduce((a, v) => a + indice(v), 0);
  const fmt = (v) => ({ tokens: Math.round(v.entrada + v.criacao + v.leitura + v.saida), entrada: Math.round(v.entrada), criacao: Math.round(v.criacao), leitura: Math.round(v.leitura), saida: Math.round(v.saida), indice: Math.round(indice(v)), usd: +v.usd.toFixed(4), pctUsd: tot ? +((100 * v.usd) / tot).toFixed(1) : 0, pctIndice: totI ? +((100 * indice(v)) / totI).toFixed(1) : 0 });
  const ord = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1].usd - a[1].usd).map(([k, v]) => [k, fmt(v)]));
  return { usdTotal: +tot.toFixed(4), indiceTotal: Math.round(totI), porGrupo: ord(grupos), porCategoria: ord(cats) };
}

const arquivosExec = readdirSync(EXEC).filter((f) => /^r\d-T\d-[BC]\.json$/.test(f) && (!so || f.startsWith(so))).sort();
const resultado = { geradoEm: null, metodo: 'ver cabeçalho de scripts/anatomia.mjs', execucoes: {}, agregados: null };
const gravar = () => writeFileSync(SAIDA, `${JSON.stringify(resultado, null, 1)}\n`);

// Pacote que o Claude Code carrega (evento system/init de uma execução B).
try {
  const g = gunzipSync(readFileSync(path.join(EXEC, 'r1-T1-B.stream.jsonl.gz'))).toString('utf8').split('\n');
  const init = g.map((s) => { try { return JSON.parse(s); } catch { return null; } }).find((x) => x?.type === 'system' && x.subtype === 'init');
  const hook = g.map((s) => { try { return JSON.parse(s); } catch { return null; } }).find((x) => x?.type === 'system' && x.subtype === 'hook_response' && /SessionStart/.test(x.hook_name ?? ''));
  resultado.initDoClaudeCode = init ? {
    plugins: (init.plugins ?? []).map((p) => p.name ?? p), skills: init.skills?.length ?? null, slashCommands: init.slash_commands?.length ?? null,
    agentes: init.agents ?? null, ferramentas: init.tools?.length ?? null, mcp: (init.mcp_servers ?? []).map((m) => m.name),
    caracteresDaRespostaDoHookSessionStart: hook ? tam(hook.output ?? hook.stdout ?? '') : null,
    caracteresDoEventoDoHookSessionStart: hook ? JSON.stringify(hook).length : null,
  } : null;
} catch (e) { resultado.initDoClaudeCode = { erro: String(e) }; }

// Estimativa dos subagentes prontos do app real (não estavam na instância isolada do benchmark).
try {
  const pref = JSON.parse(readFileSync(path.join(os.homedir(), 'Library/Application Support/Orquestrador de Agentes/dados/preferencias.json'), 'utf8'));
  const prontos = pref.subagentesProntos ?? [];
  const naLista = prontos.reduce((a, s) => a + `- ${s.nome}: ${s.descricao} (Tools: Read, Glob, Grep, WebSearch, WebFetch, Edit, Write, NotebookEdit, PowerShell, Bash, Skill)\n`.length, 0);
  const naMensagem = prontos.reduce((a, s) => a + `  - "${s.nome}": ${s.descricao}\n`.length, 0) + 330;
  resultado.subagentesProntosDoAppReal = { quantidade: prontos.length, caracteresNaListaDeAgentes: naLista, caracteresNaConfiguracaoDoPedido: naMensagem, caracteresDosPromptsNaoCarregados: prontos.reduce((a, s) => a + (s.prompt ?? '').length, 0) };
} catch (e) { resultado.subagentesProntosDoAppReal = { erro: String(e) }; }
gravar();

for (const f of arquivosExec) {
  const j = JSON.parse(readFileSync(path.join(EXEC, f), 'utf8'));
  const arqs = j.medicao?.arquivos ?? [];
  const sessoes = [];
  for (const a of arqs) {
    if (!existsSync(a.caminho)) { sessoes.push({ arquivo: a.caminho, erro: 'transcrição ausente' }); continue; }
    sessoes.push(analisarSessao(a.caminho, a.papel === 'subagente' ? 'subagente' : 'principal'));
  }
  const ok = sessoes.filter((s) => !s.erro);
  const cP = {}, cS = {};
  for (const s of ok) somarCats(s.papel === 'subagente' ? cS : cP, s.categorias);
  const tok = ok.reduce((a, s) => ({ entrada: a.entrada + s.tokens.entrada, criacao: a.criacao + s.tokens.criacao, leitura: a.leitura + s.tokens.leitura, saida: a.saida + s.tokens.saida }), { entrada: 0, criacao: 0, leitura: 0, saida: 0 });
  const usdModelo = ok.reduce((a, s) => a + Object.values(s.categorias).reduce((b, v) => b + v.usd, 0), 0);
  resultado.execucoes[j.id] = {
    tarefa: j.tarefa, config: j.config, rodada: j.rodada, sucesso: j.sucesso,
    conferencia: { tokensMedidos: tok, tokensDoHarness: j.resumo?.tokens ?? null, usdModelo: +usdModelo.toFixed(4), usdDoHarness: j.resumo?.usd ?? null },
    principal: fechar(cP),
    subagentes: ok.some((s) => s.papel === 'subagente') ? fechar(cS) : null,
    sessoes,
  };
  gravar();
  console.log(`${j.id}: ${ok.length} sessões, US$ ${usdModelo.toFixed(4)} (harness ${j.resumo?.usd?.toFixed(4)})`);
}

// ---------- agregados ----------
const E = Object.values(resultado.execucoes);
const ag = {};
for (const cfg of ['B', 'C']) {
  const doCfg = E.filter((e) => e.config === cfg);
  if (!doCfg.length) continue;
  const porTarefa = {};
  const totP = {}, totS = {};
  for (const t of ['T1', 'T2', 'T3', 'T4']) {
    const P = {}, S = {};
    for (const e of doCfg.filter((x) => x.tarefa === t)) for (const s of e.sessoes.filter((x) => !x.erro)) somarCats(s.papel === 'subagente' ? S : P, s.categorias);
    somarCats(totP, P); somarCats(totS, S);
    const todos = {}; somarCats(todos, P); somarCats(todos, S);
    porTarefa[t] = { execucoes: doCfg.filter((x) => x.tarefa === t).length, principal: fechar(P), subagentes: Object.keys(S).length ? fechar(S) : null, juntos: fechar(todos) };
  }
  const todos = {}; somarCats(todos, totP); somarCats(todos, totS);
  // Fixo, idas e vindas e corte 4 somados.
  const sess = doCfg.flatMap((e) => e.sessoes.filter((s) => !s.erro));
  const resumirSess = (lista) => {
    const viagens = {};
    for (const s of lista) for (const [n, v] of Object.entries(s.idasEVindas)) { const d = (viagens[n] ??= { usos: 0, chamadasComEla: 0, leituraProvocada: 0, criacaoProvocada: 0, usdProvocado: 0 }); for (const k of Object.keys(d)) d[k] += v[k]; }
    for (const v of Object.values(viagens)) { v.leituraProvocada = Math.round(v.leituraProvocada); v.criacaoProvocada = Math.round(v.criacaoProvocada); v.usdProvocado = +v.usdProvocado.toFixed(4); v.leituraMediaPorUso = Math.round(v.leituraProvocada / v.usos); }
    const c4 = {};
    for (const mod of ['soReadGrepGlob', 'comBashDeLeitura']) {
      c4[mod] = lista.reduce((a, s) => { const x = s.corte4[mod]; return { sequencias: a.sequencias + x.sequencias.length, chamadasNasSequencias: a.chamadasNasSequencias + x.chamadasNasSequencias, usosDeFerramentaNasSequencias: a.usosDeFerramentaNasSequencias + x.usosDeFerramentaNasSequencias, chamadasEliminadas: a.chamadasEliminadas + x.chamadasEliminadas, leituraDeCacheEvitada: a.leituraDeCacheEvitada + x.leituraDeCacheEvitada, usdEvitado: a.usdEvitado + x.usdEvitado }; }, { sequencias: 0, chamadasNasSequencias: 0, usosDeFerramentaNasSequencias: 0, chamadasEliminadas: 0, leituraDeCacheEvitada: 0, usdEvitado: 0 });
      c4[mod].usdEvitado = +c4[mod].usdEvitado.toFixed(4);
    }
    const fixo = lista.map((s) => s.primeiraChamada.total);
    return {
      sessoes: lista.length,
      chamadasAPI: lista.reduce((a, s) => a + s.chamadasAPI, 0),
      primeiraChamada: { media: Math.round(fixo.reduce((a, b) => a + b, 0) / (fixo.length || 1)), min: Math.min(...fixo), max: Math.max(...fixo) },
      contextoFixoSomadoEmTodasAsChamadas: Math.round(lista.reduce((a, s) => a + s.contextoFixo.tokensSomadosEmTodasAsChamadas, 0)),
      idasEVindas: Object.fromEntries(Object.entries(viagens).sort((a, b) => b[1].usdProvocado - a[1].usdProvocado)),
      corte4: c4,
    };
  };
  ag[cfg] = {
    totalPrincipal: fechar(totP),
    totalSubagentes: Object.keys(totS).length ? fechar(totS) : null,
    totalJuntos: fechar(todos),
    porTarefa,
    principal: resumirSess(sess.filter((s) => s.papel === 'principal')),
    subagentes: cfg === 'C' ? resumirSess(sess.filter((s) => s.papel === 'subagente')) : null,
  };
}
resultado.agregados = ag;

// ---------- achados para o corte 5 (só C) ----------
const arquivosCitados = (u) => {
  if (u.nome === 'Read') return [String(u.alvo ?? '').split('/').slice(-2).join('/')];
  if (u.nome === 'Bash') return (u.comando.match(/[\w.*-]+\/[\w.*/-]+\.js|[\w-]+\.js/g) ?? []).map((s) => s.split('/').slice(-2).join('/'));
  return [];
};
const c5 = { porExecucao: {}, totais: { exploracaoAntesDeDelegar: { chamadas: 0, usd: 0 }, verificacaoDepoisDoRelatorio: { chamadas: 0, usd: 0 }, briefs: { quantidade: 0, caracteres: 0, usdSaida: 0, usdNoOrquestrador: 0, usdNoSubagente: 0 }, relatorios: { quantidade: 0, caracteresDoResultado: 0, caracteresComEnvelope: 0, usdSaidaNoSubagente: 0, usdNoOrquestrador: 0 }, lancamentos: { quantidade: 0, caracteres: 0, usd: 0 }, arquivosRelidosPeloSubagente: 0, instrucoesDoApp: null } };
const T5 = c5.totais;
for (const [id, e] of Object.entries(resultado.execucoes)) {
  if (e.config !== 'C') continue;
  const P = e.sessoes.find((s) => s.papel === 'principal');
  const S = e.sessoes.filter((s) => s.papel === 'subagente');
  if (!P || P.erro) continue;
  const iAgent = P.usos.find((u) => u.nome === 'Agent')?.chamada ?? null;
  const n1 = P.notificacoes[0]?.antesDaChamada ?? null;
  const x = { delegou: iAgent !== null };
  if (iAgent !== null) {
    // Chamadas 2..iAgent (a primeira é o fixo) que só exploraram antes de delegar.
    // Rodadas de exploração = chamadas 1..iAgent−1 só com ferramentas; cada uma
    // empurra o Agent uma chamada para frente. Custo marginal: chamadas 2..iAgent+1
    // (se delegasse de cara, a chamada 1 já lançaria o Agent).
    const exploracao = P.porChamada.slice(1, iAgent + 1);
    x.exploracaoAntesDeDelegar = { chamadas: exploracao.length, usd: +exploracao.reduce((a, c) => a + c.usd, 0).toFixed(4) };
    T5.exploracaoAntesDeDelegar.chamadas += exploracao.length; T5.exploracaoAntesDeDelegar.usd += exploracao.reduce((a, c) => a + c.usd, 0);
    const lidosP = new Set(P.usos.filter((u) => u.chamada < iAgent).flatMap(arquivosCitados));
    const lidosS = new Set(S.flatMap((s) => s.usos.filter((u) => u.nome === 'Read' || u.nome === 'Bash').flatMap(arquivosCitados)));
    x.arquivosLidosPeloOrquestradorAntes = lidosP.size;
    const base = (f) => f.split('/').pop();
    const basesS = new Set([...lidosS].map(base));
    x.arquivosRelidosPeloSubagente = [...lidosP].filter((f) => !f.includes('*') && basesS.has(base(f))).length;
    T5.arquivosRelidosPeloSubagente += x.arquivosRelidosPeloSubagente;
  }
  if (n1 !== null) {
    const ver = P.porChamada.slice(n1).filter((c) => c.ferramentas.length);
    x.verificacaoDepoisDoRelatorio = { chamadas: ver.length, usd: +ver.reduce((a, c) => a + c.usd, 0).toFixed(4), comandos: P.usos.filter((u) => u.chamada >= n1).map((u) => u.comando ?? u.nome) };
    T5.verificacaoDepoisDoRelatorio.chamadas += ver.length; T5.verificacaoDepoisDoRelatorio.usd += ver.reduce((a, c) => a + c.usd, 0);
  }
  const cat = (s, k) => s?.categorias?.[k]?.usd ?? 0;
  const briefs = P.usos.filter((u) => u.nome === 'Agent');
  x.briefs = briefs.map((u) => ({ caracteres: String(u.input?.prompt ?? '').length }));
  T5.briefs.quantidade += briefs.length; T5.briefs.caracteres += x.briefs.reduce((a, b) => a + b.caracteres, 0);
  T5.briefs.usdSaida += cat(P, 'saida:brief'); T5.briefs.usdNoOrquestrador += cat(P, 'brief(no contexto do orquestrador)');
  T5.briefs.usdNoSubagente += S.reduce((a, s) => a + cat(s, 'briefRecebido'), 0);
  x.relatorios = P.notificacoes.map((n) => ({ caracteresDoResultado: n.charsResultado, caracteresComEnvelope: n.charsTotal }));
  T5.relatorios.quantidade += P.notificacoes.length;
  T5.relatorios.caracteresDoResultado += P.notificacoes.reduce((a, n) => a + n.charsResultado, 0);
  T5.relatorios.caracteresComEnvelope += P.notificacoes.reduce((a, n) => a + n.charsTotal, 0);
  T5.relatorios.usdNoOrquestrador += cat(P, 'relatorio');
  T5.relatorios.usdSaidaNoSubagente += S.reduce((a, s) => a + cat(s, 'saida:respostaFinal'), 0);
  T5.lancamentos.quantidade += P.lancamentos.length; T5.lancamentos.caracteres += P.lancamentos.reduce((a, l) => a + l.chars, 0); T5.lancamentos.usd += cat(P, 'lancamentoDoSubagente(metadado)');
  c5.porExecucao[id] = x;
}
// Instruções do app: parte do fixo do orquestrador e do executor.
{
  const sessC = Object.values(resultado.execucoes).filter((e) => e.config === 'C').flatMap((e) => e.sessoes.filter((s) => !s.erro));
  const inst = (s) => Object.entries(s.primeiraChamada.componentes).filter(([k]) => /instrucoesDoApp|promptDoExecutor/.test(k)).reduce((a, [, v]) => a + v.tokensEstimados, 0);
  const instC = (s) => Object.entries(s.primeiraChamada.componentes).filter(([k]) => /instrucoesDoApp|promptDoExecutor/.test(k)).reduce((a, [, v]) => a + v.caracteres, 0);
  // Custo do fixo × fração do fixo que são instruções do app.
  const usd = sessC.reduce((a, s) => a + (s.categorias.contextoFixo?.usd ?? 0) * (inst(s) / (s.contextoFixo.tokens || 1)), 0);
  T5.instrucoesDoApp = {
    caracteresNoOrquestrador: Math.round(sessC.filter((s) => s.papel === 'principal').reduce((a, s) => a + instC(s), 0) / Math.max(1, sessC.filter((s) => s.papel === 'principal').length)),
    caracteresNoExecutor: Math.round(sessC.filter((s) => s.papel === 'subagente').reduce((a, s) => a + instC(s), 0) / Math.max(1, sessC.filter((s) => s.papel === 'subagente').length)),
    usdEstimadoNas12: +usd.toFixed(4),
  };
}
for (const g of Object.values(T5)) if (g && typeof g === 'object') for (const k of Object.keys(g)) if (typeof g[k] === 'number' && !Number.isInteger(g[k])) g[k] = +g[k].toFixed(4);
resultado.achadosCorte5 = c5;

// ---------- repartição calibrada do contexto fixo ----------
// Sondas de uma chamada (23/11/2026, claude 2.1.322, Sonnet 5.5, prompt "responda ok",
// pasta vazia /tmp/anatomia/sonda). Total = entrada + criação + leitura da 1ª chamada;
// caracteres lidos da transcrição de cada sonda (api-request-shape e blobs).
const SONDAS = [
  { n: 0, args: '(padrão)', tokens: 30239, usd: 0.0766022, chars: { ferramentas: 29654, skills: 26221, resto: 29260 } },
  { n: 1, args: '--disable-slash-commands', tokens: 26978, usd: 0.0415622, chars: { ferramentas: 44777, skills: 0, resto: 29124 }, nota: 'sem Skill o Claude Code carrega ListAgents/ToolSearch maiores: ferramentas +15 mil caracteres' },
  { n: 2, args: '--disable-slash-commands --tools ""', tokens: 12292, usd: 0.0289279, chars: { ferramentas: 11174, skills: 0, resto: 21383 }, nota: 'sobram as 10 ferramentas MCP (claude.ai Docs e context7)' },
  { n: 3, args: '--disable-slash-commands --tools "" --setting-sources ""', tokens: 12292, usd: 0.001273, nota: 'idêntica à 2: --setting-sources "" não tirou plugins, hook nem CLAUDE.md' },
  { n: 4, args: '(padrão) + --append-system-prompt-file instrucoes do orquestrador + <configuracao-do-pedido> no prompt', tokens: 32939, usd: 0.0873671, nota: '+2.700 tokens para +6.399 caracteres (instruções do app, em português: 0,42 token/caractere)' },
];
// Sistema 3×3 com as sondas 0, 1 e 2: ferramentas 0,346; lista de skills 0,322; resto 0,394 token/caractere.
const RAZAO = { definicoesDeFerramentas: 0.3463, listaDeSkills: 0.322, instrucoesDoApp: 0.42, resto: 0.3939 };
const razaoDe = (k) => (k === 'definicoesDeFerramentas' ? RAZAO.definicoesDeFerramentas : k === 'listaDeSkills' ? RAZAO.listaDeSkills : /instrucoesDoApp|promptDoExecutor/.test(k) ? RAZAO.instrucoesDoApp : RAZAO.resto);
const reparticao = {};
for (const e of Object.values(resultado.execucoes)) for (const s of e.sessoes.filter((x) => !x.erro)) {
  const grupo = e.config === 'B' ? 'B' : s.papel === 'subagente' ? 'C-subagente' : 'C-orquestrador';
  const comp = s.primeiraChamada.componentes;
  const bruto = Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, v.caracteres * razaoDe(k)]));
  const soma = Object.values(bruto).reduce((a, b) => a + b, 0);
  const escala = s.primeiraChamada.total / soma;
  const usdFixo = s.categorias.contextoFixo?.usd ?? 0;
  const tokFixo = s.contextoFixo.tokens || 1;
  const r = (reparticao[grupo] ??= { sessoes: 0, chamadas: 0, escalaMedia: 0, componentes: {} });
  r.sessoes++; r.chamadas += s.chamadasAPI; r.escalaMedia += escala;
  for (const [k, v] of Object.entries(bruto)) {
    if (k === 'pedido') continue;
    const tok = v * escala;
    const d = (r.componentes[k] ??= { caracteres: 0, tokens: 0, tokensSomadosEmTodasAsChamadas: 0, usd: 0 });
    d.caracteres += comp[k].caracteres; d.tokens += tok; d.tokensSomadosEmTodasAsChamadas += tok * s.chamadasAPI; d.usd += (usdFixo * tok) / tokFixo;
  }
}
for (const r of Object.values(reparticao)) {
  r.escalaMedia = +(r.escalaMedia / r.sessoes).toFixed(3);
  const totTok = Object.values(r.componentes).reduce((a, d) => a + d.tokens, 0);
  r.fixoMedioPorSessao = Math.round(totTok / r.sessoes);
  r.usdDoFixo = +Object.values(r.componentes).reduce((a, d) => a + d.usd, 0).toFixed(4);
  r.componentes = Object.fromEntries(Object.entries(r.componentes).sort((a, b) => b[1].tokens - a[1].tokens).map(([k, d]) => [k, {
    caracteresMedios: Math.round(d.caracteres / r.sessoes), tokensMedios: Math.round(d.tokens / r.sessoes), pctDoFixo: +((100 * d.tokens) / totTok).toFixed(1),
    tokensSomadosEmTodasAsChamadas: Math.round(d.tokensSomadosEmTodasAsChamadas), usdNasSessoes: +d.usd.toFixed(4),
  }]));
}
// Subagentes prontos do app real: não estavam na instância isolada do benchmark.
const pr = resultado.subagentesProntosDoAppReal;
if (pr && !pr.erro) {
  const tok = pr.caracteresNaListaDeAgentes * RAZAO.resto + pr.caracteresNaConfiguracaoDoPedido * RAZAO.instrucoesDoApp;
  const rc = reparticao['C-orquestrador'];
  pr.tokensExtrasPorChamadaDoOrquestrador = Math.round(tok);
  pr.usdExtraEstimadoNas12 = +((tok * rc.sessoes * 4 + tok * (rc.chamadas - rc.sessoes) * 0.1) / 1e6).toFixed(4);
  pr.hipotese = 'cada orquestrador cria o bloco uma vez (cache 1h, US$ 4/MTok) e o relê nas demais chamadas (US$ 0,10/MTok); subagentes não recebem a lista de agentes';
}
resultado.sondas = { lista: SONDAS, usdTotal: +SONDAS.reduce((a, s) => a + s.usd, 0).toFixed(4), razoesAjustadas: RAZAO };
resultado.reparticaoDoFixo = reparticao;

// ---------- corte 4 em US$ (hipóteses) ----------
{
  const c4 = {};
  for (const g of ['B', 'C']) {
    const A = ag[g];
    if (!A) continue;
    const partes = [A.principal, A.subagentes].filter(Boolean);
    const soma = (mod, k) => partes.reduce((a, p) => a + p.corte4[mod][k], 0);
    const readUsd = (A.totalJuntos.porCategoria['ferramenta:Read']?.usd ?? 0);
    c4[g] = {
      h1_soReadGrepGlob: { chamadasEliminadas: soma('soReadGrepGlob', 'chamadasEliminadas'), leituraDeCacheEvitada: soma('soReadGrepGlob', 'leituraDeCacheEvitada'), usd: +soma('soReadGrepGlob', 'usdEvitado').toFixed(4) },
      h2_comBashDeLeitura: { chamadasEliminadas: soma('comBashDeLeitura', 'chamadasEliminadas'), leituraDeCacheEvitada: soma('comBashDeLeitura', 'leituraDeCacheEvitada'), usd: +soma('comBashDeLeitura', 'usdEvitado').toFixed(4) },
      h3_trechosMetadeDoRead: { usd: +(readUsd * 0.5).toFixed(4), nota: 'se a ferramenta devolvesse só trechos com metade do tamanho dos Read atuais (criação e releitura do resultado)' },
      usdTotalDaConfig: A.totalJuntos.usdTotal,
    };
  }
  resultado.corte4 = {
    hipotese: 'Uma ferramenta MCP de leitura em lote recebe numa chamada todos os arquivos e buscas que o modelo pediu em chamadas seguidas só de leitura (Read/Grep/Glob; h2 inclui Bash de leitura: cat, sed -n, grep, ls, git status/diff). Cada sequência de m chamadas vira 1: somem m−1 chamadas e, com elas, a releitura do prefixo em cache (leitura) e a entrada não cacheada. Os resultados continuam entrando no contexto (criação igual); a saída é tratada como igual. h3 é independente: trechos no lugar de arquivos inteiros.',
    ...c4,
  };
}
resultado.geradoEm
resultado.geradoEm = new Date().toISOString();
gravar();
console.log('anatomia.json gravado');
