O pedido mínimo dos cupons agora é inclusivo: um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito. O `npm test` passou, com 52 de 52 testes ok.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Como a verificação é uma só, vale para todos os cupons com mínimo.
- **Ponto flutuante:** não precisou de ajuste. O subtotal já é arredondado a 2 casas antes da comparação.
- **Teste:** em `test/discounts.test.js`, o novo caso "subtotal exatamente igual ao mínimo é aceito" avalia BEMVINDO10 com subtotal 100 e espera `ok` verdadeiro e desconto de 10.

Só esses dois arquivos mudaram, e não fiz commit.