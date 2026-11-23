// Reescreve os argumentos do Claude Code conforme BENCH_VARIANTE e grava uma linha em /tmp/bench-gosub/variantes.log.
// Uso (pelo script `claude` desta pasta): node transformar.mjs <args originais...>
// Saída: os argumentos finais separados por NUL no stdout. Código 2 = variante desconhecida.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BENCH_DIR_TMP ?? '/tmp/bench-gosub';
const LOG = process.env.BENCH_LOG ?? path.join(BASE, 'variantes.log');
const original = process.argv.slice(2);

const APELIDOS = {
  base: [], v1: ['v1'], 'sem-peso-do-usuario': ['v1'], v2: ['v2'], 'agents-enxutos': ['v2'],
  v3: ['v3'], 'agrupar-chamadas': ['v3'], v5: ['v5'], 'instrucoes-enxutas': ['v5'],
  vr: ['v1', 'v2', 'v3', 'v5'], recomendadas: ['v1', 'v2', 'v3', 'v5'],
};
const NOME_DO_EXECUTOR = 'executor';
const DESCRICAO_CURTA_DO_EXECUTOR = 'Executa uma subtarefa delegada e devolve o resultado.';
// Agentes embutidos do Claude Code 2.1.322 (evento system/init). Negados por regra Agent(<nome>), saem da lista do Agent.
const AGENTES_EMBUTIDOS = ['claude', 'Explore', 'general-purpose', 'Plan', 'statusline-setup', 'web-fetch'];
// Plugins vistos no system/init desta máquina; somados aos descobertos em ~/.claude abaixo.
const PLUGINS_CONHECIDOS = [
  'logo-design@logo-design-skill', 'superpowers@claude-plugins-official', 'atlassian@claude-plugins-official',
  'adhd-study-coach@anthropic-plugin-directory', 'pdf-viewer@synced', 'cowork-plugin-management@synced',
  'cc-plugin-agents-md@builtin', 'cc-plugin-telemetry@builtin', 'cc-plugin-privacy@builtin', 'cc-plugin-plugin-authoring@builtin',
];

function lerJson(arq) { try { return JSON.parse(readFileSync(arq, 'utf8')); } catch { return null; } }

function pluginsDoUsuario() {
  const home = os.homedir();
  const ids = new Set(PLUGINS_CONHECIDOS);
  for (const k of Object.keys(lerJson(path.join(home, '.claude', 'settings.json'))?.enabledPlugins ?? {})) ids.add(k);
  const inst = lerJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'));
  for (const k of Object.keys(inst?.plugins ?? inst ?? {})) if (k.includes('@')) ids.add(k);
  try {
    const synced = path.join(home, '.claude', 'plugins', 'synced');
    for (const conta of readdirSync(synced)) {
      for (const p of readdirSync(path.join(synced, conta))) ids.add(`${p.replace(/~g\d+$/, '')}@synced`);
    }
  } catch {}
  return [...ids];
}

function variantes() {
  const bruto = (process.env.BENCH_VARIANTE ?? 'base').trim().toLowerCase() || 'base';
  const lista = new Set();
  for (const parte of bruto.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!(parte in APELIDOS)) {
      process.stderr.write(`[bench] BENCH_VARIANTE desconhecida: "${parte}" (use base, v1, v2, v3, v5, vr ou combinações como v1,v2)\n`);
      process.exit(2);
    }
    for (const v of APELIDOS[parte]) lista.add(v);
  }
  return { bruto, lista };
}

// Posição e valor de uma flag de um valor (`--f v` ou `--f=v`).
function acharFlag(args, ...nomes) {
  for (let i = 0; i < args.length; i += 1) {
    for (const n of nomes) {
      if (args[i] === n) return { i, valor: args[i + 1], forma: 'separada' };
      if (args[i].startsWith(`${n}=`)) return { i, valor: args[i].slice(n.length + 1), forma: 'junta' };
    }
  }
  return null;
}
function trocarValor(args, achado, novo) {
  if (achado.forma === 'separada') args[achado.i + 1] = novo;
  else args[achado.i] = `${args[achado.i].split('=')[0]}=${novo}`;
}
const lerValorJson = (v) => (v.trim().startsWith('{') ? JSON.parse(v) : JSON.parse(readFileSync(v, 'utf8')));
const lerValorTexto = (v) => readFileSync(v, 'utf8');

function principal() {
  const { bruto, lista } = variantes();
  const ehSessao = original.includes('-p') || original.includes('--print');
  const args = [...original];
  const detalhes = {};
  const frente = []; // flags novas vão para o começo: nunca caem dentro de uma lista variádica (--tools, --allowedTools...)

  if (ehSessao && lista.size > 0) {
    const pasta = path.join(BASE, 'variantes', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
    mkdirSync(pasta, { recursive: true });

    // Texto extra das instruções (V3 e V5).
    const extras = [];
    if (lista.has('v3')) extras.push(readFileSync(path.join(AQUI, 'v3-agrupar.txt'), 'utf8').trim());
    if (lista.has('v5')) {
      const arq = path.join(AQUI, 'v5-instrucoes.txt');
      if (existsSync(arq) && readFileSync(arq, 'utf8').trim()) extras.push(readFileSync(arq, 'utf8').trim());
      else detalhes.v5 = 'v5-instrucoes.txt ausente ou vazio: nada acrescentado';
    }
    const textoExtra = extras.join('\n\n');

    // V1: plugins, skills, slash commands, agentes de plugin e hooks fora; login e CLAUDE.md ficam.
    if (lista.has('v1')) {
      const desligados = Object.fromEntries(pluginsDoUsuario().map((id) => [id, false]));
      const achado = acharFlag(args, '--settings');
      const atual = achado ? lerValorJson(achado.valor) : {};
      const novo = { ...atual, enabledPlugins: { ...(atual.enabledPlugins ?? {}), ...desligados }, disableAllHooks: true };
      const arq = path.join(pasta, 'configuracoes.json');
      writeFileSync(arq, JSON.stringify(novo, null, 1));
      if (achado) trocarValor(args, achado, arq); else frente.push('--settings', arq);
      if (!args.includes('--disable-slash-commands')) frente.push('--disable-slash-commands');
      detalhes.v1 = { pluginsDesligados: Object.keys(desligados).length, settingsOriginal: achado?.valor ?? null };
    }

    // V2 e V3/V5 mexem no JSON do --agents.
    const agentes = acharFlag(args, '--agents');
    if (agentes && (lista.has('v2') || textoExtra)) {
      const antes = agentes.valor.trim().startsWith('{') ? agentes.valor : readFileSync(agentes.valor, 'utf8');
      let def = JSON.parse(antes);
      if (lista.has('v2') && def[NOME_DO_EXECUTOR]) {
        def = { [NOME_DO_EXECUTOR]: { ...def[NOME_DO_EXECUTOR], description: DESCRICAO_CURTA_DO_EXECUTOR } };
      }
      if (textoExtra && def[NOME_DO_EXECUTOR]) {
        def[NOME_DO_EXECUTOR] = { ...def[NOME_DO_EXECUTOR], prompt: `${def[NOME_DO_EXECUTOR].prompt ?? ''}\n\n${textoExtra}` };
      }
      const depois = JSON.stringify(def);
      const arq = path.join(pasta, 'agentes.json');
      writeFileSync(arq, depois);
      trocarValor(args, agentes, arq);
      detalhes.agentes = { original: agentes.valor.length > 300 ? '<json inline>' : agentes.valor, nomesAntes: Object.keys(JSON.parse(antes)), nomesDepois: Object.keys(def), bytesAntes: antes.length, bytesDepois: depois.length };
    }
    if (lista.has('v2')) {
      const negados = AGENTES_EMBUTIDOS.map((n) => `Agent(${n})`);
      const i = args.findIndex((a) => a === '--disallowedTools' || a === '--disallowed-tools');
      if (i >= 0) args.splice(i + 1, 0, ...negados); else frente.push('--disallowedTools', ...negados);
      detalhes.v2 = { agentesEmbutidosNegados: negados };
    }

    // V3/V5: cópia das instruções do app com o texto extra no fim.
    if (textoExtra) {
      const achado = acharFlag(args, '--append-system-prompt-file');
      const antes = achado ? lerValorTexto(achado.valor) : '';
      const arq = path.join(pasta, 'instrucoes.txt');
      writeFileSync(arq, antes ? `${antes.replace(/\s+$/, '')}\n\n${textoExtra}\n` : `${textoExtra}\n`);
      if (achado) trocarValor(args, achado, arq); else frente.push('--append-system-prompt-file', arq);
      detalhes.instrucoes = { original: achado?.valor ?? null, bytesAntes: antes.length, bytesExtra: textoExtra.length };
    }
    detalhes.pasta = pasta;
  }

  const final = [...frente, ...args];
  try {
    mkdirSync(path.dirname(LOG), { recursive: true });
    appendFileSync(LOG, `${JSON.stringify({ em: new Date().toISOString(), variante: bruto, aplicadas: [...lista], sessao: ehSessao, ppid: process.ppid, cwd: process.cwd(), detalhes, original, final })}\n`);
  } catch {}
  process.stdout.write(final.map((a) => `${a}\0`).join(''));
}

principal();
