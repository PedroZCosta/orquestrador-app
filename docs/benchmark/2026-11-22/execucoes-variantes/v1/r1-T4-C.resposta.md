Li as regras no código e vou responder direto, sem alterar nada.

## (a) Quanto ela paga (AM, 2× LIV-001, 1× CAN-010, BEMVINDO10, cartão)

| Item | Valor | Como é calculado |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 (LIV-001) = 179,80, mais 1 × 39,90 (CAN-010) |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal: 219,70 × 10% = 21,97. O cupom exige subtotal acima de R$ 100, e 219,70 passa. |
| Frete | **R$ 51,60** | Peso = 2 × 0,6 + 0,4 = 1,6 kg, arredondado para 2 kg. Região norte: base 32,00 + 9,80 × 2 = 51,60. Não é grátis, porque o subtotal com desconto (197,73) fica abaixo de R$ 299,90. |
| Imposto | **R$ 39,55** | AM tem alíquota de 20%, aplicada sobre o subtotal já com desconto: 197,73 × 0,20 = 39,546, que arredonda para 39,55. O frete não é tributado. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

O cálculo segue a ordem: subtotal, desconto, frete e imposto (ambos sobre o valor com desconto), total.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3 (`maxAttempts = 3`). O `timeout` é `retryable`, então ela tenta até o limite.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª (`backoffMs: [200, 400]`). Depois da 3ª não há espera.
- **Status final:** `payment_failed`, com `attempts = 3` e `failureReason = 'timeout'`.
- **Estoque:** a reserva é liberada com `inventory.release`. As 2 unidades de LIV-001 e a 1 de CAN-010 voltam ao disponível. Nada é baixado do estoque, porque o `commit` só ocorre com pagamento aprovado.
- **Mensagem à cliente** (evento `payment.failed`):
  - Assunto: "Pagamento do pedido <ID> não aprovado".
  - Corpo: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido <ID> (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser."
  - A assinatura da loja vem em seguida.
- **Relatório de vendas:** não entra. `salesReport` descarta os pedidos com status `payment_failed`.

## (c) Arquivos com as regras

- `src/config.js`: alíquotas por estado, frete por região, limite de frete grátis (299,90), peso máximo, tentativas e backoff do pagamento.
- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/pricing/coupons.js`: definição do BEMVINDO10.
- `src/pricing/discounts.js`: avaliação do cupom e valor do desconto.
- `src/pricing/shipping.js`: cálculo do frete.
- `src/pricing/tax.js`: cálculo do imposto.
- `src/pricing/pricing.js`: ordem dos cálculos e total.
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/payments/paymentGateway.js`: contrato do gateway (`retryable`, `reason`).
- `src/orders/orderService.js` (`payOrder`): falha de pagamento, liberação da reserva e evento `payment.failed`.
- `src/orders/order.js` (`markPaymentFailed`): status `payment_failed`.
- `src/inventory/inventory.js` (`release`): devolução da reserva.
- `src/notifications/templates.js`: texto da mensagem à cliente.
- `src/reports/salesReport.js`: exclusão dos pedidos com pagamento recusado.

Não executei o código, então os valores vêm da leitura e da conta à mão. Não alterei nem criei arquivos e não fiz commit.