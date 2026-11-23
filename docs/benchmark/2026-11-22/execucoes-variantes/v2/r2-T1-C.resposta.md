O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com o BEMVINDO10 passa a ser aceito. O `npm test` rodou ao final e passou, com 52 testes e 0 falhas. O `git diff --stat` mostra só dois arquivos alterados.

- **Correção:** em `src/pricing/discounts.js` linha 19, a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. A checagem é única e vale para todos os cupons com mínimo.
- **Arredondamento:** o `lineSubtotal` já arredonda para centavos, então não precisou mexer nele.
- **Teste novo:** `'exatamente no mínimo é aceito'`, em `test/discounts.test.js`. Ele usa o BEMVINDO10 com um item de R$ 100,00 e confere que o cupom é aceito com desconto de R$ 10,00.

Não fiz commit, como pedido.