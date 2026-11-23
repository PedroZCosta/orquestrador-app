Refatoração concluída: o arredondamento e a formatação de dinheiro agora passam todos por `src/money.js`. O `npm test` passou, 51 de 51, sem falhas, e os testes não foram alterados. Nenhum `Math.round` ou `toFixed` sobrou fora de `src/money.js` (conferi com grep). Não fiz commit.

Um subagente alterou 8 arquivos:
- **`cart/cart.js`:** `round2` no total da linha e `sumMoney` no subtotal.
- **`notifications/templates.js`:** a função `price` usa `formatBRL`.
- **`notifications/notifier.js`:** o alerta de estoque usa `round2` e `formatBRL`.
- **`pricing/pricing.js`, `pricing/shipping.js`, `pricing/tax.js`:** `round2` nos pontos de arredondamento.
- **`pricing/discounts.js`:** `percentOf` no desconto do cupom e `sumMoney` em `lineSubtotal`.
- **`reports/salesReport.js`:** `sumMoney`, `round2` e `formatBRL` no relatório (o `brl` local virou `const brl = formatBRL`).

- **Saídas públicas:** as trocas preservam a mesma aritmética de ponto flutuante, então valores, mensagens, relatório e alertas devem ficar idênticos. A única verificação feita foi o `npm test` e o grep.
- **`tax.js`:** usei `round2` em vez de `percentOf`, porque `percentOf` mudaria a ordem das contas.
- **`salesReport.js`:** `formatBRL` arredonda antes de formatar, e o formatador antigo só usava `toFixed`. Como os valores do relatório já chegam arredondados, o resultado é o mesmo.
- **`money.js`:** não precisei ampliar nada.