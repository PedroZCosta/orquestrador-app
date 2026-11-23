**(a) Valores do pedido** (AM, região norte; 2 × LIV-001 a R$ 89,90 e 1 × CAN-010 a R$ 39,90; cupom BEMVINDO10; cartão)

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Não rodei o código, calculei a partir das regras. Como cada valor sai:

- **Subtotal:** 2 × 89,90 + 1 × 39,90 = 179,80 + 39,90 = 219,70.
- **Desconto:** BEMVINDO10 dá 10% sobre o subtotal e exige subtotal acima de R$ 100. O código usa `<=` ao recusar, então exatamente R$ 100 seria recusado, apesar de a descrição dizer "a partir de". Aqui isso não pesa, porque 219,70 passa. O desconto é 10% de 219,70 = 21,97, e o subtotal com desconto fica em 197,73.
- **Frete:** é calculado sobre o subtotal com desconto, 197,73, que está abaixo do limite de frete grátis (299,90). O cupom também não dá frete grátis. O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg. Na região norte são base R$ 32,00 mais R$ 9,80 por kg: 32 + 9,80 × 2 = 51,60.
- **Imposto:** AM tem alíquota de 20% sobre o subtotal com desconto, sem incluir o frete. 197,73 × 0,20 = 39,546, que arredonda para 39,55.
- **Total:** subtotal com desconto + imposto + frete = 197,73 + 39,55 + 51,60 = 288,88. O método de pagamento (cartão) não altera nenhum valor.

**(b) Gateway responde `timeout` em todas as tentativas**

- **Cobranças:** 3 (`PAYMENT.maxAttempts`), porque `timeout` é falha temporária (`retryable`).
- **Espera:** 200 ms entre a 1ª e a 2ª tentativa e 400 ms entre a 2ª e a 3ª. Não há espera depois da última.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada com `inventory.release`. As unidades voltam ao disponível e nada é baixado definitivamente, pois o `commit` só ocorre quando o pagamento é aprovado.
- **Mensagem à cliente:** é disparada pelo evento `payment.failed`. O assunto é "Pagamento do pedido <id> não aprovado" e o corpo é: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido <id> (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Ela termina com a assinatura da loja e o e-mail de atendimento.
- **Relatório de vendas:** o pedido não entra, porque `salesReport` exclui pedidos `payment_failed`.

**(c) Onde estão as regras**

- **Preços e produtos:** `src/catalog/seed.js`
- **Cupom:** `src/pricing/coupons.js` e `src/pricing/discounts.js`
- **Ordem do cálculo (subtotal, desconto, frete, imposto, total):** `src/pricing/pricing.js`
- **Frete:** `src/pricing/shipping.js`
- **Imposto:** `src/pricing/tax.js`
- **Alíquota, tarifas de frete, limite de frete grátis e parâmetros de pagamento (tentativas e backoff):** `src/config.js`
- **Arredondamento:** `src/money.js` (`round2`)
- **Tentativas e esperas de cobrança:** `src/payments/paymentService.js`
- **Resposta `timeout` do gateway:** `src/payments/paymentGateway.js`
- **Status do pedido e liberação da reserva:** `src/orders/orderService.js` (`payOrder`), `src/orders/order.js` e `src/inventory/inventory.js`
- **Mensagem à cliente:** `src/notifications/templates.js` e `src/notifications/notifier.js`
- **Exclusão do relatório:** `src/reports/salesReport.js`