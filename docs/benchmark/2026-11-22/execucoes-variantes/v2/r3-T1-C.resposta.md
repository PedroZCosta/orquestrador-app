O pedido mínimo dos cupons agora é inclusivo, então um pedido de exatamente R$ 100,00 com BEMVINDO10 passa a ser aceito. O `npm test` terminou com 52 testes passando e 0 falhas, segundo o relatório do subagente. Eu só conferi o `git diff --stat`, que mostra os dois arquivos abaixo alterados.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a checagem `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. A regra é a mesma para todos os cupons com mínimo e nada mais mudou.
- **Teste:** em `test/discounts.test.js` entrou `'exatamente no mínimo é aceito'`. Ele usa BEMVINDO10 com subtotal exatamente 100 e confere que o cupom é aceito com desconto de 10.

Não fiz commit, como pedido. Nada ficou pendente.