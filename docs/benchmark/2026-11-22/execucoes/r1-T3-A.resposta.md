Terminei. O arredondamento e a formatação de dinheiro agora ficam só em `src/money.js`. O `npm test` passa com 51 de 51 testes, sem mexer em nenhum teste. Não fiz commit.

**O que mudou**
- `round2` substituiu os `Math.round(x * 100) / 100` em `cart.js`, `tax.js`, `shipping.js`, `pricing.js` e `salesReport.js`.
- As somas de listas passaram a usar `sumMoney`: subtotal do carrinho, `lineSubtotal`, receita e descontos do relatório.
- O desconto percentual do cupom passou a usar `percentOf(base, coupon.value)`, que faz exatamente a mesma conta de antes.
- Saíram os três formatadores locais de "R$" (em `templates.js`, `notifier.js` e `formatReport`) e entrou `formatBRL`.

**Duas opções novas em `formatBRL`**
Sem elas, duas saídas mudariam. Por padrão a função continua igual.
- **`{ round: false }`, usado no `formatReport`:** o relatório sempre formatou o número como veio, sem arredondar antes. Como `formatReport` também recebe relatórios montados à mão, arredondar ali mudaria o texto para valores com mais de duas casas.
- **`{ raw: true }`, usado no `lowStockAlert`:** o alerta antigo escrevia `R$ NaN` (por exemplo, se o custo vier `undefined`), `R$ Infinity` e `R$ 1e+21`. O `formatBRL` padrão escreve `R$ NaN,undefined`, e esse comportamento não podia mudar porque `formatBRL` também é exportado.

**Como verifiquei**
Comparei a versão original (tirada do `HEAD`) com a nova em cerca de 1,1 milhão de casos, com zero diferenças. Os casos cobriram:
- valores aleatórios e de borda: `-0`, `1.005`, `2.675`, `1e21`, NaN, Infinity, `undefined`, string;
- as funções `formatBRL`, mensagens de pedido, alerta de estoque, `formatReport`, `salesReport`, `computeTotals`, cupons e resumo do carrinho;
- inclusive as mensagens de erro, que também saíram iguais.

**Restam três usos fora de `src/money.js`**
- `test/salesReport.test.js:26` ainda tem um `Math.round`. Ficou porque a regra de não alterar testes tem prioridade.
- `Math.ceil` em `shipping.js` arredonda o peso para quilos inteiros.
- `Math.trunc` em `tax.js` monta o texto da alíquota ("19,5%").

Os dois últimos não são dinheiro, então deixei como estavam.

O projeto não tem script de lint nem de build, então o único que rodei foi o `npm test`.