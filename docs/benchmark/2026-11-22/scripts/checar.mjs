// Checador automático das tarefas. Roda numa CÓPIA do resultado (os testes
// ocultos nunca entram na pasta em que o agente trabalhou).
// Uso CLI: node checar.mjs <T1|T2|T3|T4> <pastaDoResultado> [arquivoDaResposta]
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const OCULTOS = path.join(raiz, 'ocultos');
const FIXTURE = path.join(raiz, 'fixture');

function rodar(comando, args, cwd, tempo = 180_000) {
  const r = spawnSync(comando, args, { cwd, encoding: 'utf8', timeout: tempo, env: { ...process.env, NODE_OPTIONS: '' } });
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: r.status === 0, status: r.status, fim: saida.split('\n').slice(-25).join('\n') };
}

function copiar(origem) {
  const destino = mkdtempSync(path.join(tmpdir(), 'bench-checar-'));
  cpSync(origem, destino, {
    recursive: true,
    filter: (f) => !/(^|\/)(\.git|node_modules)(\/|$)/.test(path.relative(origem, f)),
  });
  return destino;
}

function semAlteracoes(pasta) {
  const status = execFileSync('git', ['-C', pasta, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  return { limpo: status.trim() === '', status: status.trim() };
}

function arquivosJs(pasta) {
  const lista = [];
  for (const nome of readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, nome.name);
    if (nome.isDirectory()) lista.push(...arquivosJs(p));
    else if (/\.(c|m)?js$/.test(nome.name)) lista.push(p);
  }
  return lista;
}

export async function checar(tarefa, pastaResultado, resposta = '') {
  const detalhes = {};
  if (tarefa === 'T4') {
    const { conferirFatos } = await import(pathToFileURL(path.join(OCULTOS, 't4-fatos.mjs')).href);
    const fatos = conferirFatos(resposta);
    const git = semAlteracoes(pastaResultado);
    detalhes.fatos = fatos.fatos;
    detalhes.gitStatus = git.status;
    const motivos = [];
    if (!git.limpo) motivos.push(`arquivos alterados no projeto: ${git.status.slice(0, 200)}`);
    if (!fatos.ok) motivos.push(`fatos ausentes na resposta: ${fatos.faltando.join('; ')}`);
    return { sucesso: motivos.length === 0, motivo: motivos.join(' | ') || 'todos os fatos presentes e nenhum arquivo alterado', detalhes };
  }

  const copia = copiar(pastaResultado);
  try {
    const motivos = [];
    // 1. A suíte do próprio projeto (com os testes que o agente escreveu).
    const suite = rodar('node', ['--test'], copia);
    detalhes.suiteDoProjeto = suite;
    if (!suite.ok) motivos.push('a suíte do projeto (node --test) falha');

    if (tarefa === 'T1' || tarefa === 'T2') {
      const pastaOculta = path.join(copia, 'test-ocultos');
      rmSync(pastaOculta, { recursive: true, force: true });
      cpSync(path.join(OCULTOS, `${tarefa.toLowerCase()}.test.js`), path.join(pastaOculta, `${tarefa.toLowerCase()}.test.js`));
      const oculto = rodar('node', ['--test', 'test-ocultos/*.test.js'], copia);
      detalhes.testeOculto = oculto;
      if (!oculto.ok) motivos.push(`o teste oculto da ${tarefa} falha`);
    }

    if (tarefa === 'T3') {
      // Testes originais, sem mudança, têm de passar.
      for (const nome of readdirSync(path.join(FIXTURE, 'test'))) {
        cpSync(path.join(FIXTURE, 'test', nome), path.join(copia, 'test', nome));
      }
      const originais = rodar('node', ['--test', 'test/*.test.js'], copia);
      detalhes.testesOriginais = originais;
      if (!originais.ok) motivos.push('os testes originais falham');
      const ouro = rodar('node', [path.join(aqui, 't3-verificar.mjs'), copia], copia);
      detalhes.ouro = ouro;
      if (!ouro.ok) motivos.push(`saída pública mudou (${ouro.fim.trim().split('\n').at(-1)})`);
      const sobras = [];
      for (const arquivo of arquivosJs(path.join(copia, 'src'))) {
        if (path.relative(copia, arquivo) === path.join('src', 'money.js')) continue;
        readFileSync(arquivo, 'utf8').split('\n').forEach((linha, i) => {
          if (/Math\.round|toFixed/.test(linha)) sobras.push(`${path.relative(copia, arquivo)}:${i + 1}`);
        });
      }
      detalhes.sobrasDeArredondamento = sobras;
      if (sobras.length > 0) motivos.push(`sobrou Math.round/toFixed fora de src/money.js em ${sobras.slice(0, 5).join(', ')}`);
    }
    return { sucesso: motivos.length === 0, motivo: motivos.join(' | ') || 'todos os critérios passaram', detalhes };
  } finally {
    rmSync(copia, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [tarefa, pasta, arquivoDaResposta] = process.argv.slice(2);
  const resposta = arquivoDaResposta && existsSync(arquivoDaResposta) ? readFileSync(arquivoDaResposta, 'utf8') : '';
  const r = await checar(tarefa, path.resolve(pasta), resposta);
  console.log(JSON.stringify({ sucesso: r.sucesso, motivo: r.motivo }, null, 1));
  if (process.env.DETALHES) writeFileSync(process.env.DETALHES, JSON.stringify(r, null, 1));
  process.exit(r.sucesso ? 0 : 1);
}
