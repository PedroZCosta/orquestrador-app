Corrigido. O pedido mínimo dos cupons agora é inclusivo, e `npm test` passou: 53 testes, 0 falhas.

- **Causa:** em `src/pricing/discounts.js:19` a comparação era `subtotal <= coupon.minSubtotal`, então um pedido exatamente no mínimo era recusado. Troquei por `<`. A regra está só nesse ponto e vale para os três cupons com mínimo: BEMVINDO10 (R$ 100), DESC50 (R$ 300) e FRETEGRATIS (R$ 150). O comentário em `coupons.js` já dizia "inclusive", então o código é que estava errado.
- **Testes:** em `test/discounts.test.js` acrescentei dois casos. O primeiro cobre o pedido exatamente no mínimo para os três cupons (BEMVINDO10 dá R$ 10, DESC50 dá R$ 50, FRETEGRATIS zera o frete). O segundo confirma que R$ 99,99 com BEMVINDO10 continua recusado com `MIN_SUBTOTAL`.

Não fiz commit, como pedido.