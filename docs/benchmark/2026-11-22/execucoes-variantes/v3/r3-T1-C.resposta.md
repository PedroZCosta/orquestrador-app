Corrigi o bug: o pedido mínimo dos cupons agora é inclusivo, então um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito. `npm test` passou, com 54 testes aprovados e 0 falhas. Não fiz commit.

- **Correção:** em `src/pricing/discounts.js:19`, a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Isso vale para todos os cupons com mínimo (BEMVINDO10, DESC50 e FRETEGRATIS). Nada mais foi alterado.
- **Testes novos:** em `test/discounts.test.js`, três casos com subtotal exatamente igual ao mínimo, todos aceitos:
  - BEMVINDO10 com 1 × R$ 100,00, desconto de R$ 10,00.
  - DESC50 com 1 × R$ 300,00, desconto de R$ 50,00.
  - FRETEGRATIS com 1 × R$ 150,00, frete grátis.
- **Teste existente:** o "abaixo do mínimo é recusado" continua válido (79,80 retorna `MIN_SUBTOTAL`).
- **Arredondamento:** o subagente verificou o cálculo do subtotal. Casos como 3 × 33,33333 e 1000 × 0,1 fecham em 100, então um pedido de R$ 100,00 não fica abaixo do mínimo por erro de ponto flutuante.

Não há pendências.