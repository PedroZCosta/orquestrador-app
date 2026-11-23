O pedido mínimo dos cupons agora é inclusivo, e `npm test` passou: 52 testes, 0 falhas. Não rodei os testes de novo, o resultado é o relatado pelo subagente.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Ela vale para todos os cupons com mínimo, e nada mais mudou.
- **Teste novo:** em `test/discounts.test.js`, 'no mínimo exato é aceito' aplica BEMVINDO10 a um pedido de exatamente R$ 100,00. Ele espera que o cupom seja aceito com desconto de R$ 10,00.
- **Commit:** não fiz.

Não há pendências.