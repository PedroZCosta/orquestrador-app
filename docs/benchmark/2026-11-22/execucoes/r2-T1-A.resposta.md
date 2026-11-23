Corrigido. Um pedido de exatamente R$ 100,00 com BEMVINDO10 agora é aceito, e o `npm test` passa inteiro: 53 testes, 0 falhas.

**Causa:** em `src/pricing/discounts.js:19` a checagem do mínimo usava `subtotal <= coupon.minSubtotal`. Por isso o valor exato era recusado, embora o comentário em `coupons.js` e as descrições dos cupons digam "a partir de (inclusive)".

**Correção:** troquei `<=` por `<`, uma linha só. Essa checagem é a única que trata o pedido mínimo, então a correção já vale para BEMVINDO10 (R$ 100), DESC50 (R$ 300) e FRETEGRATIS (R$ 150). O restante do comportamento ficou igual.

**Testes novos** em `test/discounts.test.js`:
- **Subtotal igual ao mínimo:** cobre os três cupons e confere o resultado completo de cada um (10% de R$ 100 = R$ 10, R$ 50 fixo e frete grátis).
- **Um centavo abaixo:** R$ 99,99 continua recusado com `MIN_SUBTOTAL`.

Rodei o teste novo antes de mexer no código e ele falhou, confirmando o bug. Depois da correção passou. Não fiz commit.