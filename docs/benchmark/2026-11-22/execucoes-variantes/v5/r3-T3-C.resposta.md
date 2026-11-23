A refatoração terminou. `src/money.js` agora concentra o arredondamento e a formatação de dinheiro, e `npm test` passou com 51 de 51, sem alterar nenhum teste. Não fiz commit.

- **Mudanças:** os `Math.round(x*100)/100` viraram `round2`. As somas viraram `sumMoney`, e o desconto percentual virou `percentOf`. Os formatadores locais de "R$" em `formatReport`, `price` (templates) e `lowStockAlert` agora usam `formatBRL`. O `money.js` não precisou de funções novas.
- **Arquivos tocados:** `src/reports/salesReport.js`, `src/notifications/templates.js`, `src/notifications/notifier.js`, `src/pricing/pricing.js`, `shipping.js`, `tax.js`, `discounts.js` e `src/cart/cart.js`.
- **Grep:** `Math.round` e `toFixed` só aparecem em `src/money.js`.
- **Diff:** conferi o diff de `salesReport.js`, `templates.js` e `notifier.js`. As trocas mantêm a ordem de acumulação e a mesma regex de milhares.
- **Risco restante:** `formatBRL` arredonda antes de formatar, o que antes não acontecia em `formatReport`. Os valores do relatório já chegam arredondados, então a saída não muda. Um valor como -0,001 sairia "0,00" em vez de "-0,00", mas nada no fluxo atual produz isso.