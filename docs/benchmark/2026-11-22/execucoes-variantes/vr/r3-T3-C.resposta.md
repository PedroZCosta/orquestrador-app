A refatoração foi feita e o `npm test` passou: 51 de 51, sem alterar nenhum teste.

- **Onde mudou:** oito arquivos em `src/`: `cart/cart.js`, `notifications/notifier.js`, `notifications/templates.js`, `pricing/discounts.js`, `pricing/pricing.js`, `pricing/shipping.js`, `pricing/tax.js` e `reports/salesReport.js`.
- **O que foi trocado:**
  - Os `Math.round(x * 100) / 100` viraram `round2`.
  - As somas viraram `sumMoney`.
  - O cálculo de percentual em `discounts.js` virou `percentOf`.
  - Os três formatadores locais de "R$" viraram `formatBRL`.
- **`money.js`:** não precisou ser ampliado.
- **Verificação:** a busca confirma que não sobrou `Math.round` nem `toFixed` fora de `src/money.js`.
- **Pendente:** não comparei a saída antes e depois, byte a byte. A garantia de que nada mudou vem só dos testes e da análise do subagente, segundo a qual os formatadores antigos diferiam apenas no arredondamento antes do `toFixed`, e os valores já chegam arredondados.

Não fiz commit.