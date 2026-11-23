Todo o arredondamento e a formatação de dinheiro agora passam por `src/money.js`. O `npm test` passou (51 de 51) e o grep não achou mais `Math.round` nem `toFixed` em `src` fora desse arquivo. Não alterei nenhum teste e não fiz commit.

Conferi o diff (9 arquivos) e os testes, mas não comparei a saída antiga com a nova byte a byte. A garantia de que nada mudou vem do cuidado do subagente com a ordem das operações e dos testes existentes.

- **`money.js`:** `round2`, `formatBRL`, `sumMoney` e `percentOf` ficaram como estavam. Acrescentei `mulMoney(valor, qtd)`, que faz `round2(valor*qtd)`, e `formatBRLExact(valor)`, que formata sem arredondar antes.
- **Usos trocados:** `cart.js`, `discounts.js`, `tax.js`, `shipping.js`, `pricing.js`, `notifier.js`, `templates.js` e `salesReport.js` agora chamam essas funções.
- **Relatório de vendas:** o formatador local do relatório não arredondava antes de formatar. Por isso ele usa `formatBRLExact`, para não mudar a saída em valores não arredondados ou negativos minúsculos.
- **`lineSubtotal` em `discounts.js`:** continua somando `preço*quantidade` sem arredondar cada linha e arredonda só o total, como antes.
- **Alerta de estoque baixo:** passou a usar `formatBRL(reposition * unitCost)`. O regex de milhar era diferente, mas o subagente conferiu que o resultado é o mesmo, inclusive com negativos.

Não há nada pendente.