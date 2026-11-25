**(a) Valores do pedido (Manaus, AM, região norte; 2 × LIV-001 e 1 × CAN-010; BEMVINDO10)**

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor é calculado (`computeTotals`, nesta ordem):
- **Subtotal:** 2 × 89,90 + 1 × 39,90 = 179,80 + 39,90 = R$ 219,70.
- **Desconto:** BEMVINDO10 dá 10% e exige subtotal acima de R$ 100. O subtotal é 219,70, então o cupom vale. 10% de 219,70 = R$ 21,97. O subtotal com desconto fica em R$ 197,73.
- **Frete:** o peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima para 2 kg. O frete grátis só vale a partir de R$ 299,90 sobre o subtotal com desconto, e 197,73 fica abaixo disso. Na região norte, a base é R$ 32,00 e o adicional é R$ 9,80 por kg: 32 + 9,80 × 2 = R$ 51,60.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal com desconto, sem incluir o frete. 197,73 × 0,20 = 39,546, que arredonda para R$ 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = R$ 288,88.

A forma de pagamento (cartão de crédito) não altera nenhum desses valores.

**(b) Gateway responde `timeout` em todas as tentativas**
- **Cobranças:** 3 (`maxAttempts` = 3). O `timeout` é tratado como falha temporária (`retryable`).
- **Espera:** 200 ms entre a 1ª e a 2ª tentativa e 400 ms entre a 2ª e a 3ª, somando 600 ms. Não há espera depois da última.
- **Status:** o pedido termina em `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Estoque:** a reserva é desfeita (`inventory.release`). As 3 unidades voltam ao disponível e nada sai do estoque.
- **Mensagem à cliente:** é disparado o evento `payment.failed`. O e-mail tem o assunto "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." e traz a assinatura da loja.
- **Relatório de vendas:** não entra. `salesReport` exclui os pedidos com status `payment_failed`.

**(c) Arquivos com as regras**
- Alíquotas por estado, frete (base, adicional por kg, limite de frete grátis, peso máximo) e pagamento (tentativas, backoff): `src/config.js`
- Preços e pesos dos produtos: `src/catalog/seed.js`
- Cupom BEMVINDO10: `src/pricing/coupons.js`
- Avaliação do cupom e cálculo do desconto: `src/pricing/discounts.js`
- Ordem do cálculo e total: `src/pricing/pricing.js`
- Frete: `src/pricing/shipping.js`
- Imposto: `src/pricing/tax.js`
- Arredondamento: `src/money.js`
- Criação do pedido, falha de pagamento e liberação da reserva: `src/orders/orderService.js`
- Status `payment_failed`: `src/orders/order.js`
- Reserva e liberação do estoque: `src/inventory/inventory.js`
- Tentativas e espera entre elas: `src/payments/paymentService.js`
- Tipo de resposta do gateway (`retryable`): `src/payments/paymentGateway.js`
- Texto da mensagem à cliente: `src/notifications/templates.js`
- Exclusão do relatório: `src/reports/salesReport.js`

Não alterei nem criei arquivos no projeto e não fiz commit.