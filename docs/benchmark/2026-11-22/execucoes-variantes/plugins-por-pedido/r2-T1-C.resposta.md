O pedido mínimo dos cupons agora é inclusivo, então um pedido de exatamente R$ 100,00 com BEMVINDO10 passa a ser aceito. O `npm test` passou: 52 testes, nenhuma falha. Não fiz commit.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Como a checagem é única, vale para todos os cupons com mínimo (BEMVINDO10, 300 e 150) e nada mais mudou.
- **Teste novo:** em `test/discounts.test.js`, `no valor exato do mínimo é aceito` aplica BEMVINDO10 a um item de R$ 100,00 e espera `ok: true` com desconto de 10.
- **Arredondamento:** o subtotal da linha é arredondado a 2 casas, então a comparação exata em 100 não sofre com erro de ponto flutuante.

Não há pendências.