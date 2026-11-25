O pedido mínimo dos cupons agora é inclusivo, então um pedido de exatamente R$ 100,00 com `BEMVINDO10` passa a ser aceito. O `npm test` passou: 53 testes aprovados, 0 falhas. Não fiz commit.

- **Correção:** em `src/pricing/discounts.js` (linha 19), troquei `subtotal <= coupon.minSubtotal` por `subtotal < coupon.minSubtotal`. A regra está num só lugar, então vale para todos os cupons com mínimo. Não mexi em ponto flutuante, porque `lineSubtotal` já arredonda o subtotal para centavos.
- **Testes:** em `test/discounts.test.js` entraram dois casos no limite exato.
  - `BEMVINDO10` com R$ 100,00 é aceito, com desconto de 10.
  - `FRETEGRATIS` com R$ 150,00 também é aceito, com frete grátis.

Nada mais foi alterado.