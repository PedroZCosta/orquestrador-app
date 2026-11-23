Corrigi: agora um pedido de exatamente R$ 100,00 com o BEMVINDO10 é aceito. `npm test` passa inteiro (53 de 53). Não fiz commit.

**Causa:** em `src/pricing/discounts.js:19` o pedido mínimo era verificado com `subtotal <= coupon.minSubtotal`, então um subtotal igual ao mínimo era recusado. Isso contrariava a descrição dos cupons e o próprio comentário em `coupons.js`, que diz "a partir desse subtotal (inclusive)".

**Correção:** troquei `<=` por `<`. Essa única verificação vale para todos os cupons com mínimo (BEMVINDO10, DESC50 e FRETEGRATIS). O resto do comportamento continua igual: validade, cálculo do desconto e regra de frete grátis por subtotal em `shipping.js`, que já usava `>=`.

**Testes** (em `test/discounts.test.js`):
- **Subtotal exatamente no mínimo é aceito:** cobre os três cupons com mínimo (R$ 100, R$ 300 e R$ 150) e confere o desconto devolvido. Rodei esse teste antes da correção, e ele falhou como esperado.
- **Um centavo abaixo do mínimo (R$ 99,99) é recusado:** com o motivo `MIN_SUBTOTAL`.

O projeto não tem lint nem build configurados, então o único script é o `npm test`.