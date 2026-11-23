O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com `BEMVINDO10` é aceito. O `npm test` passou com 52 testes, 0 falhas, e não fiz commit.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Como a checagem é uma só para todos os cupons, o ajuste vale também para `DESC50` e `FRETEGRATIS`.
- **Teste novo:** em `test/discounts.test.js`, "pedido exatamente no mínimo é aceito (inclusivo)" usa um item de R$ 100,00 com `BEMVINDO10`. Espera o cupom aceito e desconto de R$ 10,00.

Nada mais foi alterado.