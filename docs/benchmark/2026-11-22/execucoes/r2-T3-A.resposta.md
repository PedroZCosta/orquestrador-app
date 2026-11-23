Terminei: dinheiro agora só é arredondado e formatado em `src/money.js`. `npm test` passa com **51 de 51** e os testes não foram tocados.

**Verificação de "nenhuma saída muda":** rodei um script que compara o código original (extraído do `HEAD`) com o novo. Foram cerca de 2,77 milhões de comparações, com **0 diferenças**. Ele cobriu `formatBRL`, `round2`, os textos de `formatReport`, `salesReport`, `lowStockAlert`, os templates de e-mail, `computeTax`, `computeShipping`, `lineSubtotal`, `evaluateCoupon`, `Cart.summary` e `computeTotals` (catálogo real, 4 cupons, 5 estados). As entradas incluíram valores aleatórios e casos difíceis: negativos, `-0`, `NaN`, `Infinity`, `1e21` e valores que não estavam arredondados.

**O que mudou em `money.js`:** o `formatBRL` ganhou duas opções; sem opções, a saída é a mesma de antes. Sem elas, trocar os formatadores locais pelo `formatBRL` padrão teria mudado saídas, e o script confirmou isso:
- **`round: false`**, usada no relatório. O formatador antigo do relatório fazia `toFixed(2)` direto, sem arredondar antes. Com o `formatBRL` padrão, `-0.125` sairia `R$ -0,12` em vez de `R$ -0,13`, e `-0.001` sairia `R$ 0,00` em vez de `R$ -0,00`.
- **`bareWithoutDecimals: true`**, usada no alerta de estoque. O alerta antigo escrevia `R$ NaN` (por exemplo, quando falta o `unitCost`), enquanto o `formatBRL` escreve `R$ NaN,undefined`. O mesmo acontece com `Infinity` e com `1e21`.

**Onde as funções passaram a ser usadas:**
- `round2` no carrinho, imposto, frete, `computeTotals` e nos acumuladores do relatório.
- `sumMoney` no subtotal do carrinho, em `lineSubtotal` e na receita e nos descontos do relatório.
- `percentOf` no cupom percentual. A conta dá exatamente a mesma operação de ponto flutuante de antes.
- `formatBRL` nos templates de e-mail (o `price()` local foi removido), no relatório e no alerta.

No imposto mantive `round2(valor * alíquota)` em vez de `percentOf`, porque a alíquota é uma fração (0,18). Converter para percentual mudaria o ponto flutuante.

**Uma pendência:** não sobra `Math.round` nem `toFixed` em `src/` fora de `money.js`. Ainda há um `Math.round` em `test/salesReport.test.js:26`, mas ele fica num teste, que você pediu para não alterar.

Não fiz commit. O script de comparação ficou em `/tmp/money-diff/diff.mjs` e a cópia do código original em `/tmp/money-baseline`.