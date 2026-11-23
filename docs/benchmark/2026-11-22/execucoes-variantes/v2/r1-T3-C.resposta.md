A refatoração está feita. `npm test` passou 51 de 51, e fora de `src/money.js` não sobrou `Math.round` nem `toFixed`. Conferi só com `git diff --stat` e esse grep, sem reler os arquivos alterados. Não fiz commit.

- **`src/money.js`:** `formatBRL` ganhou o parâmetro opcional `{ round = true }`. O padrão é o comportamento anterior, então o `formatBRL` já testado não mudou.
- **Por que o parâmetro:** o formatador local do relatório e o do notificador só aplicavam `toFixed`, sem `round2` antes. Arredondar antes poderia mudar a saída, por exemplo 1.005 virar "1,01" em vez de "1,00". Esses dois usam `round: false`.
- **Usos trocados:**
  - `salesReport.js`: `sumMoney`, `round2` e o `formatBRL` sem arredondar.
  - `templates.js`: `formatBRL`.
  - `notifier.js`: `round2` e `formatBRL` sem arredondar.
  - `pricing.js`, `shipping.js` e `tax.js`: `round2`, na mesma ordem de contas de ponto flutuante.
  - `discounts.js`: `percentOf` e `round2`.
  - `cart.js`: `round2` e `sumMoney`.
- **Mantido:** os textos fixos de "R$" em `src/pricing/coupons.js` ficaram como estavam, assim como os testes.
- **Pendente:** nada.