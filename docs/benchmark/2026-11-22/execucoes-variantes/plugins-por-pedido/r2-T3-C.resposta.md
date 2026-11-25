Os dois executores terminaram e a refatoração está feita. `npm test` passou nos dois relatos: 51 testes, 0 falhas. Não conferi os resultados eu mesmo e não houve commit.

**Executor A (pricing e carrinho)**
- Alterou `cart.js`, `discounts.js`, `tax.js`, `shipping.js` e `pricing.js`.
- `discounts.js` usa `percentOf` no desconto percentual. `tax.js` usa `round2`, não `percentOf`, para não mudar o ponto flutuante.
- `cart.js` calcula o subtotal com `sumMoney`, na mesma ordem de soma.

**Executor B (textos e relatório)**
- Alterou `templates.js`, `notifier.js` e `salesReport.js`.
- Os formatadores de "R$" locais viraram `formatBRL`, e os arredondamentos viraram `round2` ou `sumMoney`.
- No alerta de estoque, o executor comparou a saída antiga com a nova em 11 custos e disponibilidades de -5 a 20. Não houve nenhuma diferença.
- No relatório de vendas, não rodou comparação antiga contra nova. Concluiu pela leitura do código que os valores já vinham arredondados, então `formatBRL` não altera o resultado.

**Resultado**
- `grep -rnE "Math\.round|toFixed" src` lista só `src/money.js`.
- `src/money.js` e os testes não foram alterados.

**Pendente**
- Nada, além da decisão de commitar.