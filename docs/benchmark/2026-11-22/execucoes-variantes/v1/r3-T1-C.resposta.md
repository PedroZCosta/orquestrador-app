O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito. O `npm test` passou, com 52 testes e nenhuma falha, segundo o relatório do subagente.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Como a checagem é a mesma para todos os cupons com mínimo, a regra vale para todos eles. Nada mais foi alterado.
- **Teste novo:** em `test/discounts.test.js`, "subtotal exatamente igual ao mínimo é aceito" confere que BEMVINDO10 com subtotal de R$ 100,00 é aceito e gera desconto de 10.

Não fiz commit.