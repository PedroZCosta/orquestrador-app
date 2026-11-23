O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito. O executor rodou `npm test` e passaram 54 de 54 testes. Conferi só o `git diff --stat`, que mostra duas alterações, sem commit.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Como a checagem é a mesma para todos os cupons com mínimo, BEMVINDO10 (R$ 100), FRETEGRATIS (R$ 150) e DESC50 (R$ 300) ficaram corrigidos. Nada mais mudou no comportamento.
- **Testes novos:** em `test/discounts.test.js`, três casos de pedido exatamente no mínimo:
  - BEMVINDO10 com R$ 100,00 é aceito, com desconto de R$ 10,00.
  - DESC50 com R$ 300,00 é aceito.
  - FRETEGRATIS com R$ 150,00 é aceito.

Não ficou nada pendente.