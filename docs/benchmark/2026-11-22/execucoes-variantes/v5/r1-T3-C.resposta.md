A refatoração foi feita e o `npm test` passou: 51 de 51, 0 falhas. Não confirmei por comparação direta que a saída é idêntica byte a byte, só pelos testes.

- **O que mudou:** todos os `Math.round(x*100)/100`, `toFixed` e formatadores "R$" locais passaram a usar `round2`, `formatBRL`, `sumMoney` e `percentOf` de `src/money.js`. Não foi preciso ampliar o `money.js`.
- **Arquivos alterados:** `cart/cart.js`, `pricing/{discounts,tax,shipping,pricing}.js`, `notifications/{notifier,templates}.js` e `reports/salesReport.js`, todos em `src/`.
- **Verificação:** o subagente confirmou com `grep -rn "Math.round\|toFixed" src` que só `src/money.js` contém esses termos. Os testes não foram alterados e não houve commit.
- **Ponto de atenção:** `formatReport` agora aplica `round2` antes de formatar, o que antes não fazia. Os valores já chegavam arredondados, então a saída não deve mudar.