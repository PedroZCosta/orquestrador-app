Corrigi o bug. Agora um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito. O `npm test` passa inteiro: 53 testes, 0 falhas.

**Causa:** em `src/pricing/discounts.js:19`, a comparação era `subtotal <= coupon.minSubtotal`. Com isso, um subtotal igual ao mínimo era recusado, contrariando a descrição dos cupons e o próprio comentário em `coupons.js` ("a partir desse subtotal (inclusive)").

**Correção:** troquei `<=` por `<`. É a única linha alterada no código. Essa checagem vale para todos os cupons com mínimo (BEMVINDO10, DESC50 e FRETEGRATIS), e nada mais mudou no comportamento.

**Testes** (em `test/discounts.test.js`):
- **Subtotal igual ao mínimo é aceito:** cobre os três cupons. BEMVINDO10 em R$ 100,00 dá R$ 10,00 de desconto, DESC50 em R$ 300,00 dá R$ 50,00 e FRETEGRATIS em R$ 150,00 dá frete grátis.
- **Um centavo abaixo é recusado:** R$ 99,99 continua recusado com `MIN_SUBTOTAL`.

Antes de corrigir, rodei o teste novo e ele falhou, o que confirma que reproduz o bug. Depois da correção, passou.

Não fiz commit.