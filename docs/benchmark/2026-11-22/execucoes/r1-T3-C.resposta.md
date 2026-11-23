Refatoração feita: `round2`, `formatBRL`, `sumMoney` e `percentOf` de `src/money.js` agora cobrem todos os usos espalhados. O `src/money.js` não precisou ser ampliado. O `npm test` passou, 51 de 51, sem alterar nenhum teste. Não comparei a saída byte a byte, só rodei a suíte. Nada foi commitado.

Um grep em `src/` confirmou que `Math.round` e `toFixed` só aparecem em `src/money.js`.

Os arquivos alterados foram:
- `src/cart/cart.js`
- `src/pricing/discounts.js`
- `src/pricing/tax.js`
- `src/pricing/shipping.js`
- `src/pricing/pricing.js`
- `src/notifications/notifier.js`
- `src/notifications/templates.js`
- `src/reports/salesReport.js`

Detalhes que valem registrar:
- **Arredondamento antes de formatar:** `formatBRL` arredonda antes de formatar, e os três formatadores locais que ele substituiu (relatório, template e alerta de estoque) não faziam isso. Os valores que chegam a eles já vêm arredondados, então não deve haver diferença.
- **`lineSubtotal` em `discounts.js`:** ficou com `round2` e não com `sumMoney`, porque cada parcela é `unitPrice * quantity` e `sumMoney` soma valores já prontos.

Não ficou nada pendente.