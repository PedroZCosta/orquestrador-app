A refatoração foi feita. O arredondamento e a formatação de dinheiro agora passam por `src/money.js`, sem precisar ampliá-lo.

- **O que mudou:** os usos espalhados foram trocados por `round2`, `sumMoney`, `percentOf` e `formatBRL`. Os arquivos tocados são `src/cart/cart.js`, `src/pricing/{pricing,shipping,tax,discounts}.js`, `src/reports/salesReport.js` e `src/notifications/{templates,notifier}.js`.
- **Formatadores locais:** os de `salesReport.js` e `templates.js` viraram `formatBRL`, e o alerta de estoque baixo em `notifier.js` também.
- **`npm test`:** 51 testes, 51 passaram, 0 falharam. Os testes não foram alterados.
- **Sobras:** o grep por `Math.round` e `toFixed` fora de `src/money.js` não retornou nada.
- **Saída idêntica:** o subagente confirmou isso pelos testes e pela leitura do diff, mas não comparou a saída byte a byte com a versão anterior.
- **Commit:** não fiz.

Não há pendências.