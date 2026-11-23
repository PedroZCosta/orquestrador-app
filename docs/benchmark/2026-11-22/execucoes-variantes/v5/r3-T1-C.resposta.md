O pedido mínimo dos cupons agora é inclusivo, então um pedido de exatamente R$ 100,00 com BEMVINDO10 passa a ser aceito. O subagente rodou `npm test`: 52 testes passaram e 0 falharam. Não conferi o resultado por conta própria.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a recusa por pedido mínimo era `subtotal <= coupon.minSubtotal` e virou `subtotal < coupon.minSubtotal`. A checagem vale para todos os cupons com `minSubtotal`. O subtotal já é arredondado para centavos antes da comparação, então o arredondamento não precisou mudar.
- **Teste novo:** em `test/discounts.test.js`, "subtotal exatamente igual ao mínimo é aceito". Ele usa BEMVINDO10 com R$ 100,00 e espera o cupom aceito, com desconto de 10.

Não fiz commit, como você pediu.