// Harness do benchmark Go SubAgents (C) x Claude Code puro (A e B).
// Uso:
//   node harness.mjs                      -> 36 execuções em execucoes/ (retomável), depois analisar.mjs, encerra a instância isolada e cria FIM
//   node harness.mjs --fumaca T1 A,B,C    -> execuções de fumaça em fumaca/ (fora da contagem); mantém o servidor no ar
//   node harness.mjs --variante v1        -> só a config C, 3 rodadas × T1..T4, com CLAUDE_CODE_BIN=variantes/claude e
//                                            BENCH_VARIANTE=v1 no servidor; saída em execucoes-variantes/v1/ (retomável);
//                                            carga (uptime) acima de 6 espera em blocos de 60 s (até 10 min); até 2 repetições
//                                            por erro de API; ao fim analisar-variantes.mjs e encerra a instância
// Execuções em sequência, nunca em paralelo. Uma execução que já tem JSON na pasta de saída é pulada.
import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync, cpSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGzip } from 'node:zlib';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(aqui, '..');
const FIXTURE = path.join(RAIZ, 'fixture');
const TAREFAS = JSON.parse(readFileSync(path.join(RAIZ, 'tarefas.json'), 'utf8'));
const BASE = realpathSync('/tmp') + '/bench-gosub';
const APP = path.join(BASE, 'app-45b1b81');
const PROJETOS = path.join(BASE, 'projetos');
const DADOS_C = path.join(BASE, 'dados-c');
const PORTA_C = 3317;
const CHAVE = readFileSync(path.join(BASE, 'chave'), 'utf8').trim();
const TSX = path.join(APP, 'node_modules', '.bin', 'tsx');
const CLAUDE = '/opt/homebrew/bin/claude';
const LIMITE_MS = 40 * 60_000;
const SEMENTE = 20261122;
const RODADAS = 3;
const CONFIGS = ['A', 'B', 'C'];
const IDS_DAS_TAREFAS = ['T1', 'T2', 'T3', 'T4'];
let MAX_TENTATIVAS = 4; // 1 + até 3 novas tentativas por erro transitório ou limite de uso (no modo --variante: 1 + 2)

// Modo --variante: a variante vale para a instância inteira do app (o servidor é reiniciado a cada troca).
const WRAPPER = path.join(RAIZ, 'variantes', 'claude');
const ARQ_VARIANTE_DO_SERVIDOR = path.join(BASE, 'servidor-c.variante');
const CARGA_MAXIMA = 6;
let VARIANTE = null;

const SINAIS_TRANSITORIOS = /overloaded|\b529\b|\b500\b|internal server error|api_error|ECONNRESET|socket hang up|ETIMEDOUT|fetch failed/i;
const SINAIS_DE_LIMITE = /usage limit|rate limit|limit reached|out of extra usage|hit your (?:[\w'’]+ )*limit|request rejected \(429\)/i;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- ambiente ----------------
function ambienteLimpo(extra = {}) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(CLAUDE|AI_AGENT|ORQUESTRADOR_|BENCH_)/.test(k)) delete env[k];
  env.PATH = `/opt/homebrew/bin:/usr/local/bin:${VARIANTE ? `${path.dirname(process.execPath)}:` : ''}${env.PATH ?? '/usr/bin:/bin'}`;
  return { ...env, ...extra };
}

// ---------------- ordem ----------------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function plano() {
  const aleatorio = mulberry32(SEMENTE);
  const lista = [];
  for (let r = 1; r <= RODADAS; r += 1) {
    for (const t of IDS_DAS_TAREFAS) {
      const ordem = [...CONFIGS];
      for (let i = ordem.length - 1; i > 0; i -= 1) {
        const j = Math.floor(aleatorio() * (i + 1));
        [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
      }
      ordem.forEach((c, i) => lista.push({ id: `r${r}-${t}-${c}`, rodada: r, tarefa: t, config: c, posicao: i + 1 }));
    }
  }
  return lista;
}

// ---------------- carga da máquina ----------------
function carga() {
  const uptime = execSync('uptime', { encoding: 'utf8' }).trim();
  const ps = execSync('ps -Ao pid,pcpu,rss,etime,command -r', { encoding: 'utf8', maxBuffer: 20e6 }).split('\n');
  const relevantes = ps.slice(1).filter((l) => /claude|node|remotion|ffmpeg|electron|chrom/i.test(l)).slice(0, 10)
    .map((l) => l.trim().replace(/\s+/g, ' ').slice(0, 200));
  const pesados = ps.slice(1).filter((l) => {
    const p = l.trim().split(/\s+/);
    return Number(p[1]) > 30 && /remotion|ffmpeg|electron-builder|vite build|tsc -p|webpack|next build|vitest/i.test(l);
  }).map((l) => l.trim().replace(/\s+/g, ' ').slice(0, 200));
  const carga1m = Number(uptime.match(/load averages?:\s*([\d.,]+)/)?.[1]?.replace(',', '.'));
  return { em: new Date().toISOString(), uptime, carga1m: Number.isFinite(carga1m) ? carga1m : null, processos: relevantes, pesados };
}
async function esperarMaquina() {
  const inicio = Date.now();
  const leituras = [];
  let c = carga();
  // No modo --variante também espera a carga de 1 min cair para 6 ou menos.
  const ocupada = (x) => x.pesados.length > 0 || (VARIANTE !== null && x.carga1m !== null && x.carga1m > CARGA_MAXIMA);
  while (ocupada(c) && Date.now() - inicio < 10 * 60_000) {
    leituras.push({ em: c.em, carga1m: c.carga1m, pesados: c.pesados });
    log(`máquina ocupada (carga ${c.carga1m}${c.pesados.length ? `; pesados: ${c.pesados.join(' | ')}` : ''}), esperando 60 s`);
    await dormir(60_000);
    c = carga();
  }
  return { ...c, esperouS: Math.round((Date.now() - inicio) / 1000), leiturasDaEspera: leituras, ocupadaAoComecar: ocupada(c) };
}

// ---------------- pasta de trabalho ----------------
function prepararPasta(id) {
  mkdirSync(PROJETOS, { recursive: true });
  const dir = path.join(PROJETOS, `${id}-${Date.now().toString(36)}`);
  cpSync(FIXTURE, dir, { recursive: true });
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], {
    encoding: 'utf8',
    env: { ...ambienteLimpo(), GIT_AUTHOR_NAME: 'bench', GIT_AUTHOR_EMAIL: 'bench@local', GIT_COMMITTER_NAME: 'bench', GIT_COMMITTER_EMAIL: 'bench@local' },
  });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'estado inicial da fixture');
  return dir;
}
function diffFinal(dir) {
  execFileSync('git', ['-C', dir, 'add', '-A'], { encoding: 'utf8' });
  return execFileSync('git', ['-C', dir, 'diff', '--cached', '--stat', '--patch'], { encoding: 'utf8', maxBuffer: 50e6 });
}

// ---------------- uso da assinatura ----------------
function janelasDaCota(msg) {
  const w = msg?.rate_limit_info?.unifiedWindows;
  if (!w || typeof w !== 'object') return null;
  return Object.entries(w).filter(([, j]) => j && typeof j === 'object').map(([nome, j]) => ({
    nome, utilizacao: j.utilization ?? null, renovaEm: j.resetsAt ? new Date(j.resetsAt * 1000).toISOString() : null, situacao: j.status ?? null,
  }));
}

// ---------------- A e B: claude -p ----------------
async function rodarClaude(cfg, prompt, dir, sessao, arquivoStream) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--session-id', sessao, '--permission-mode', 'bypassPermissions'];
  if (cfg === 'B') args.push('--model', 'sonnet', '--effort', 'medium');
  const inicio = Date.now();
  const filho = spawn(CLAUDE, args, { cwd: dir, env: ambienteLimpo(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const gz = createGzip();
  const saidaGz = createWriteStream(arquivoStream);
  gz.pipe(saidaGz);
  let resto = '';
  let stderr = '';
  const r = { resultado: null, init: null, cotas: [], rejeitado: null, mensagensAssistente: 0, resultados: 0 };
  filho.stdout.on('data', (b) => {
    gz.write(b);
    resto += b.toString('utf8');
    const linhas = resto.split('\n');
    resto = linhas.pop();
    for (const l of linhas) {
      if (!l.trim()) continue;
      let m;
      try { m = JSON.parse(l); } catch { continue; }
      if (m.type === 'system' && m.subtype === 'init') r.init = { modelo: m.model, sessao: m.session_id, versao: m.claude_code_version ?? null, permissao: m.permissionMode ?? null };
      else if (m.type === 'rate_limit_event') {
        const j = janelasDaCota(m);
        if (j) r.cotas.push({ em: new Date().toISOString(), janelas: j });
        if (m.rate_limit_info?.status === 'rejected') r.rejeitado = m.rate_limit_info;
      } else if (m.type === 'assistant') r.mensagensAssistente += 1;
      else if (m.type === 'result') { r.resultado = m; r.resultados += 1; }
    }
  });
  filho.stderr.on('data', (b) => { stderr = (stderr + b.toString('utf8')).slice(-8000); });
  let estourou = false;
  const relogio = setTimeout(() => {
    estourou = true;
    try { process.kill(-filho.pid, 'SIGTERM'); } catch {}
    setTimeout(() => { try { process.kill(-filho.pid, 'SIGKILL'); } catch {} }, 10_000);
  }, LIMITE_MS);
  const codigo = await new Promise((res) => filho.on('close', (c) => res(c)));
  clearTimeout(relogio);
  await new Promise((res) => { gz.end(); saidaGz.on('close', res); });
  return { ...r, args, codigo, estourou, stderr: stderr.slice(-2000), tempoMs: Date.now() - inicio };
}

function classificarFalhaClaude(r) {
  const ok = r.resultado && r.resultado.is_error !== true && r.codigo === 0;
  if (ok || r.estourou) return null;
  const texto = `${r.resultado?.result ?? ''}\n${r.resultado?.subtype ?? ''}\n${r.stderr}`;
  if (r.rejeitado || SINAIS_DE_LIMITE.test(texto)) return { tipo: 'limite', texto: texto.slice(0, 500), liberaEm: r.rejeitado?.resetsAt ?? null };
  if (SINAIS_TRANSITORIOS.test(texto) || !r.resultado) return { tipo: 'transitorio', texto: texto.slice(0, 500) };
  return null;
}

// ---------------- C: o app ----------------
async function api(metodo, caminho, corpo) {
  const resp = await fetch(`http://127.0.0.1:${PORTA_C}/api${caminho}`, {
    method: metodo,
    headers: { cookie: `orquestrador_acesso=${CHAVE}`, 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = { texto }; }
  if (!resp.ok) throw new Error(`${metodo} ${caminho} -> ${resp.status}: ${texto.slice(0, 300)}`);
  return json;
}
async function servidorNoAr() {
  try { await api('GET', '/orquestradores'); return true; } catch { return false; }
}
const varianteDoServidor = () => (existsSync(ARQ_VARIANTE_DO_SERVIDOR) ? readFileSync(ARQ_VARIANTE_DO_SERVIDOR, 'utf8').trim() : null);
export async function garantirServidor() {
  if (await servidorNoAr()) {
    if (VARIANTE === null || varianteDoServidor() === VARIANTE) return;
    // Instância no ar com outra variante (ou sem variante): reinicia.
    log(`instância na porta ${PORTA_C} com variante "${varianteDoServidor() ?? 'nenhuma'}"; reiniciando com "${VARIANTE}"`);
    await encerrarServidorEEsperar();
    if (await servidorNoAr()) throw new Error(`porta ${PORTA_C} ainda responde e não é uma instância subida por este harness; derrube antes`);
  }
  log('subindo a instância isolada do app (45b1b81) na porta', PORTA_C, VARIANTE ? `com BENCH_VARIANTE=${VARIANTE}` : '');
  const fd = openSync(path.join(BASE, VARIANTE ? `servidor-variante-${VARIANTE}.log` : 'servidor-c.log'), 'a');
  const filho = spawn(TSX, ['src/root.ts'], {
    cwd: APP,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: ambienteLimpo({
      PORTA: String(PORTA_C), PASTA_DADOS: DADOS_C, PASTA_RAIZ_PROJETOS: PROJETOS, ORQUESTRADOR_CHAVE_DE_ACESSO: CHAVE,
      ...(VARIANTE ? { CLAUDE_CODE_BIN: WRAPPER, BENCH_VARIANTE: VARIANTE } : { CLAUDE_CODE_BIN: CLAUDE }),
    }),
  });
  filho.unref();
  closeSync(fd);
  writeFileSync(path.join(BASE, 'servidor-c.pid'), String(filho.pid));
  if (VARIANTE) writeFileSync(ARQ_VARIANTE_DO_SERVIDOR, VARIANTE); else rmSync(ARQ_VARIANTE_DO_SERVIDOR, { force: true });
  for (let i = 0; i < 60; i += 1) {
    await dormir(1000);
    if (await servidorNoAr()) { log('instância isolada no ar, PID', filho.pid); return; }
  }
  throw new Error('a instância isolada do app não subiu em 60 s');
}
export function encerrarServidor() {
  const arq = path.join(BASE, 'servidor-c.pid');
  if (!existsSync(arq)) return;
  const pid = Number(readFileSync(arq, 'utf8'));
  try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch {} }
  rmSync(arq, { force: true });
  rmSync(ARQ_VARIANTE_DO_SERVIDOR, { force: true });
  log('instância isolada encerrada, PID', pid);
}
// Encerra e espera a porta parar de responder (SIGKILL no grupo após 15 s).
export async function encerrarServidorEEsperar() {
  const arq = path.join(BASE, 'servidor-c.pid');
  const pid = existsSync(arq) ? Number(readFileSync(arq, 'utf8')) : null;
  encerrarServidor();
  for (let i = 0; i < 15 && await servidorNoAr(); i += 1) await dormir(1000);
  if (pid) { try { process.kill(-pid, 'SIGKILL'); } catch {} }
}

// ---------------- transcrições: primeira chamada e chamadas de ferramenta ----------------
// Primeira chamada (tokens de entrada) do Orquestrador e de cada executor, chamadas ao modelo e de ferramenta por papel.
export function analisarTranscricoes(sessoes) {
  const raiz = path.join(os.homedir(), '.claude', 'projects');
  const achar = (s) => { for (const d of readdirSync(raiz)) { const f = path.join(raiz, d, `${s}.jsonl`); if (existsSync(f)) return f; } return null; };
  const ler = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const primeira = (linhas) => {
    const u = linhas.find((m) => m.type === 'assistant' && m.message?.usage && m.message?.model !== '<synthetic>')?.message.usage;
    if (!u) return null;
    const e = u.input_tokens ?? 0; const c = u.cache_creation_input_tokens ?? 0; const l = u.cache_read_input_tokens ?? 0;
    return { entrada: e, criacaoDeCache: c, leituraDeCache: l, total: e + c + l };
  };
  const contar = (linhas) => {
    const msgs = new Set(); const ferramentas = new Set(); const porFerramenta = {};
    for (const m of linhas) {
      if (m.type !== 'assistant' || m.message?.model === '<synthetic>') continue;
      if (m.message?.id) msgs.add(m.message.id);
      for (const b of Array.isArray(m.message?.content) ? m.message.content : []) {
        if (b?.type === 'tool_use' && b.id && !ferramentas.has(b.id)) { ferramentas.add(b.id); porFerramenta[b.name] = (porFerramenta[b.name] ?? 0) + 1; }
      }
    }
    return { chamadasAoModelo: msgs.size, chamadasDeFerramenta: ferramentas.size, porFerramenta };
  };
  const r = { orquestrador: null, executores: [], encontradas: 0 };
  const somar = (alvo, x) => { alvo.chamadasAoModelo += x.chamadasAoModelo; alvo.chamadasDeFerramenta += x.chamadasDeFerramenta; for (const [k, v] of Object.entries(x.porFerramenta)) alvo.porFerramenta[k] = (alvo.porFerramenta[k] ?? 0) + v; };
  const principal = { chamadasAoModelo: 0, chamadasDeFerramenta: 0, porFerramenta: {} };
  const subagentes = { chamadasAoModelo: 0, chamadasDeFerramenta: 0, porFerramenta: {} };
  for (const s of sessoes) {
    const arq = achar(s);
    if (!arq) continue;
    r.encontradas += 1;
    const linhas = ler(arq);
    if (r.orquestrador === null) r.orquestrador = { sessao: s, primeiraChamada: primeira(linhas) };
    somar(principal, contar(linhas));
    const pastaSub = path.join(arq.replace(/\.jsonl$/, ''), 'subagents');
    if (!existsSync(pastaSub)) continue;
    for (const f of readdirSync(pastaSub).filter((x) => x.endsWith('.jsonl'))) {
      const meta = (() => { try { return JSON.parse(readFileSync(path.join(pastaSub, f.replace(/\.jsonl$/, '.meta.json')), 'utf8')); } catch { return null; } })();
      if (/compact/i.test(f)) continue;
      const ls = ler(path.join(pastaSub, f));
      somar(subagentes, contar(ls));
      r.executores.push({ arquivo: f, tipo: meta?.agentType ?? null, inicio: ls[0]?.timestamp ?? null, primeiraChamada: primeira(ls) });
    }
  }
  r.executores.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
  r.principal = principal;
  r.subagentes = subagentes;
  return r;
}

function lerEventos(orqId) {
  const arq = path.join(DADOS_C, 'orquestradores', orqId, 'eventos.jsonl');
  if (!existsSync(arq)) return [];
  return readFileSync(arq, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const tipoDe = (e) => e.evento?.tipo ?? e.tipo;
const corpoDe = (e) => e.evento ?? e;

export const CONFIGURACAO_C = {
  motorDoOrquestrador: 'claude-code', modeloDoOrquestrador: 'sonnet', esforcoDoOrquestrador: 'medio',
  motorDosSubagentes: 'claude-code', modeloDosSubagentes: 'sonnet', esforcoDosSubagentes: 'medio',
  ordemDeReserva: [], navegadorDoAgente: false, quantidadeDeSubagentes: { modo: 'automatica', limite: 3 },
  nivelDePermissao: 'edicao_e_comandos', permitirCommitEPush: false, permitirArtefatosOnline: false, instrucoesPersonalizadas: '',
};

async function rodarApp(id, prompt, dir) {
  await garantirServidor();
  const orq = await api('POST', '/orquestradores', { nome: `bench ${id}`, pastaDeTrabalho: dir, ...CONFIGURACAO_C });
  const orqId = orq.id;
  const inicio = Date.now();
  await api('POST', `/orquestradores/${orqId}/mensagens`, { texto: prompt });
  const acoes = [];
  let fimMs = null;
  let estourou = false;
  let processados = 0; // quantos fins de turno já tratamos
  let aprovacoes = 0;
  let respostasAPerguntas = 0;
  for (;;) {
    if (Date.now() - inicio > LIMITE_MS) {
      estourou = true;
      try { await api('POST', `/orquestradores/${orqId}/cancelar`); } catch {}
      await dormir(15_000);
      break;
    }
    await dormir(3000);
    const evs = lerEventos(orqId);
    const fins = evs.filter((e) => /^turno_(concluido|falhou|cancelado|interrompido)$/.test(tipoDe(e)));
    const iniciados = evs.filter((e) => tipoDe(e) === 'turno_iniciado').length;
    if (fins.length <= processados || fins.length < iniciados) continue;
    // Espera a autorrecuperação (ADR-36) ou um turno novo antes de concluir.
    await dormir(20_000);
    const evs2 = lerEventos(orqId);
    const fins2 = evs2.filter((e) => /^turno_(concluido|falhou|cancelado|interrompido)$/.test(tipoDe(e)));
    const iniciados2 = evs2.filter((e) => tipoDe(e) === 'turno_iniciado').length;
    if (iniciados2 > fins2.length) continue; // retomada em andamento
    processados = fins2.length;
    const ultimo = corpoDe(fins2.at(-1));
    const emDoFim = Date.parse(fins2.at(-1).em ?? ultimo.em ?? '');
    fimMs = Number.isFinite(emDoFim) ? emDoFim - inicio : Date.now() - 20_000 - inicio;
    if (tipoDe(fins2.at(-1)) === 'turno_concluido' && ultimo.planoPendente && aprovacoes < 3) {
      aprovacoes += 1;
      acoes.push({ em: new Date().toISOString(), acao: 'plano/aprovar' });
      log(`  [C] plano pendente: aprovando (${aprovacoes})`);
      await api('POST', `/orquestradores/${orqId}/plano/aprovar`, {});
      continue;
    }
    if (tipoDe(fins2.at(-1)) === 'turno_concluido' && (ultimo.perguntas?.length ?? 0) > 0 && respostasAPerguntas < 1) {
      respostasAPerguntas += 1;
      acoes.push({ em: new Date().toISOString(), acao: 'mensagem', texto: 'Decida você e siga até o fim.' });
      log('  [C] perguntas na resposta: respondendo "Decida você e siga até o fim."');
      await api('POST', `/orquestradores/${orqId}/mensagens`, { texto: 'Decida você e siga até o fim.' });
      continue;
    }
    break;
  }
  // O consumo medido vem depois do fim do turno.
  for (let i = 0; i < 30; i += 1) {
    const evs = lerEventos(orqId);
    const fins = evs.filter((e) => /^turno_(concluido|falhou|cancelado|interrompido)$/.test(tipoDe(e))).length;
    const medidos = evs.filter((e) => tipoDe(e) === 'consumo_do_turno_medido').length;
    if (medidos >= fins) break;
    await dormir(3000);
  }
  const evs = lerEventos(orqId);
  const orqJson = JSON.parse(readFileSync(path.join(DADOS_C, 'orquestradores', orqId, 'orquestrador.json'), 'utf8'));
  const sessoes = [...new Set([orqJson.sessaoId, ...evs.filter((e) => tipoDe(e) === 'sessao_iniciada').map((e) => corpoDe(e).sessaoDoMotor)].filter(Boolean))];
  const contagem = {};
  for (const e of evs) contagem[tipoDe(e)] = (contagem[tipoDe(e)] ?? 0) + 1;
  const fins = evs.filter((e) => /^turno_(concluido|falhou|cancelado|interrompido)$/.test(tipoDe(e)));
  const ultimoFim = fins.at(-1);
  const consumos = evs.filter((e) => tipoDe(e) === 'consumo_do_turno_medido').map((e) => corpoDe(e).consumo);
  const cotas = evs.filter((e) => tipoDe(e) === 'uso_da_cota').map((e) => ({ em: e.em ?? null, janelas: corpoDe(e).janelas }));
  const falhas = evs.filter((e) => tipoDe(e) === 'turno_falhou').map((e) => corpoDe(e).motivo);
  const recuperacoes = evs.filter((e) => tipoDe(e) === 'recuperacao_do_turno').map((e) => corpoDe(e));
  // O app trabalha numa worktree própria (dados-c/worktrees/<id8>), não na pasta indicada.
  const worktree = orqJson.worktree?.caminho && existsSync(orqJson.worktree.caminho) ? orqJson.worktree.caminho : null;
  return {
    orqId, sessoes, acoes, estourou, tempoMs: fimMs ?? Date.now() - inicio,
    worktree, pastaEfetiva: worktree ?? dir,
    turnosDoApp: contagem.turno_iniciado ?? 0,
    contagemDeEventos: contagem,
    fimDoTurno: ultimoFim ? tipoDe(ultimoFim) : null,
    resposta: ultimoFim && tipoDe(ultimoFim) === 'turno_concluido' ? corpoDe(ultimoFim).resposta : '',
    usoDoTurno: fins.filter((e) => tipoDe(e) === 'turno_concluido').map((e) => corpoDe(e).uso),
    consumos, cotas, falhas, recuperacoes,
    subagentesIniciados: contagem.subagente_iniciado ?? 0,
  };
}

// Guarda eventos e estado do orquestrador da C e remove o orquestrador e as pastas temporárias.
async function arquivarERemoverC(orqId, pastaSaida, id) {
  const base = path.join(DADOS_C, 'orquestradores', orqId);
  for (const [nome, destino] of [['eventos.jsonl', `${id}.eventos.jsonl`], ['orquestrador.json', `${id}.orquestrador.json`]]) {
    try { cpSync(path.join(base, nome), path.join(pastaSaida, destino)); } catch {}
  }
  try { await api('DELETE', `/orquestradores/${orqId}`); } catch (erro) { log(`   aviso: não removi o orquestrador ${orqId}: ${String(erro).slice(0, 200)}`); }
}
function limparPastas(...pastas) {
  for (const p of pastas) {
    if (p && p.startsWith(BASE + '/')) rmSync(p, { recursive: true, force: true });
  }
}

// ---------------- medição pelas transcrições ----------------
function medir(dir, sessoes) {
  const r = spawnSync(TSX, [path.join(aqui, 'medir.ts'), JSON.stringify({ pasta: dir, sessoes })], {
    cwd: APP, encoding: 'utf8', env: ambienteLimpo(), maxBuffer: 50e6, timeout: 180_000,
  });
  if (r.status !== 0) return { erro: (r.stderr || r.stdout || '').slice(-1500) };
  return JSON.parse(r.stdout);
}

function somarConsumos(consumos) {
  const soma = { principal: { entrada: 0, criacaoDeCache: 0, leituraDeCache: 0, saida: 0 }, subagentes: { entrada: 0, criacaoDeCache: 0, leituraDeCache: 0, saida: 0 }, indiceDeCusto: 0, subagentesMedidos: 0, modelos: [] };
  for (const c of consumos) {
    for (const p of ['principal', 'subagentes']) for (const k of Object.keys(soma[p])) soma[p][k] += c[p]?.[k] ?? 0;
    soma.indiceDeCusto += c.indiceDeCusto ?? 0;
    soma.subagentesMedidos += c.subagentesMedidos ?? 0;
    if (c.modeloDoPrincipal) soma.modelos.push(c.modeloDoPrincipal);
  }
  return soma;
}

// ---------------- uma execução ----------------
async function executar(item, pastaSaida) {
  const { id, tarefa, config } = item;
  const t = TAREFAS.tarefas[tarefa];
  const prompt = `${t.prompt}${TAREFAS.sufixo}`;
  const checador = await import(pathToFileURL(path.join(aqui, 'checar.mjs')).href);
  const tentativas = [];
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa += 1) {
    const cargaAntes = await esperarMaquina();
    log(`>> ${id} (tentativa ${tentativa}) | ${cargaAntes.uptime}`);
    const dir = prepararPasta(id);
    const inicioIso = new Date().toISOString();
    const LOG_VARIANTES = path.join(BASE, 'variantes.log');
    const linhasDoLogAntes = VARIANTE && existsSync(LOG_VARIANTES) ? readFileSync(LOG_VARIANTES, 'utf8').split('\n').filter(Boolean).length : 0;
    let bruto;
    let sessoes;
    let falhaTransitoria = null;
    const registro = { ...item, ...(VARIANTE ? { variante: VARIANTE } : {}), tentativa, prompt, pastaDeTrabalho: dir, inicio: inicioIso, carga: cargaAntes };
    try {
      if (config === 'C') {
        bruto = await rodarApp(id, prompt, dir);
        sessoes = bruto.sessoes;
        const motivo = bruto.falhas.join('\n');
        if (bruto.fimDoTurno !== 'turno_concluido' && !bruto.estourou) {
          if (SINAIS_DE_LIMITE.test(motivo)) falhaTransitoria = { tipo: 'limite', texto: motivo.slice(0, 500) };
          else if (SINAIS_TRANSITORIOS.test(motivo)) falhaTransitoria = { tipo: 'transitorio', texto: motivo.slice(0, 500) };
        }
        registro.execucao = { ...bruto, configuracaoDoOrquestrador: CONFIGURACAO_C, versaoDoApp: '45b1b81 (0.2.2)', porta: PORTA_C };
        registro.consumoDoApp = somarConsumos(bruto.consumos);
        registro.resposta = bruto.resposta;
        registro.usoDaAssinatura = { antes: bruto.cotas[0] ?? null, depois: bruto.cotas.at(-1) ?? null, leituras: bruto.cotas.length };
      } else {
        const sessao = randomUUID();
        sessoes = [sessao];
        const arqStream = path.join(pastaSaida, `${id}.stream.jsonl.gz`);
        bruto = await rodarClaude(config, prompt, dir, sessao, arqStream);
        falhaTransitoria = classificarFalhaClaude(bruto);
        const res = bruto.resultado ?? {};
        registro.execucao = {
          comando: [CLAUDE, ...bruto.args.map((a) => (a === prompt ? '<prompt>' : a))].join(' '),
          codigoDeSaida: bruto.codigo, estourou: bruto.estourou, init: bruto.init, stderrFim: bruto.stderr,
          resultadoDoClaude: { subtype: res.subtype, is_error: res.is_error, num_turns: res.num_turns, duration_ms: res.duration_ms, duration_api_ms: res.duration_api_ms, total_cost_usd: res.total_cost_usd, usage: res.usage, modelUsage: res.modelUsage },
          mensagensDoAssistenteNoStream: bruto.mensagensAssistente, resultadosNoStream: bruto.resultados,
          stream: path.basename(arqStream),
        };
        registro.resposta = res.result ?? '';
        registro.usoDaAssinatura = { antes: bruto.cotas[0] ?? null, depois: bruto.cotas.at(-1) ?? null, leituras: bruto.cotas.length };
      }
    } catch (erro) {
      falhaTransitoria = { tipo: 'transitorio', texto: String(erro?.stack ?? erro).slice(0, 800) };
      registro.erroDoHarness = falhaTransitoria.texto;
    }
    registro.fim = new Date().toISOString();
    registro.tempoDeParedeS = bruto ? Math.round(bruto.tempoMs / 100) / 10 : null;
    registro.sessoes = sessoes ?? [];
    const pastaDoResultado = config === 'C' && bruto?.pastaEfetiva ? bruto.pastaEfetiva : dir;
    registro.pastaDoResultado = pastaDoResultado;

    if (falhaTransitoria && tentativa < MAX_TENTATIVAS) {
      tentativas.push({ tentativa, em: registro.fim, ...falhaTransitoria, sessoes: registro.sessoes });
      log(`   ${id}: falha ${falhaTransitoria.tipo} (não conta), nova tentativa. ${falhaTransitoria.texto.slice(0, 200).replace(/\n/g, ' ')}`);
      if (config === 'C' && bruto?.orqId) await arquivarERemoverC(bruto.orqId, pastaSaida, `${id}.tentativa${tentativa}`);
      limparPastas(dir, bruto?.worktree);
      let espera = [120_000, 300_000, 600_000][tentativa - 1] ?? 600_000;
      if (falhaTransitoria.tipo === 'limite') {
        espera = falhaTransitoria.liberaEm ? Math.max(60_000, falhaTransitoria.liberaEm * 1000 - Date.now() + 60_000) : 15 * 60_000;
        espera = Math.min(espera, 6 * 3600_000);
      }
      log(`   esperando ${Math.round(espera / 1000)} s`);
      await dormir(espera);
      continue;
    }
    registro.tentativasAnteriores = tentativas;

    // Checador, diff e medição.
    const estourou = registro.execucao?.estourou === true;
    let checagem;
    try {
      checagem = await checador.checar(tarefa, pastaDoResultado, registro.resposta ?? '');
    } catch (erro) {
      checagem = { sucesso: false, motivo: `erro no checador: ${String(erro).slice(0, 300)}`, detalhes: {} };
    }
    if (estourou) checagem = { ...checagem, sucesso: false, motivo: `estourou o teto de 40 min | ${checagem.motivo}` };
    if (falhaTransitoria) checagem = { ...checagem, sucesso: false, motivo: `erro de API/limite após ${MAX_TENTATIVAS} tentativas: ${falhaTransitoria.texto.slice(0, 200)} | ${checagem.motivo}` };
    if (config !== 'C' && !estourou && !falhaTransitoria && registro.execucao?.resultadoDoClaude?.is_error) {
      checagem = { ...checagem, sucesso: false, motivo: `o Claude Code terminou com erro (${registro.execucao.resultadoDoClaude.subtype}) | ${checagem.motivo}` };
    }
    registro.checagem = checagem;
    registro.sucesso = checagem.sucesso;
    try {
      const diff = diffFinal(pastaDoResultado);
      writeFileSync(path.join(pastaSaida, `${id}.diff`), diff);
      registro.arquivoDoDiff = `${id}.diff`;
    } catch (erro) { registro.arquivoDoDiff = null; registro.erroDoDiff = String(erro).slice(0, 300); }
    writeFileSync(path.join(pastaSaida, `${id}.resposta.md`), registro.resposta ?? '');
    registro.arquivoDaResposta = `${id}.resposta.md`;

    const m = registro.sessoes.length > 0 ? medir(pastaDoResultado, registro.sessoes) : { erro: 'sem sessão' };
    registro.medicao = m;
    if (!m.erro) {
      const md = m.medicaoDoApp;
      registro.resumo = {
        usd: m.custo.usd, usdPrincipal: m.custo.usdPrincipal, usdSubagentes: m.custo.usdSubagentes,
        indiceDeCusto: md.indiceDeCusto,
        tokens: {
          entrada: md.total.entrada, criacaoDeCache: md.total.criacaoDeCache, leituraDeCache: md.total.leituraDeCache, saida: md.total.saida,
        },
        principal: md.principal, subagentes: md.subagentes,
        modeloDoPrincipal: md.modeloDoPrincipal,
        modelos: Object.keys(m.custo.porModelo),
        quantidadeDeSubagentes: md.subagentesLancados,
        mensagensDoModelo: md.mensagens,
        turnosDoUsuario: config === 'C' ? registro.execucao.turnosDoApp : 1,
        turnosDoAgente: config === 'C' ? null : registro.execucao.resultadoDoClaude?.num_turns ?? null,
        tempoDeParedeS: registro.tempoDeParedeS,
      };
    }
    registro.cargaDepois = carga();
    registro.avisos = [
      'Outros orquestradores rodam nesta máquina: o uso da assinatura (antes/depois) e o tempo de parede ficam contaminados por eles.',
    ];
    if (VARIANTE) {
      try { registro.transcricoes = analisarTranscricoes(registro.sessoes); } catch (erro) { registro.transcricoes = { erro: String(erro).slice(0, 300) }; }
      // Chamadas do intermediário (variantes/claude) feitas durante esta execução: prova de que a variante foi aplicada.
      const todas = existsSync(LOG_VARIANTES) ? readFileSync(LOG_VARIANTES, 'utf8').split('\n').filter(Boolean) : [];
      registro.chamadasDoIntermediario = todas.slice(linhasDoLogAntes).map((l) => {
        try { const j = JSON.parse(l); return { em: j.em, variante: j.variante, aplicadas: j.aplicadas, sessao: j.sessao, erro: j.erro, detalhes: j.detalhes }; } catch { return l; }
      });
      const alta = (c) => c?.carga1m !== null && c?.carga1m !== undefined && c.carga1m > CARGA_MAXIMA;
      registro.cargaAlta = { antes: alta(cargaAntes), depois: alta(registro.cargaDepois), carga1mAntes: cargaAntes.carga1m, carga1mDepois: registro.cargaDepois.carga1m, esperouS: cargaAntes.esperouS };
      registro.tempoComCargaAlta = registro.cargaAlta.antes || registro.cargaAlta.depois;
      if (registro.tempoComCargaAlta) registro.avisos.push(`Tempo medido com carga alta (1 min > ${CARGA_MAXIMA}): antes ${cargaAntes.carga1m}, depois ${registro.cargaDepois.carga1m}.`);
    }
    if (config === 'C' && bruto?.orqId) {
      await arquivarERemoverC(bruto.orqId, pastaSaida, id);
      registro.arquivosDoApp = [`${id}.eventos.jsonl`, `${id}.orquestrador.json`];
    }
    writeFileSync(path.join(pastaSaida, `${id}.json`), JSON.stringify(registro, null, 1));
    limparPastas(dir, bruto?.worktree);
    log(`<< ${id}: ${registro.sucesso ? 'SUCESSO' : 'FALHA'} | ${checagem.motivo.slice(0, 160)} | US$ ${registro.resumo?.usd?.toFixed(4) ?? '?'} | ${registro.tempoDeParedeS}s | modelo ${registro.resumo?.modeloDoPrincipal ?? '?'} | subagentes ${registro.resumo?.quantidadeDeSubagentes ?? '?'}`);
    return registro;
  }
  return null;
}

// ---------------- principal ----------------
async function principal() {
  const args = process.argv.slice(2);
  if (args[0] === '--fumaca') {
    const tarefa = args[1] ?? 'T1';
    const cfgs = (args[2] ?? 'A,B,C').split(',');
    const saida = path.join(RAIZ, 'fumaca');
    mkdirSync(saida, { recursive: true });
    for (const c of cfgs) {
      const id = `fumaca-${tarefa}-${c}`;
      if (existsSync(path.join(saida, `${id}.json`))) { log(`pulando ${id} (já existe)`); continue; }
      await executar({ id, rodada: 0, tarefa, config: c, posicao: 0 }, saida);
    }
    log('fumaça concluída (instância isolada mantida no ar)');
    return;
  }
  if (args[0] === '--variante') {
    VARIANTE = (args[1] ?? '').trim().toLowerCase();
    if (!/^[a-z0-9,-]+$/.test(VARIANTE) || VARIANTE === 'base') throw new Error('uso: node harness.mjs --variante <v1|v2|v3|v5|vr|combinação>');
    MAX_TENTATIVAS = 3; // 1 + até 2 repetições por erro de API
    const saida = path.join(RAIZ, 'execucoes-variantes', VARIANTE.replace(/,/g, '+'));
    mkdirSync(saida, { recursive: true });
    const lista = [];
    for (let r = 1; r <= RODADAS; r += 1) for (const t of IDS_DAS_TAREFAS) lista.push({ id: `r${r}-${t}-C`, rodada: r, tarefa: t, config: 'C', posicao: 1 });
    rmSync(path.join(saida, 'FIM'), { force: true });
    log(`variante ${VARIANTE}: ${lista.length} execuções em ${saida}; já feitas: ${lista.filter((i) => existsSync(path.join(saida, `${i.id}.json`))).length}`);
    let situacao = 'interrompido por erro do harness; rode de novo para retomar';
    try {
      for (const [n, item] of lista.entries()) {
        if (existsSync(path.join(saida, `${item.id}.json`))) continue;
        log(`=== ${VARIANTE} ${n + 1}/${lista.length}`);
        await executar(item, saida);
      }
      situacao = 'todas as execuções concluídas';
    } finally {
      log(`${situacao}; rodando analisar-variantes.mjs`);
      const a = spawnSync(process.execPath, [path.join(aqui, 'analisar-variantes.mjs')], { encoding: 'utf8' });
      log(a.stdout, a.stderr);
      await encerrarServidorEEsperar();
      writeFileSync(path.join(saida, 'FIM'), `fim em ${new Date().toISOString()}: ${situacao}\n`);
      log('FIM');
    }
    return;
  }
  const saida = path.join(RAIZ, 'execucoes');
  mkdirSync(saida, { recursive: true });
  const lista = plano();
  writeFileSync(path.join(RAIZ, 'plano.json'), JSON.stringify({ semente: SEMENTE, algoritmo: 'mulberry32 + Fisher-Yates por (rodada, tarefa)', execucoes: lista }, null, 1));
  log(`plano: ${lista.length} execuções; já feitas: ${lista.filter((i) => existsSync(path.join(saida, `${i.id}.json`))).length}`);
  let situacao = 'interrompido por erro do harness (ver execucao.log); rode de novo para retomar';
  try {
    for (const [n, item] of lista.entries()) {
      if (existsSync(path.join(saida, `${item.id}.json`))) continue;
      log(`=== ${n + 1}/${lista.length}`);
      await executar(item, saida);
    }
    situacao = 'todas as execuções concluídas';
  } finally {
    log(`${situacao}; rodando analisar.mjs`);
    const a = spawnSync(process.execPath, [path.join(aqui, 'analisar.mjs')], { encoding: 'utf8' });
    log(a.stdout, a.stderr);
    encerrarServidor();
    writeFileSync(path.join(RAIZ, 'FIM'), `fim em ${new Date().toISOString()}: ${situacao}\n`);
    log('FIM');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  principal().catch((erro) => { console.error(erro); process.exitCode = 1; });
}
