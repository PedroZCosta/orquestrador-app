Centralizei o arredondamento e a formatação de dinheiro em `src/money.js`. O `npm test` passou com 51 de 51, sem alterar nenhum teste. Não fiz commit. O `grep` não encontra mais `Math.round` nem `toFixed` fora de `src/money.js`.

Não precisei ampliar o `money.js`: as quatro funções existentes já bastaram.

- **`round2`:** substitui todos os `Math.round(x * 100) / 100` em `cart`, `pricing`, `shipping`, `tax`, `salesReport` e no alerta de estoque.
- **`sumMoney`:** usada em `lineSubtotal`, no subtotal do carrinho e em receita e descontos do relatório.
- **`percentOf`:** usada só no cupom percentual, onde a conta é idêntica à anterior.
- **`formatBRL`:** substitui os três formatadores locais de "R$", em `templates.js`, `notifier.js` e `salesReport.js`.

Para manter a saída idêntica, não usei `percentOf` no imposto. A alíquota é uma fração (`taxable * rate`), então escrever `rate * 100` mudaria a ordem das contas em ponto flutuante e poderia alterar centavos. Ali usei `round2(taxableAmount * rate)`.

O formatador do relatório antes não arredondava, e `formatBRL` arredonda. Isso não muda a saída, porque todos os valores que ele recebe já vêm arredondados e `round2` é idempotente nesses valores.

A verificação de que a saída não mudou foi só a suíte de testes e a conferência das contas, sem comparação byte a byte de saídas antes e depois.