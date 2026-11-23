A refatoração está feita e `npm test` passou com 51 de 51 testes. Não alterei nenhum arquivo em `test/` e não fiz commit. Conferi com um grep: não sobrou `Math.round` nem `toFixed` fora de `src/money.js`. Só rodei os testes existentes. Não comparei a saída antiga com a nova para valores de borda, então a garantia de saída idêntica byte a byte se apoia na análise do executor e nos testes.

**O que mudou por arquivo**
- **`src/money.js`:** `round2`, `sumMoney` e `percentOf` ficaram iguais. `formatBRL` ganhou duas opções para manter o comportamento antigo:
  - `round: false` não arredonda antes de formatar.
  - `lenient: true` devolve `R$ NaN` ou `R$ 1e+21` para `NaN`, `Infinity` e valores de 1e21 em diante, como o código antigo.
- **`src/cart/cart.js`:** usa `round2` e `sumMoney`.
- **`src/pricing/discounts.js`:** usa `percentOf` e `sumMoney`.
- **`src/pricing/tax.js`:** usa `round2` direto, porque `rate` não é um percentual.
- **`src/pricing/shipping.js` e `src/pricing/pricing.js`:** usam `round2`.
- **`src/notifications/templates.js`:** `price()` agora chama `formatBRL`.
- **`src/notifications/notifier.js`:** usa `round2` e `formatBRL(estimate, { lenient: true })`. O regex de agrupamento antigo era diferente, mas dá a mesma saída para valores finitos.
- **`src/reports/salesReport.js`:** usa `sumMoney` e `round2`, e o formatador local virou `formatBRL(value, { round: false })`. O antigo não arredondava antes do `toFixed`.

Não ficou nada pendente.