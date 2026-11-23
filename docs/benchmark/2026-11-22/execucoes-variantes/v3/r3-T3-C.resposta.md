A refatoração está feita: todo arredondamento e formatação de dinheiro agora passa por `src/money.js`. `npm test` passou, com 51 de 51 testes, e o `grep` por `Math.round` e `toFixed` fora de `src/money.js` voltou vazio. Não confirmei byte a byte as saídas públicas além dos testes existentes.

O trabalho foi de um subagente executor, que alterou 8 arquivos:
- `src/cart/cart.js`
- `src/pricing/discounts.js`
- `src/pricing/tax.js`
- `src/pricing/shipping.js`
- `src/pricing/pricing.js`
- `src/notifications/notifier.js`
- `src/notifications/templates.js`
- `src/reports/salesReport.js`

A ordem das operações de ponto flutuante ficou igual à anterior. O formatador inline do alerta de estoque saiu, e o do relatório (`formatReport`) agora usa `formatBRL`. Os valores do relatório já chegam arredondados, então o texto não muda.

`src/money.js` e os testes não foram alterados, e não fiz commit.