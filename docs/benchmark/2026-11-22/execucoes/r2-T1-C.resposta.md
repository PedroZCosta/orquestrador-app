O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com BEMVINDO10 passa a ser aceito. Rodei `npm test` e passaram os 53 testes, sem falhas. Não fiz commit.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. A regra vale para todos os cupons com mínimo, e nada mais mudou.
- **Testes novos** (em `test/discounts.test.js`, 12 linhas): BEMVINDO10 com subtotal de R$ 100,00 é aceito e dá R$ 10,00 de desconto. FRETEGRATIS com subtotal de R$ 150,00 também é aceito e dá frete grátis.

Um único subagente fez as edições. Conferi o resultado com `git diff --stat` e um novo `npm test`.