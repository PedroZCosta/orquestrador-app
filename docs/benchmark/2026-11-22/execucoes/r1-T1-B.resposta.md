Corrigido: o pedido mínimo dos cupons agora é inclusivo, e `npm test` passa com 53 testes e 0 falhas.

- **Causa:** em `src/pricing/discounts.js:19`, a comparação era `subtotal <= coupon.minSubtotal`, que recusava o pedido quando o subtotal era igual ao mínimo. Troquei por `<`.
- **Alcance:** a checagem é única, então vale para BEMVINDO10 (R$ 100), DESC50 (R$ 300) e FRETEGRATIS (R$ 150). Nada mais foi alterado.
- **Testes novos** em `test/discounts.test.js`:
  - Subtotal exatamente igual ao mínimo é aceito nos três cupons. No BEMVINDO10 confere também o desconto de R$ 10,00.
  - R$ 99,99 continua recusado com `MIN_SUBTOTAL`.

Não fiz commit, como pedido.

Um deslize meu no caminho: o primeiro `sed` falhou (sintaxe do macOS) e rodei `npm test` sem notar que a correção não tinha sido aplicada. Refiz as edições com o Edit e rodei os testes de novo.