O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com `BEMVINDO10` passa a ser aceito. Segundo o relatório do subagente, `npm test` terminou com 52 testes, todos passando. Não rodei o `npm test` por conta própria; só conferi o diff.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Vale para todos os cupons com mínimo, e nada mais mudou no comportamento.
- **Teste:** em `test/discounts.test.js` entrou o caso "exatamente no mínimo é aceito (inclusivo)". Ele usa `BEMVINDO10` com um item de R$ 100,00 e espera o pedido aceito com desconto de 10.

O `git diff --stat` mostra só esses dois arquivos alterados, com 7 inserções e 1 remoção. Não fiz commit.