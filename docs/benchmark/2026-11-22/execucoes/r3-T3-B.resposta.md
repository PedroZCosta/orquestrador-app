A refatoração está feita e `npm test` passou com os 51 testes, sem alterar nenhum teste. Não fiz commit.

- **Sem `Math.round` nem `toFixed` fora de `src/money.js`:** conferi com grep em `src`.
- **Módulos alterados:** `cart.js`, `discounts.js`, `shipping.js`, `tax.js`, `pricing.js`, `notifier.js`, `salesReport.js` e `templates.js` agora usam `round2`, `sumMoney`, `percentOf` e `formatBRL`.
- **Nova `formatBRLExact` em `money.js`:** o formatador local do relatório de texto (`formatReport`) não arredondava antes do `toFixed`. Usar `formatBRL` ali poderia mudar a saída para valores como 1,005. Por isso criei essa variante, que só aplica `toFixed`, e a saída do relatório fica idêntica.
- **Alerta de estoque baixo:** o formatador local dele dá o mesmo resultado que `formatBRL` para o valor já arredondado, então passou a usar `formatBRL`. Só difere para `NaN`, que não é um caso real.

A equivalência dos arredondamentos vem de a ordem das operações ser a mesma (por exemplo `a * b * 100` igual a `(a * b) * 100`). Os testes não exercitam todos esses caminhos, então a conferência byte a byte dos textos foi por leitura do código, não por comparação de saídas.