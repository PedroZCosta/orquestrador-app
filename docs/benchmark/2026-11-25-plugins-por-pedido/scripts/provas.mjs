// Provas de comportamento da escolha de plugins por pedido, com o código desta worktree.
// Sobe uma instância isolada (porta 3317, PASTA_DADOS=/tmp/bench-gosub/dados-c, Claude Code real, sem intermediário),
// cria um projeto de teste em /tmp/bench-gosub/projetos, roda os 4 pedidos em sequência e grava provas.json ao lado
// desta pasta (com eventos plugins_escolhidos, ferramentas Skill das transcrições, primeira chamada de cada turno e
// custo). Ao fim encerra a instância. Uso: node provas.mjs <pasta-do-app>
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ENTREGA = path.join(aqui, '..');
const HARNESS = path.join(aqui, '..', '..', '2026-11-22', 'scripts');
const { CONFIGURACAO_C } = await import(pathToFileURL(path.join(HARNESS, 'harness.mjs')).href);

const APP = path.resolve(process.argv[2] ?? path.join(aqui, '..', '..', '..', '..'));
const BASE = `${realpathSync('/tmp')}/bench-gosub`;
const PROJETOS = path.join(BASE, 'projetos');
const DADOS = path.join(BASE, 'dados-c');
const PORTA = 3317;
const CHAVE = readFileSync(path.join(BASE, 'chave'), 'utf8').trim();
const CLAUDE = '/opt/homebrew/bin/claude';
const TSX = path.join(APP, 'node_modules', '.bin', 'tsx');
const TSX_DA_MEDICAO = path.join(BASE, 'app-45b1b81', 'node_modules', '.bin', 'tsx');
const LIMITE_MS = 15 * 60_000;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function ambienteLimpo(extra) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(CLAUDE|AI_AGENT|ORQUESTRADOR_|BENCH_)/.test(k)) delete env[k];
  env.PATH = `/opt/homebrew/bin:/usr/local/bin:${env.PATH ?? '/usr/bin:/bin'}`;
  return { ...env, ...extra };
}

async function api(metodo, caminho, corpo) {
  const resp = await fetch(`http://127.0.0.1:${PORTA}/api${caminho}`, {
    method: metodo,
    headers: { cookie: `orquestrador_acesso=${CHAVE}`, 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  if (!resp.ok) throw new Error(`${metodo} ${caminho} -> ${resp.status}: ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}
const noAr = async () => { try { await api('GET', '/orquestradores'); return true; } catch { return false; } };

// ---------------- instância ----------------
let pidDoServidor = null;
async function subir() {
  if (await noAr()) throw new Error(`a porta ${PORTA} já responde; derrube a instância antes`);
  const fd = openSync(path.join(BASE, 'servidor-provas.log'), 'a');
  const filho = spawn(TSX, ['src/root.ts'], {
    cwd: APP, detached: true, stdio: ['ignore', fd, fd],
    env: ambienteLimpo({ PORTA: String(PORTA), PASTA_DADOS: DADOS, PASTA_RAIZ_PROJETOS: PROJETOS, ORQUESTRADOR_CHAVE_DE_ACESSO: CHAVE, CLAUDE_CODE_BIN: CLAUDE }),
  });
  filho.unref();
  closeSync(fd);
  pidDoServidor = filho.pid;
  for (let i = 0; i < 60; i += 1) {
    await dormir(1000);
    if (await noAr()) { log('instância no ar, PID', filho.pid); return; }
  }
  throw new Error('a instância não subiu em 60 s');
}
async function encerrar() {
  if (pidDoServidor === null) return;
  try { process.kill(-pidDoServidor, 'SIGTERM'); } catch {}
  for (let i = 0; i < 15 && await noAr(); i += 1) await dormir(1000);
  try { process.kill(-pidDoServidor, 'SIGKILL'); } catch {}
  log('instância encerrada, PID', pidDoServidor, '| porta responde:', await noAr());
}

// ---------------- projeto de teste ----------------
function criarProjeto() {
  const dir = path.join(PROJETOS, `prova-plugins-${Date.now().toString(36)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'README.md'), '# Projeto de teste\n\nEste projeto e um exenplo simples para as provas da escolha de plugins.\n');
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><title>Teste</title></head><body><h1>Teste</h1></body></html>\n');
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', env: { ...ambienteLimpo({}), GIT_AUTHOR_NAME: 'bench', GIT_AUTHOR_EMAIL: 'bench@local', GIT_COMMITTER_NAME: 'bench', GIT_COMMITTER_EMAIL: 'bench@local' } });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'estado inicial');
  return dir;
}

// ---------------- eventos e transcrições ----------------
const tipoDe = (e) => e.evento?.tipo ?? e.tipo;
const corpoDe = (e) => e.evento ?? e;
function eventos(orqId) {
  const arq = path.join(DADOS, 'orquestradores', orqId, 'eventos.jsonl');
  if (!existsSync(arq)) return [];
  return readFileSync(arq, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const FIM = /^turno_(concluido|falhou|cancelado|interrompido)$/;

async function esperarTurno(orqId, finsAntes) {
  const inicio = Date.now();
  for (;;) {
    if (Date.now() - inicio > LIMITE_MS) { try { await api('POST', `/orquestradores/${orqId}/cancelar`); } catch {} throw new Error('turno passou de 15 min'); }
    await dormir(3000);
    const evs = eventos(orqId);
    const fins = evs.filter((e) => FIM.test(tipoDe(e))).length;
    const iniciados = evs.filter((e) => tipoDe(e) === 'turno_iniciado').length;
    if (fins <= finsAntes || fins < iniciados) continue;
    await dormir(15_000); // autorrecuperação
    const evs2 = eventos(orqId);
    if (evs2.filter((e) => tipoDe(e) === 'turno_iniciado').length > evs2.filter((e) => FIM.test(tipoDe(e))).length) continue;
    for (let i = 0; i < 30; i += 1) {
      const e3 = eventos(orqId);
      if (e3.filter((e) => tipoDe(e) === 'consumo_do_turno_medido').length >= e3.filter((e) => FIM.test(tipoDe(e))).length) break;
      await dormir(2000);
    }
    return Date.now() - inicio;
  }
}

const raizDasTranscricoes = path.join(os.homedir(), '.claude', 'projects');
function acharTranscricao(sessao) {
  for (const d of readdirSync(raizDasTranscricoes)) { const f = path.join(raizDasTranscricoes, d, `${sessao}.jsonl`); if (existsSync(f)) return f; }
  return null;
}
const lerJsonl = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
function primeiraChamada(linhas, desde) {
  const u = linhas.find((m) => m.type === 'assistant' && m.message?.usage && m.message?.model !== '<synthetic>' && (m.timestamp ?? '') >= desde)?.message.usage;
  if (!u) return null;
  const e = u.input_tokens ?? 0; const c = u.cache_creation_input_tokens ?? 0; const l = u.cache_read_input_tokens ?? 0;
  return { entrada: e, criacaoDeCache: c, leituraDeCache: l, total: e + c + l };
}
function skillsUsadas(linhas, desde, onde) {
  const usadas = [];
  for (const m of linhas) {
    if (m.type !== 'assistant' || (m.timestamp ?? '') < desde) continue;
    for (const b of Array.isArray(m.message?.content) ? m.message.content : []) {
      if (b?.type === 'tool_use' && b.name === 'Skill') usadas.push({ onde, em: m.timestamp, entrada: b.input });
    }
  }
  return usadas;
}
// Transcrições do turno (desde o início dele): Orquestrador e subagentes.
function transcricoesDoTurno(sessao, desde) {
  const arq = acharTranscricao(sessao);
  if (!arq) return { sessao, encontrada: false };
  const linhas = lerJsonl(arq);
  const r = { sessao, encontrada: true, primeiraDoOrquestrador: primeiraChamada(linhas, desde), primeiraDoExecutor: null, skills: skillsUsadas(linhas, desde, 'orquestrador'), subagentes: 0 };
  const pastaSub = path.join(arq.replace(/\.jsonl$/, ''), 'subagents');
  if (existsSync(pastaSub)) {
    const subs = readdirSync(pastaSub).filter((f) => f.endsWith('.jsonl') && !/compact/i.test(f)).map((f) => lerJsonl(path.join(pastaSub, f)))
      .filter((ls) => (ls[0]?.timestamp ?? '') >= desde).sort((a, b) => String(a[0]?.timestamp).localeCompare(String(b[0]?.timestamp)));
    r.subagentes = subs.length;
    r.primeiraDoExecutor = subs.length ? primeiraChamada(subs[0], desde) : null;
    for (const [i, ls] of subs.entries()) r.skills.push(...skillsUsadas(ls, desde, `subagente ${i + 1}`));
  }
  return r;
}
function medirUsd(pasta, sessoes) {
  const r = spawnSync(TSX_DA_MEDICAO, [path.join(HARNESS, 'medir.ts'), JSON.stringify({ pasta, sessoes })], {
    cwd: path.join(BASE, 'app-45b1b81'), encoding: 'utf8', env: ambienteLimpo({}), maxBuffer: 50e6, timeout: 180_000,
  });
  if (r.status !== 0) return null;
  const m = JSON.parse(r.stdout);
  return { usd: m.custo.usd, indiceDeCusto: m.medicaoDoApp.indiceDeCusto };
}

// ---------------- um pedido ----------------
async function pedir(nome, orqId, texto) {
  const evsAntes = eventos(orqId);
  const finsAntes = evsAntes.filter((e) => FIM.test(tipoDe(e))).length;
  const desde = new Date().toISOString();
  log(`>> ${nome}: "${texto}"`);
  await api('POST', `/orquestradores/${orqId}/mensagens`, { texto });
  const duracaoMs = await esperarTurno(orqId, finsAntes);
  const novos = eventos(orqId).slice(evsAntes.length);
  const orq = JSON.parse(readFileSync(path.join(DADOS, 'orquestradores', orqId, 'orquestrador.json'), 'utf8'));
  const fim = novos.filter((e) => FIM.test(tipoDe(e))).at(-1);
  const r = {
    nome, orqId, texto, desde, duracaoS: Math.round(duracaoMs / 100) / 10,
    pluginsEscolhidos: novos.filter((e) => tipoDe(e) === 'plugins_escolhidos').map((e) => corpoDe(e).escolha),
    fimDoTurno: fim ? tipoDe(fim) : null,
    resposta: fim ? String(corpoDe(fim).resposta ?? corpoDe(fim).motivo ?? '').slice(0, 1500) : '',
    consumoDoApp: novos.filter((e) => tipoDe(e) === 'consumo_do_turno_medido').map((e) => corpoDe(e).consumo),
    sessao: orq.sessaoId,
    pasta: orq.worktree?.caminho ?? orq.pastaDeTrabalho,
  };
  r.transcricoes = transcricoesDoTurno(orq.sessaoId, desde);
  r.medicaoAcumuladaDaSessao = medirUsd(r.pasta, [orq.sessaoId]);
  log(`<< ${nome}: ${r.fimDoTurno} | escolha ${JSON.stringify(r.pluginsEscolhidos.map((e) => ({ p: e.plugins, s: e.skills, o: e.origem })))} | Skill: ${JSON.stringify(r.transcricoes.skills?.map((s) => s.entrada))} | US$ sessão ${r.medicaoAcumuladaDaSessao?.usd?.toFixed(4)}`);
  return r;
}

async function principal() {
  const projeto = criarProjeto();
  log('projeto de teste', projeto, '| app', APP);
  await subir();
  const resultado = { em: new Date().toISOString(), app: APP, porta: PORTA, dados: DADOS, projeto, configuracao: CONFIGURACAO_C, provas: [] };
  const criar = async (nome) => (await api('POST', '/orquestradores', { nome, pastaDeTrabalho: projeto, ...CONFIGURACAO_C })).id;
  try {
    const orq1 = await criar('prova 1 e 3: gráfico');
    resultado.provas.push(await pedir('1. sem citar, skill útil', orq1, 'crie um gráfico de barras em HTML com estes dados: jan 10, fev 14, mar 9'));
    resultado.provas.push(await pedir('3. continuação na mesma sessão', orq1, 'Plano aprovado. continue'));
    const orq2 = await criar('prova 2: citado');
    resultado.provas.push(await pedir('2. citando o plugin', orq2, 'use o logo-design para esboçar um ícone simples em SVG de uma xícara'));
    const orq4 = await criar('prova 4: pedido comum');
    resultado.provas.push(await pedir('4. pedido comum', orq4, 'corrija o typo em README'));
  } catch (erro) {
    resultado.erro = String(erro?.stack ?? erro).slice(0, 1500);
    log('ERRO', resultado.erro);
  } finally {
    writeFileSync(path.join(ENTREGA, 'provas.json'), `${JSON.stringify(resultado, null, 1)}\n`);
    // Cópia dos eventos de cada orquestrador das provas.
    for (const id of [...new Set(resultado.provas.map((p) => p.orqId))]) {
      try { cpSync(path.join(DADOS, 'orquestradores', id, 'eventos.jsonl'), path.join(ENTREGA, 'dados', `provas-${id.slice(0, 8)}.eventos.jsonl`)); } catch {}
    }
    await encerrar();
  }
}
mkdirSync(path.join(ENTREGA, 'dados'), { recursive: true });
principal().catch((erro) => { console.error(erro); process.exitCode = 1; });
