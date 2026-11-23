Corrigido: o pedido mínimo dos cupons agora é inclusivo, e o `npm test` passa com 52 testes, 0 falhas.

- **Causa:** em `src/pricing/discounts.js`, a checagem usava `subtotal <= coupon.minSubtotal`, então um pedido exatamente no mínimo era recusado. Troquei para `<`. A mudança vale para os três cupons com mínimo: BEMVINDO10 (R$ 100), FRETEGRATIS (R$ 150) e DESC50 (R$ 300). O comentário em `coupons.js` já dizia "inclusive", então o código é que estava errado.
- **Arredondamento:** o subtotal já é arredondado a 2 casas antes da comparação, então não há risco de erro de ponto flutuante nesse limite.
- **Teste:** em `test/discounts.test.js`, o novo caso aceita os três cupons com o subtotal exatamente igual ao mínimo. Também confere que BEMVINDO10 em R$ 100,00 dá R$ 10,00 de desconto e que R$ 99,99 continua recusado com `MIN_SUBTOTAL`.

Não fiz commit, como pedido.