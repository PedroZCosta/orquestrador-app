O bug está corrigido: um pedido de R$ 100,00 com BEMVINDO10 agora é aceito. O subagente rodou `npm test` e relatou 52 testes passando e 0 falhando. Não rodei de novo por conta própria e não fiz commit.

- **Correção:** em `src/pricing/discounts.js` (linha 19), a recusa era `subtotal <= coupon.minSubtotal` e passou a ser `subtotal < coupon.minSubtotal`. É uma checagem única, então o mínimo inclusivo vale para todos os cupons com mínimo. Nada mais foi alterado.
- **Teste novo:** em `test/discounts.test.js`, "subtotal exatamente igual ao mínimo é aceito". Ele usa BEMVINDO10 com subtotal 100 e espera desconto de 10.

Não ficou nada pendente.