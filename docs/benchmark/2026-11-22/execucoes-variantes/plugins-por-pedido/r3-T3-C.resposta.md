A refatoração está pronta e `npm test` passou: 51 de 51, sem falhas. O `grep` por `Math.round` e `toFixed` fora de `src/money.js` não encontrou nada. Não conferi a igualdade byte a byte comparando a saída antes e depois, só pelos testes existentes, que não foram alterados.

- **Cart e pricing** (`src/cart/cart.js`, `src/pricing/discounts.js`, `src/pricing/tax.js`, `src/pricing/shipping.js`, `src/pricing/pricing.js`): os arredondamentos viraram `round2`, `sumMoney` e `percentOf`. O imposto em `tax.js` usa `round2(taxableAmount * rate)`, com a expressão original intacta.
- **Notificações e relatório** (`src/notifications/templates.js`, `src/notifications/notifier.js`, `src/reports/salesReport.js`): os formatadores de "R$" locais passaram a usar `formatBRL`. As somas e médias do relatório usam `sumMoney` e `round2`.
- **`src/money.js`:** não precisou de ampliação e ficou como estava.

Foram 8 arquivos alterados, sem commit. Nada ficou pendente.