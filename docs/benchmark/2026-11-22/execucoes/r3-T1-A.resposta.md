Corrigi o bug: um pedido de exatamente R$ 100,00 com o BEMVINDO10 agora é aceito, e `npm test` passa inteiro (54 de 54, sem falhas).

**Causa:** em `src/pricing/discounts.js:19` o código recusava o cupom quando o subtotal era menor **ou igual** ao mínimo, então o valor exato do mínimo era rejeitado. O comentário em `src/pricing/coupons.js` já dizia que o mínimo é inclusivo, ou seja, o código estava errado e o texto certo.

**Correção:** troquei `subtotal <= coupon.minSubtotal` por `subtotal < coupon.minSubtotal`. Como todos os cupons passam por essa mesma verificação, a regra vale para os três que têm mínimo (BEMVINDO10, DESC50 e FRETEGRATIS). Nada mais mudou: os valores um pouco abaixo do mínimo continuam sendo recusados.

**Testes adicionados** em `test/discounts.test.js`:
- O BEMVINDO10 com subtotal de exatamente R$ 100,00 é aceito, com desconto de R$ 10,00.
- O DESC50 com R$ 300,00 e o FRETEGRATIS com R$ 150,00 também são aceitos no valor exato.
- R$ 99,99 continua sendo recusado por pedido mínimo não atingido.

Também rodei os testes com o código antigo: os dois testes do valor exato falharam (52 passaram, 2 falharam), então eles pegam o bug.

Não fiz commit. As alterações estão só nesses dois arquivos.