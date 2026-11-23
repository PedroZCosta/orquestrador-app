**(a) Valores do pedido (Manaus, AM)**

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor é calculado:
- **Subtotal:** 2 × R$ 89,90 (LIV-001) + 1 × R$ 39,90 (CAN-010) = R$ 219,70.
- **Desconto:** BEMVINDO10 dá 10% sobre o subtotal. O cupom exige subtotal acima de R$ 100, e R$ 219,70 atende. Desconto = R$ 21,97, e o subtotal com desconto fica em R$ 197,73.
- **Frete:** é calculado sobre o subtotal já com desconto.
  - R$ 197,73 está abaixo do limite de frete grátis (R$ 299,90), então há cobrança.
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima = 2 kg.
  - AM está na região norte: base R$ 32,00 + R$ 9,80 × 2 kg = R$ 51,60.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal com desconto: 197,73 × 0,20 = 39,546, arredondado para R$ 39,55. O frete não é tributado.
- **Total:** subtotal com desconto + imposto + frete = 197,73 + 39,55 + 51,60 = R$ 288,88.

**(b) Gateway responde `timeout` em todas as tentativas**

Considerei que o gateway marca o `timeout` como `retryable: true`, como no exemplo do comentário do código.
- **Cobranças:** 3 (`maxAttempts` = 3).
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada (`inventory.release`), e os itens voltam ao estoque.
- **Mensagem à cliente:** o assunto é "Pagamento do pedido <id> não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido <id> (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." A assinatura da loja vem em seguida.
- **Relatório de vendas:** não entra. O `salesReport` exclui os pedidos com status `payment_failed`.

**(c) Arquivos com as regras (em `src/`)**
- `catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `pricing/coupons.js`: definição do BEMVINDO10.
- `pricing/discounts.js`: validação e cálculo do desconto.
- `pricing/pricing.js`: ordem dos cálculos e total.
- `pricing/shipping.js`: frete.
- `pricing/tax.js`: imposto.
- `config.js`: alíquota e região de AM, tabela de frete, limite de frete grátis, `maxAttempts` e `backoffMs`.
- `payments/paymentService.js`: tentativas e espera.
- `payments/paymentGateway.js`: define o que é falha temporária (`retryable`).
- `orders/orderService.js`: `payOrder` (status e liberação do estoque).
- `orders/order.js`: `markPaymentFailed`.
- `notifications/templates.js`: texto da mensagem `payment.failed`.
- `reports/salesReport.js`: exclusão de pedidos `payment_failed`.

Não alterei nem criei arquivos, e não fiz commit.