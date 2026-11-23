Corrigido: o pedido mínimo dos cupons agora é inclusivo. Um pedido de exatamente R$ 100,00 com BEMVINDO10 passa a ser aceito. O `npm test` terminou com 52 testes passando e nenhuma falha.

- **Correção:** em `src/pricing/discounts.js`, a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Isso vale para todos os cupons com `minSubtotal`.
- **Teste novo:** em `test/discounts.test.js`, um pedido de R$ 100,00 com BEMVINDO10 deve ser aceito, com desconto de R$ 10,00. O teste já existente de "abaixo do mínimo é recusado" continua passando.

Não fiz commit, como pedido.