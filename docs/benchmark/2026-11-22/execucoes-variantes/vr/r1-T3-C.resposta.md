A refatoração está feita e `npm test` passou (51 de 51). Não conferi a saída byte a byte contra a versão anterior além do que os testes cobrem.

- **Resultado:** o arredondamento e a formatação de dinheiro agora passam por `src/money.js`. `Math.round` e `toFixed` só aparecem nesse arquivo.
- **Arquivos alterados (8):** `salesReport.js`, `templates.js`, `notifier.js`, `pricing.js`, `shipping.js`, `tax.js`, `discounts.js` e `cart.js`. O `money.js` não precisou mudar.
- **Formatadores de "R$":** os três formatadores locais (relatório, templates e alerta de estoque do notifier) viraram `formatBRL`. O subagente avaliou que a saída é a mesma, inclusive para valores negativos.
- **Descontos:** o cálculo do cupom usa `percentOf(base, coupon.value)`.
- **Somatórios e ordem de arredondamento:** os somatórios de `salesReport` e `cart` usam `sumMoney`. A ordem de arredondamento ficou a mesma de antes.
- **Testes e commit:** não alterei os testes e não fiz commit.

Não há pendências.