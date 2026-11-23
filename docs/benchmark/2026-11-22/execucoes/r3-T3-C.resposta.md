Todo o arredondamento e a formatação de dinheiro agora passam por `src/money.js`. O `npm test` passou com 51 de 51 e os testes não foram alterados. Conferi também o `git diff --stat` e rodei o grep: fora do `money.js`, não sobra `Math.round` nem `toFixed` em `src`.

Um subagente `executor` editou 8 arquivos:
- **`cart.js`, `shipping.js`, `pricing.js`, `tax.js`:** passam a usar `round2`. Em `cart.js`, o subtotal usa `sumMoney`.
- **`discounts.js`:** usa `percentOf` e `round2`.
- **`salesReport.js`:** usa `round2` e `sumMoney` nos cálculos. O formatador local `brl` foi trocado por `formatBRL`.
- **`templates.js` e `notifier.js`:** os formatadores de "R$" locais foram trocados por `formatBRL`.

Mantive `round2(taxableAmount * rate)` em `tax.js` em vez de `percentOf`, para não mudar a ordem das operações de ponto flutuante. O `money.js` não precisou ser alterado.

A equivalência byte a byte da saída vem dos 51 testes e da preservação da ordem das operações. Não comparei saídas antes e depois da mudança. Nada foi commitado.