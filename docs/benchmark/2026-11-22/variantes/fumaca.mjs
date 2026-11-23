// Fumaça das variantes: para cada variante, sobe a instância isolada do app (45b1b81) com CLAUDE_CODE_BIN apontando
// para ./claude e BENCH_VARIANTE definida, roda a T1 uma vez pela API, checa, mede e derruba a instância.
// Uso: node fumaca.mjs base v1 v2 v3   (em sequência; pula variante que já tem fumaca/<id>.json)
import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const SCRIPTS = path.join(RAIZ, 'scripts');
const BASE = realpathSync('/tmp') + '/bench-gosub';
const APP = path.join(BASE, 'app-45b1b81');
const PROJETOS = path.join(BASE, 'projetos');
const DADOS_C = path.join(BASE, 'dados-c');
const PORTA = 3317;
const CHAVE = readFileSync(path.join(BASE, 'chave'), 'utf8').trim();
const TSX = path.join(APP, 'node_modules', '.bin', 'tsx');
const WRAPPER = path.join(AQUI, 'claude');
const SAIDA = path.join(AQUI, 'fumaca');
const TAREFA = process.env.FUMACA_TAREFA ?? 'T1';
const LIMITE_MS = 20 * 60_000;
const TAREFAS = JSON.parse(readFileSync(path.join(RAIZ, 'tarefas.json'), 'utf8'));
const { CONFIGURACAO_C } = await import(pathToFileURL(path.join(SCRIPTS, 'harness.mjs')).href);
const { checar } = await import(pathToFileURL(path.join(SCRIPTS, 'checar.mjs')).href);

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function ambiente(extra) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^(CLAUDE|AI_AGENT|ORQUESTRADOR_|BENCH_)/.test(k)) delete env[k];
  env.PATH = `/opt/homebrew/bin:/usr/local/bin:${path.dirname(process.execPath)}:${env.PATH ?? '/usr/bin:/bin'}`;
  return { ...env, ...extra };
}

async function esperarCarga() {
  const inicio = Date.now();
  const leituras = [];
  for (;;) {
    const up = execSync('uptime', { encoding: 'utf8' }).trim();
    const m1 = Number(up.match(/load averages?:\s*([\d.,]+)/)?.[1]?.replace(',', '.'));
    leituras.push(up);
    if (!(m1 > 6) || Date.now() - inicio >= 5 * 60_000) return { leituras, esperouS: Math.round((Date.now() - inicio) / 1000), carga1m: m1 };
    log(`carga ${m1} acima de 6, esperando 30 s`);
    await dormir(30_000);
  }
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

async function subir(variante) {
  if (await noAr()) throw new Error(`já há algo respondendo na porta ${PORTA}; derrube antes`);
  const fd = openSync(path.join(BASE, `servidor-variante-${variante}.log`), 'a');
  const filho = spawn(TSX, ['src/root.ts'], {
    cwd: APP, detached: true, stdio: ['ignore', fd, fd],
    env: ambiente({
      PORTA: String(PORTA), PASTA_DADOS: DADOS_C, PASTA_RAIZ_PROJETOS: PROJETOS, ORQUESTRADOR_CHAVE_DE_ACESSO: CHAVE,
      CLAUDE_CODE_BIN: WRAPPER, BENCH_VARIANTE: variante,
    }),
  });
  filho.unref();
  closeSync(fd);
  writeFileSync(path.join(BASE, 'servidor-variante.pid'), String(filho.pid));
  for (let i = 0; i < 60; i += 1) { await dormir(1000); if (await noAr()) return filho.pid; }
  throw new Error('a instância não subiu em 60 s');
}
async function derrubar(pid) {
  try { process.kill(-pid, 'SIGTERM'); } catch {}
  for (let i = 0; i < 10 && await noAr(); i += 1) await dormir(1000);
  try { process.kill(-pid, 'SIGKILL'); } catch {}
  rmSync(path.join(BASE, 'servidor-variante.pid'), { force: true });
}

function prepararPasta(id) {
  mkdirSync(PROJETOS, { recursive: true });
  const dir = path.join(PROJETOS, `${id}-${Date.now().toString(36)}`);
  cpSync(path.join(RAIZ, 'fixture'), dir, { recursive: true });
  const env = { ...ambiente({}), GIT_AUTHOR_NAME: 'bench', GIT_AUTHOR_EMAIL: 'bench@local', GIT_COMMITTER_NAME: 'bench', GIT_COMMITTER_EMAIL: 'bench@local' };
  for (const a of [['init', '-q', '-b', 'main'], ['add', '-A'], ['commit', '-q', '-m', 'estado inicial da fixture']]) execFileSync('git', ['-C', dir, ...a], { env });
  return dir;
}

const tipoDe = (e) => e.evento?.tipo ?? e.tipo;
const corpoDe = (e) => e.evento ?? e;
function eventos(orqId) {
  const arq = path.join(DADOS_C, 'orquestradores', orqId, 'eventos.jsonl');
  if (!existsSync(arq)) return [];
  return readFileSync(arq, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const FIM = /^turno_(concluido|falhou|cancelado|interrompido)$/;

async function rodarT(orqId, prompt) {
  const inicio = Date.now();
  await api('POST', `/orquestradores/${orqId}/mensagens`, { texto: prompt });
  let processados = 0; let aprovacoes = 0; let respostas = 0;
  for (;;) {
    if (Date.now() - inicio > LIMITE_MS) { try { await api('POST', `/orquestradores/${orqId}/cancelar`); } catch {} await dormir(10_000); return { estourou: true }; }
    await dormir(3000);
    let evs = eventos(orqId);
    let fins = evs.filter((e) => FIM.test(tipoDe(e)));
    if (fins.length <= processados || fins.length < evs.filter((e) => tipoDe(e) === 'turno_iniciado').length) continue;
    await dormir(15_000);
    evs = eventos(orqId);
    fins = evs.filter((e) => FIM.test(tipoDe(e)));
    if (evs.filter((e) => tipoDe(e) === 'turno_iniciado').length > fins.length) continue;
    processados = fins.length;
    const ultimo = corpoDe(fins.at(-1));
    if (tipoDe(fins.at(-1)) === 'turno_concluido' && ultimo.planoPendente && aprovacoes < 3) { aprovacoes += 1; log('  plano pendente: aprovando'); await api('POST', `/orquestradores/${orqId}/plano/aprovar`, {}); continue; }
    if (tipoDe(fins.at(-1)) === 'turno_concluido' && (ultimo.perguntas?.length ?? 0) > 0 && respostas < 1) { respostas += 1; await api('POST', `/orquestradores/${orqId}/mensagens`, { texto: 'Decida você e siga até o fim.' }); continue; }
    // espera o consumo medido
    for (let i = 0; i < 20; i += 1) {
      const e2 = eventos(orqId);
      if (e2.filter((e) => tipoDe(e) === 'consumo_do_turno_medido').length >= e2.filter((e) => FIM.test(tipoDe(e))).length) break;
      await dormir(3000);
    }
    return { estourou: false, tempoS: Math.round((Date.now() - inicio) / 1000), aprovacoes, respostas };
  }
}

// Transcrições do Claude Code: primeira chamada (uso), anexos e marcas no contexto.
function analisarTranscricoes(sessoes) {
  const raiz = path.join(os.homedir(), '.claude', 'projects');
  const achar = (s) => { for (const d of readdirSync(raiz)) { const f = path.join(raiz, d, `${s}.jsonl`); if (existsSync(f)) return f; } return null; };
  const r = [];
  for (const s of sessoes) {
    const arq = achar(s);
    if (!arq) { r.push({ sessao: s, arquivo: null }); continue; }
    const arquivos = [{ papel: 'principal', arq }];
    const pastaSub = path.join(arq.replace(/\.jsonl$/, ''), 'subagents');
    if (existsSync(pastaSub)) for (const f of readdirSync(pastaSub).filter((f) => f.endsWith('.jsonl')).sort()) arquivos.push({ papel: `subagente ${f}`, arq: path.join(pastaSub, f) });
    for (const { papel, arq: f } of arquivos) {
      const texto = readFileSync(f, 'utf8');
      const linhas = texto.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const primeira = linhas.find((m) => m.type === 'assistant' && m.message?.usage)?.message.usage;
      const anexos = {};
      for (const m of linhas) if (m.type === 'attachment') { const t = m.attachment?.type; anexos[t] = (anexos[t] ?? 0) + 1; }
      r.push({
        sessao: s, papel, arquivo: f,
        primeiraChamada: primeira ? { entrada: primeira.input_tokens, criacaoDeCache: primeira.cache_creation_input_tokens, leituraDeCache: primeira.cache_read_input_tokens, total: primeira.input_tokens + primeira.cache_creation_input_tokens + primeira.cache_read_input_tokens } : null,
        anexos,
        marcas: {
          claudeMdDoUsuario: texto.includes('Regras de trabalho (Pedro'),
          regrasContext7: texto.includes('Use Context7 MCP to fetch current documentation'),
          superpowers: (texto.match(/superpowers/g) ?? []).length,
          skillsListadas: (texto.match(/skill_listing/g) ?? []).length,
          instrucaoV3: texto.includes('Economia de chamadas de ferramenta'),
          descricaoCurtaDoExecutor: texto.includes('Executa uma subtarefa delegada e devolve o resultado.'),
        },
      });
    }
  }
  return r;
}

async function uma(variante) {
  const id = `fumaca-${TAREFA}-${variante.replace(/,/g, '+')}`;
  const destino = path.join(SAIDA, `${id}.json`);
  if (existsSync(destino)) { log(`pulando ${id} (já existe)`); return; }
  const carga = await esperarCarga();
  log(`>> ${id} | ${carga.leituras.at(-1)}`);
  const linhasDoLogAntes = existsSync(path.join(BASE, 'variantes.log')) ? readFileSync(path.join(BASE, 'variantes.log'), 'utf8').split('\n').filter(Boolean).length : 0;
  const pid = await subir(variante);
  const dir = prepararPasta(id);
  let orqId = null; let worktree = null;
  const reg = { id, variante, tarefa: TAREFA, inicio: new Date().toISOString(), carga, pastaDeTrabalho: dir };
  try {
    const t = TAREFAS.tarefas[TAREFA];
    orqId = (await api('POST', '/orquestradores', { nome: `bench ${id}`, pastaDeTrabalho: dir, ...CONFIGURACAO_C })).id;
    reg.execucao = await rodarT(orqId, `${t.prompt}${TAREFAS.sufixo}`);
    const evs = eventos(orqId);
    const orqJson = JSON.parse(readFileSync(path.join(DADOS_C, 'orquestradores', orqId, 'orquestrador.json'), 'utf8'));
    worktree = orqJson.worktree?.caminho && existsSync(orqJson.worktree.caminho) ? orqJson.worktree.caminho : null;
    const fins = evs.filter((e) => FIM.test(tipoDe(e)));
    reg.fimDoTurno = fins.length ? tipoDe(fins.at(-1)) : null;
    reg.falhas = evs.filter((e) => tipoDe(e) === 'turno_falhou').map((e) => corpoDe(e).motivo);
    reg.resposta = fins.length && tipoDe(fins.at(-1)) === 'turno_concluido' ? corpoDe(fins.at(-1)).resposta : '';
    reg.consumos = evs.filter((e) => tipoDe(e) === 'consumo_do_turno_medido').map((e) => corpoDe(e).consumo);
    reg.subagentes = evs.filter((e) => tipoDe(e) === 'subagente_iniciado').length;
    const sessoes = [...new Set([orqJson.sessaoId, ...evs.filter((e) => tipoDe(e) === 'sessao_iniciada').map((e) => corpoDe(e).sessaoDoMotor)].filter(Boolean))];
    reg.sessoes = sessoes;
    const pasta = worktree ?? dir;
    reg.checagem = await checar(TAREFA, pasta, reg.resposta ?? '');
    reg.sucesso = reg.checagem.sucesso;
    const m = spawnSync(TSX, [path.join(SCRIPTS, 'medir.ts'), JSON.stringify({ pasta, sessoes })], { cwd: APP, encoding: 'utf8', env: ambiente({}), maxBuffer: 50e6, timeout: 180_000 });
    if (m.status === 0) {
      const med = JSON.parse(m.stdout);
      reg.medicao = { usd: med.custo.usd, usdPrincipal: med.custo.usdPrincipal, usdSubagentes: med.custo.usdSubagentes, indiceDeCusto: med.medicaoDoApp.indiceDeCusto, total: med.medicaoDoApp.total, principal: med.medicaoDoApp.principal, subagentes: med.medicaoDoApp.subagentes, mensagens: med.medicaoDoApp.mensagens, subagentesLancados: med.medicaoDoApp.subagentesLancados, modelo: med.medicaoDoApp.modeloDoPrincipal };
    } else reg.medicao = { erro: (m.stderr || m.stdout || '').slice(-800) };
    reg.transcricoes = analisarTranscricoes(sessoes);
    for (const [nome, d] of [['eventos.jsonl', `${id}.eventos.jsonl`], ['orquestrador.json', `${id}.orquestrador.json`]]) {
      try { cpSync(path.join(DADOS_C, 'orquestradores', orqId, nome), path.join(SAIDA, d)); } catch {}
    }
  } catch (erro) {
    reg.erro = String(erro?.stack ?? erro).slice(0, 1500);
  } finally {
    const todas = existsSync(path.join(BASE, 'variantes.log')) ? readFileSync(path.join(BASE, 'variantes.log'), 'utf8').split('\n').filter(Boolean) : [];
    reg.chamadasDoIntermediario = todas.slice(linhasDoLogAntes).map((l) => { try { const j = JSON.parse(l); return { em: j.em, variante: j.variante, aplicadas: j.aplicadas, sessao: j.sessao, detalhes: j.detalhes, final: j.final }; } catch { return l; } });
    if (orqId) { try { await api('DELETE', `/orquestradores/${orqId}`); } catch (e) { reg.avisoRemocao = String(e).slice(0, 200); } }
    await derrubar(pid);
    for (const p of [dir, worktree]) if (p && p.startsWith(BASE + '/')) rmSync(p, { recursive: true, force: true });
    reg.fim = new Date().toISOString();
    writeFileSync(destino, JSON.stringify(reg, null, 1));
    const pc = reg.transcricoes?.find((t) => t.papel === 'principal')?.primeiraChamada;
    log(`<< ${id}: ${reg.sucesso ? 'SUCESSO' : 'FALHA'} | ${reg.checagem?.motivo?.slice(0, 120) ?? reg.erro?.slice(0, 200)} | US$ ${reg.medicao?.usd?.toFixed?.(4)} | índice ${reg.medicao?.indiceDeCusto} | 1a chamada ${pc?.total}`);
  }
}

mkdirSync(SAIDA, { recursive: true });
// Cada argumento é uma variante (uma combinação vai junta, com vírgula: "v1,v2").
for (const v of (process.argv.length > 2 ? process.argv.slice(2) : ['base', 'v1', 'v2', 'v3'])) await uma(v);
