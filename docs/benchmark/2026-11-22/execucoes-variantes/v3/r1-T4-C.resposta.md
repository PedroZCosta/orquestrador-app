**Resposta, a partir da leitura do código (nada foi alterado nem criado):**

## (a) Valores do pedido (Manaus/AM, 2× LIV-001 + 1× CAN-010, BEMVINDO10, cartão)

| Item | Valor |
|---|---|
| Subtotal | **R$ 219,70** |
| Desconto | **R$ 21,97** |
| Frete | **R$ 51,60** |
| Imposto | **R$ 39,55** |
| **Total** | **R$ 288,88** |

Como cada valor é calculado (`computeTotals`, nesta ordem):

1. **Subtotal:** 2 × 89,90 + 1 × 39,90 = 179,80 + 39,90 = 219,70.
2. **Desconto:** BEMVINDO10 é 10% sobre o subtotal e exige subtotal acima de R$ 100. O subtotal é 219,70, então vale: 219,70 × 10% = 21,97. O subtotal com desconto fica em 197,73.
3. **Frete:** o peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg. AM é região norte (base R$ 32,00 + R$ 9,80 por kg): 32 + 9,80 × 2 = 51,60. O frete grátis só vale com subtotal com desconto a partir de R$ 299,90. O de 197,73 não chega lá, e o cupom não dá frete grátis.
4. **Imposto:** a alíquota de AM é 20%, aplicada sobre o subtotal com desconto, sem o frete: 197,73 × 0,20 = 39,546, que arredonda para 39,55.
5. **Total:** 197,73 + 39,55 + 51,60 = 288,88. É esse valor que vai para a cobrança.

O pagamento por cartão de crédito não muda nenhum valor. `credit_card` é só um método aceito.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3 (`maxAttempts = 3`). O `timeout` é falha temporária (`retryable`), então ele tenta de novo.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª (`backoffMs: [200, 400]`). Não há espera depois da última.
- **Status final:** `payment_failed`. O `payOrder` chama `markPaymentFailed` com motivo `timeout` e 3 tentativas.
- **Reserva de estoque:** é liberada (`inventory.release`). As unidades voltam ao disponível e nada sai do estoque físico. O `commit` não roda.
- **Mensagem à cliente** (evento `payment.failed`): assunto "Pagamento do pedido ORD-… não aprovado". O corpo é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido ORD-… (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser.", seguido da assinatura da loja e do e-mail de suporte.
- **Relatório de vendas:** não entra. O `salesReport` exclui pedidos com status `payment_failed`.

## (c) Onde estão as regras

- **Preços e peso dos produtos:** `src/catalog/seed.js`.
- **Alíquota por estado, frete (base, por kg, limite de frete grátis), tentativas e backoff:** `src/config.js`.
- **Cupom BEMVINDO10 (10%, mínimo R$ 100):** `src/pricing/coupons.js`.
- **Avaliação do cupom:** `src/pricing/discounts.js`.
- **Ordem do cálculo e total:** `src/pricing/pricing.js`.
- **Frete:** `src/pricing/shipping.js`.
- **Imposto:** `src/pricing/tax.js`.
- **Arredondamento:** `src/money.js`.
- **Novas tentativas e espera:** `src/payments/paymentService.js`.
- **Resposta `retryable` do gateway:** `src/payments/paymentGateway.js`.
- **Fluxo pedido, pagamento falho e liberação da reserva:** `src/orders/orderService.js`.
- **Status do pedido:** `src/orders/order.js`.
- **Reserva e liberação de estoque:** `src/inventory/inventory.js`.
- **Texto da mensagem à cliente:** `src/notifications/templates.js`.
- **Envio da mensagem:** `src/notifications/notifier.js`.
- **Filtro do relatório:** `src/reports/salesReport.js`.

Não usei subagentes e não fiz commit.