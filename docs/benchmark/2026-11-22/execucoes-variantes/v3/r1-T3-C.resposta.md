Todo o arredondamento e a formatação de dinheiro agora passam por `src/money.js`. Conferi no final: o `npm test` passou (51 de 51) e não sobrou `Math.round` nem `toFixed` fora de `src/money.js`. Os testes não foram alterados e não houve commit.

**O que mudou**
- **`src/money.js`:**
  - `sumMoney(values, map?)` aceita agora um mapeador opcional.
  - `formatBRL(value, { round = true, plainNonFinite = false })` ganhou duas opções, porque dois formatadores locais não saíam idênticos aos de `formatBRL`.
- **`salesReport.js`:** o formatador local não arredondava antes do `toFixed`, então usa `{ round: false }`. Isso preserva, por exemplo, "-0,00" para `-0.001`, que arredondando viraria "0,00".
- **`notifier.js`:** para NaN ou Infinity o formatador local gerava "R$ NaN", e `{ plainNonFinite: true }` mantém isso. O padrão de `formatBRL` daria "R$ NaN,undefined".
- **`templates.js`:** era idêntico a `formatBRL`, então usa o padrão.
- **Outros módulos:** `pricing.js`, `shipping.js`, `tax.js`, `discounts.js` e `cart.js` agora usam `round2`, `sumMoney` ou `percentOf`.
- **`tax.js`:** ficou com `round2(taxableAmount * rate)`. Usar `percentOf` dividiria por 100 e poderia mudar o resultado em ponto flutuante.

Segundo o executor, a ordem das operações de ponto flutuante ficou igual à original em todos os pontos. Eu não refiz essa comparação nem rodei casos de borda por conta própria; me baseei nos testes e no relatório dele.

Não há pendências.