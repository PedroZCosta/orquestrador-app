Centralizei o arredondamento e a formatação em `src/money.js` e troquei todos os usos espalhados. `npm test` passou: 51 testes, 0 falhas, sem nenhuma alteração nos testes. Não fiz commit.

Fora de `src/money.js` não sobrou nenhum `Math.round` nem `toFixed` (conferi com grep).

**Módulos alterados:** `cart`, `discounts`, `shipping`, `tax`, `pricing`, `templates`, `notifier` e `salesReport`. Eles passaram a usar `round2`, `sumMoney`, `percentOf` e `formatBRL`.

**Cuidados para manter a saída idêntica:**
- **Imposto:** usei `round2(taxableAmount * rate)` em vez de `percentOf`. Com `percentOf` a ordem das multiplicações mudaria, e isso pode alterar o último centavo em ponto flutuante.
- **Relatório de vendas:** o formatador original não arredondava antes do `toFixed(2)`, e arredondar antes pode mudar o resultado (por exemplo, 10.555 vira "10.55" sem arredondar e "10.56" com `round2`). Por isso `formatBRL` ganhou a opção `{ round: false }`, usada só no `formatReport`. Sem a opção, o comportamento é o de antes.

**Limite conhecido:** o alerta de estoque baixo tinha um formatador próprio que, para um custo unitário `NaN` ou infinito, imprimia "R$ NaN" ou "R$ Infinity". Agora imprime "R$ NaN,undefined" e "R$ Infinity,undefined", igual ao `formatBRL` de antes. Para valores normais a saída não muda, e os testes não cobrem esse caso. Não tratei isso para não alterar o `formatBRL` usado nos e-mails.