**(a) Valores do pedido (Manaus/AM, 2× LIV-001 + 1× CAN-010, BEMVINDO10, cartão)**

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor é calculado:
- **Subtotal:** 2 × 89,90 + 1 × 39,90 = 219,70. Os preços vêm de `SEED_PRODUCTS`.
- **Desconto:** o BEMVINDO10 dá 10% sobre o subtotal e exige subtotal acima de R$ 100,00. A regra é "maior que", não "maior ou igual". Como 219,70 passa, o desconto é 21,97. O subtotal com desconto fica em 197,73.
- **Frete:**
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg cobráveis.
  - AM fica na região norte, com base de R$ 32,00 e R$ 9,80 por kg: 32 + 9,8 × 2 = 51,60.
  - O frete grátis exige subtotal com desconto de pelo menos R$ 299,90 (ou um cupom de frete grátis). 197,73 não chega lá, então o frete é cobrado.
- **Imposto:** a alíquota de AM é 20%, aplicada sobre o subtotal já com desconto: 197,73 × 0,20 = 39,546, que arredonda para 39,55. O frete não entra na base.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88.

**(b) Gateway responde `timeout` em todas as tentativas**

Parti do princípio de que `timeout` chega ao serviço como falha temporária (`retryable: true`), como você descreveu.
- **Cobranças:** 3, que é o `maxAttempts`.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Depois da última não há espera.
- **Status final:** o pedido termina como `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada (`inventory.release`), então as unidades voltam ao disponível. Nada é baixado do estoque físico.
- **Mensagem à cliente:** sai um e-mail do evento `payment.failed`. O assunto é "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser."
- **Relatório de vendas:** não entra. `salesReport` filtra fora os pedidos com status `payment_failed`.

**(c) Onde estão as regras**
- Preços e peso dos produtos, e estoque inicial: `src/catalog/seed.js`
- Alíquotas por estado, frete por região, limite de frete grátis, tentativas e espera do pagamento: `src/config.js`
- Cupons: `src/pricing/coupons.js` (definição) e `src/pricing/discounts.js` (validação e cálculo)
- Composição dos totais: `src/pricing/pricing.js`
- Frete: `src/pricing/shipping.js`
- Imposto: `src/pricing/tax.js`
- Tentativas e espera do pagamento: `src/payments/paymentService.js`
- Comportamento do gateway de teste: `src/payments/paymentGateway.js`
- Fluxo de falha (status, liberação da reserva, evento): `src/orders/orderService.js` (`payOrder`)
- Reserva e liberação de estoque: `src/inventory/inventory.js`
- Texto do e-mail: `src/notifications/templates.js`
- Exclusão do relatório: `src/reports/salesReport.js`

Não alterei nem criei arquivos, e não fiz commit. Também não executei o código: os valores vêm da leitura das regras.