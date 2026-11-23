Refatoração concluída: o arredondamento e a formatação de dinheiro agora passam todos por `src/money.js`, e o `npm test` passou com 51 de 51. Conferi também que nenhum `Math.round` ou `toFixed` sobrou fora de `src/money.js`. Não fiz commit, e os testes não foram alterados.

Um executor alterou 9 arquivos:
- **`money.js`:** ganhou `formatBRLExact`, igual a `formatBRL` mas sem arredondar antes de formatar.
- **Preços e carrinho:** `cart.js`, `discounts.js`, `tax.js`, `shipping.js` e `pricing.js` usam `round2`, `sumMoney` e `percentOf` no lugar do arredondamento manual.
- **Notificações:** `templates.js` usa `formatBRL`. O formatador local de `notifier.js` tinha uma regex diferente, mas o executor analisou e a saída é idêntica à de `formatBRL`, inclusive a partir de 1000 e para negativos. Eu não rodei essa comparação por conta própria.
- **Relatório:** `salesReport.js` usa `sumMoney` nos totais. O formatador do relatório não arredondava antes de formatar, então ele usa `formatBRLExact` para manter a saída idêntica.
- **Fora do escopo:** a linha 22 de `tax.js` (alíquota em texto, não dinheiro) e as descrições de `coupons.js` (strings literais) ficaram como estavam.

Não sobrou nada pendente.