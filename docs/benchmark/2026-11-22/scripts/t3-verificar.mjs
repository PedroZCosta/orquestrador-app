// T3: compara as saídas públicas de um resultado com o ouro gerado do código
// original. Uso: node t3-verificar.mjs <pastaDoProjeto> [--gerar]
// Sai 0 se idêntico; 1 com a primeira diferença no stderr.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ouro = path.join(aqui, '..', 'ocultos', 't3-golden.json');
const [pasta, opcao] = process.argv.slice(2);
const { calcularCasos } = await import(pathToFileURL(path.join(aqui, '..', 'ocultos', 't3-casos.mjs')).href);
const m = await import(pathToFileURL(path.join(path.resolve(pasta), 'src', 'index.js')).href);
const saida = await calcularCasos(m);

if (opcao === '--gerar') {
  writeFileSync(ouro, `${JSON.stringify(saida, null, 1)}\n`);
  console.log(`ouro gravado em ${ouro}`);
  process.exit(0);
}

const esperado = JSON.parse(readFileSync(ouro, 'utf8'));
function primeiraDiferenca(a, b, caminho = '$') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return `${caminho}: esperado ${JSON.stringify(a)}, veio ${JSON.stringify(b)}`;
  }
  for (const chave of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = primeiraDiferenca(a[chave], b[chave], `${caminho}.${chave}`);
    if (d !== null) return d;
  }
  return `${caminho}: ordem ou tipo diferente`;
}
const diferenca = primeiraDiferenca(esperado, saida);
if (diferenca !== null) {
  console.error(`saída diferente do ouro: ${diferenca.slice(0, 400)}`);
  process.exit(1);
}
console.log('saídas idênticas ao ouro');
