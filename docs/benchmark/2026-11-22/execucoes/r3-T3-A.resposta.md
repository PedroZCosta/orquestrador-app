O arredondamento e a formatação de dinheiro agora ficam só em `src/money.js`. O `npm test` passa (51 de 51) e nenhum teste foi alterado. Não fiz commit.

**O que mudou**
- **Arredondamento:** `cart.js`, `tax.js`, `discounts.js`, `pricing.js`, `shipping.js` e `salesReport.js` passaram a usar `round2`, `sumMoney` e `percentOf`. Mantive a mesma ordem das somas. Por exemplo, o total do pedido ficou `round2(a + b + c)` e não `sumMoney([...])`, porque esta começa a soma em 0 e mudaria o sinal de um `-0`.
- **Formatação:** removi os três formatadores locais (`price` em `templates.js`, o formatador do `lowStockAlert` e o `brl` do `formatReport`), e todos usam `formatBRL`.

**Duas diferenças escondidas, e por que ampliei o `formatBRL`**
1. **Relatório:** o `brl` antigo aplicava `toFixed(2)` direto, sem `round2` antes. Para valores que não estão arredondados, isso dá outro texto: 0,155 sai "R$ 0,15" no relatório e "R$ 0,16" no `formatBRL`. Como `formatReport` é público, criei a opção `{ round: false }`.
2. **Alerta de estoque:** com custo `NaN` ou `Infinity`, o alerta antigo mostrava "R$ NaN", enquanto o `formatBRL` mostra "R$ NaN,undefined". Criei a opção `{ bareWhenNoDecimals: true }` para manter "R$ NaN".

As duas opções ficam desligadas por padrão, então o `formatBRL` continua igual para quem o chamava sem opções. Também mantive o nome do parâmetro `value`, porque ele aparece na mensagem do `TypeError` que o relatório lança quando recebe um valor não numérico.

**Como verifiquei, além do `npm test`**
Comparei o código original (HEAD) com o novo em cerca de 3,2 milhões de chamadas aleatórias. As entradas incluíram NaN, Infinity, -0, 1e21, `undefined` e strings, e as funções testadas foram `lowStockAlert`, todos os templates, `formatReport`, `formatBRL`, `computeTax`, `lineSubtotal`, os cupons e o frete. Também rodei um fluxo completo nas duas versões: carrinho, 40 pedidos com cupons e estados variados, pagamentos, 84 mensagens enviadas e o relatório. A saída foi idêntica nas duas versões, contando sinal de zero e mensagens de erro.

**Uma regra que não deu para cumprir**
Ainda sobra um `Math.round` fora de `src/money.js`, em `test/salesReport.test.js:26`. Ele está no próprio teste, e a regra de não alterar os testes tem precedência, então deixei como está. No código de `src/` não sobrou nenhum `Math.round` nem `toFixed` fora de `money.js`.