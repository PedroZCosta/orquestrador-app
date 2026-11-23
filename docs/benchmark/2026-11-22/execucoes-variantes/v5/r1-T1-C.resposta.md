O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito. Segundo o subagente, o `npm test` passou com 52 de 52 testes. Não rodei o teste de novo por conta própria.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a recusa era `subtotal <= coupon.minSubtotal` e passou a ser `subtotal < coupon.minSubtotal`. Isso vale para todos os cupons com `minSubtotal`. Nada mais foi alterado.
- **Teste novo:** "valor igual ao mínimo é aceito", em `test/discounts.test.js`. Ele usa BEMVINDO10 com subtotal de R$ 100 e espera que o cupom seja aceito e que o desconto seja 10.
- **Commit:** não foi feito, como você pediu.

Não ficou nenhuma pendência.