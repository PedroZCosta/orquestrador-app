O pedido mínimo dos cupons agora é inclusivo. Um pedido de exatamente R$ 100,00 com BEMVINDO10 é aceito.

- **Correção:** em `src/pricing/discounts.js` linha 19, a comparação `subtotal <= coupon.minSubtotal` virou `subtotal < coupon.minSubtotal`. Como a checagem é genérica, vale para todos os cupons com mínimo. Nada mais mudou.
- **Teste novo:** em `test/discounts.test.js`, "exatamente no mínimo é aceito" avalia BEMVINDO10 com um item de R$ 100,00 e espera `ok` verdadeiro e desconto de 10.
- **Verificação:** o subagente rodou `npm test` e passaram 52 testes, 0 falhas. Eu só conferi o `git diff --stat` (2 arquivos, 7 inserções, 1 remoção) e não rodei o `npm test` de novo.

Não fiz commit e não ficou nada pendente.