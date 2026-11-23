## (a) Quanto ela paga

O total é **R$ 288,88**. Os valores abaixo vêm de `computeTotals` e dos arquivos de regras de preço e frete.

| Item | Valor | Como é calculado |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 (LIV-001) = 179,80, mais 1 × 39,90 (CAN-010) = 39,90. |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. O mínimo de R$ 100 é cumprido, porque a regra exige subtotal maior que o mínimo e 219,70 é maior que 100. |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97. É a base do frete e do imposto. |
| Frete | **R$ 51,60** | O peso é 2 × 0,6 + 0,4 = 1,6 kg, cobrado como 2 kg (arredonda para cima). AM fica na região norte: base 32,00 + 9,80 × 2 = 51,60. O frete não é grátis, porque 197,73 é menor que 299,90 e o cupom não dá frete grátis. |
| Imposto | **R$ 39,55** | A alíquota do AM é 20%. 197,73 × 0,20 = 39,546, que arredonda para 39,55. O frete não é tributado. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60. |

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** são 3 (`PAYMENT.maxAttempts = 3`). `timeout` é falha temporária (`retryable`), então ela tenta de novo até o limite.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª tentativa, e 400 ms entre a 2ª e a 3ª. Depois da última não há espera.
- **Status final:** o pedido termina em `payment_failed`, com `attempts: 3` e motivo `timeout`.
- **Estoque:** a reserva é desfeita com `inventory.release`. As unidades voltam ao disponível e nada sai do estoque físico.
- **Mensagem à cliente:** o evento `payment.failed` dispara este e-mail:
  - Assunto: "Pagamento do pedido <id> não aprovado".
  - Corpo: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido <id> (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Depois vem a assinatura da loja.
- **Relatório de vendas:** não entra. `salesReport` exclui pedidos com status `payment_failed`.

## (c) Arquivos com as regras

- `src/config.js`: alíquotas por estado, frete por região, limite de frete grátis, tentativas e backoff de pagamento.
- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/pricing/pricing.js`: ordem do cálculo do total.
- `src/pricing/coupons.js` e `src/pricing/discounts.js`: cupom BEMVINDO10 e cálculo do desconto.
- `src/pricing/shipping.js` e `src/pricing/tax.js`: frete e imposto.
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/payments/paymentGateway.js`: contrato do gateway e o que é falha temporária.
- `src/orders/orderService.js` e `src/orders/order.js`: fluxo de `payOrder` e status do pedido.
- `src/inventory/inventory.js`: reserva, `commit` e `release`.
- `src/notifications/templates.js`: texto da mensagem de falha.
- `src/reports/salesReport.js`: exclusão de `payment_failed` do relatório.

Não alterei nem criei arquivos, e não fiz commit.