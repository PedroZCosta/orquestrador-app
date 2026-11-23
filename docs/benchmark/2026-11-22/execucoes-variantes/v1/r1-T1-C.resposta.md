Corrigi o pedido mínimo dos cupons para ser inclusivo, e `npm test` passou com 52 de 52 testes, sem falhas.

- **Correção:** em `src/pricing/discounts.js:19`, a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Isso vale para todos os cupons com mínimo, não só o BEMVINDO10. O subtotal já é arredondado para centavos, então R$ 100,00 chega exato e nada mais precisou mudar.
- **Teste novo:** em `test/discounts.test.js`, o caso "subtotal exatamente igual ao mínimo é aceito" usa o BEMVINDO10 com um item de R$ 100,00. Ele espera que o cupom seja aceito com desconto de R$ 10,00.

Não fiz commit. Não ficou nada pendente.