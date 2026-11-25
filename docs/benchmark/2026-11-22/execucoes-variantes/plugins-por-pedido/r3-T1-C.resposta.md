O pedido de exatamente R$ 100,00 com BEMVINDO10 agora é aceito. O `npm test` passou com 52 testes aprovados e nenhuma falha.

- **Correção:** em `src/pricing/discounts.js`, linha 19, a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. O mínimo passou a ser inclusivo, e isso vale para todos os cupons com mínimo (BEMVINDO10, o de R$ 300 e o de R$ 150), porque todos passam pela mesma comparação.
- **Arredondamento:** o subtotal é arredondado para centavos, então 100,00 chega exato à comparação. Nada mais foi alterado.
- **Teste novo:** em `test/discounts.test.js`, "subtotal exatamente igual ao mínimo é aceito". Ele usa um item de R$ 100,00 com BEMVINDO10 e espera `ok: true` e desconto de 10.

Não fiz commit, como pedido. Não ficou nada pendente.