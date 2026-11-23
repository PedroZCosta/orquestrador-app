## (a) Valores do pedido

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Estes valores vêm da leitura do código; não executei nada.

Como cada valor é calculado:
- **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 = 219,70.
- **Desconto:** BEMVINDO10 é 10% sobre o subtotal. Exige subtotal acima de R$ 100,00 (a checagem usa `<=`, então 100 exato seria recusado), e 219,70 passa. 10% de 219,70 = 21,97. O subtotal com desconto fica em 197,73.
- **Frete:** é calculado sobre o subtotal já com desconto.
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima para 2 kg.
  - AM está na região norte, com base de R$ 32,00 e R$ 9,80 por kg: 32 + 9,80 × 2 = 51,60.
  - Não há frete grátis, porque 197,73 é menor que o limite de 299,90 e o cupom não é de frete grátis.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal com desconto (o frete não é tributado). 197,73 × 0,20 = 39,546, que arredonda para 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88. A forma de pagamento (cartão) não altera o valor.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3, que é `maxAttempts`. `timeout` é falha temporária (`retryable`), então ele tenta de novo até esgotar as tentativas.
- **Espera entre elas:** 200 ms antes da 2ª tentativa e 400 ms antes da 3ª. Não há espera depois da última.
- **Status final:** `payment_failed`. O pedido guarda `reason = 'timeout'` e `attempts = 3`.
- **Reserva de estoque:** é liberada (`inventory.release`). As 2 unidades de LIV-001 e a 1 de CAN-010 voltam ao disponível, e nada sai do estoque definitivamente.
- **Mensagem à cliente:** o evento `payment.failed` dispara este e-mail:
  - Assunto: "Pagamento do pedido ORD-… não aprovado".
  - Corpo: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser."
  - O e-mail termina com a assinatura da loja.
- **Relatório de vendas:** não entra. `salesReport` exclui os pedidos com status `payment_failed`.

## (c) Onde estão as regras

- **Valores (a):**
  - `src/catalog/seed.js`: preços e pesos dos produtos.
  - `src/pricing/coupons.js`: definição do cupom BEMVINDO10.
  - `src/pricing/discounts.js`: avaliação do cupom e cálculo do subtotal.
  - `src/pricing/shipping.js`: cálculo do frete.
  - `src/pricing/tax.js`: cálculo do imposto.
  - `src/pricing/pricing.js`: ordem dos cálculos e total.
  - `src/config.js`: alíquota e região de AM, tabela de frete e limite de frete grátis.
- **Cobrança e falha (b):**
  - `src/config.js`: `PAYMENT.maxAttempts` e `backoffMs`.
  - `src/payments/paymentService.js`: laço de tentativas e espera.
  - `src/payments/paymentGateway.js`: gateway falso e o formato da resposta `retryable`.
  - `src/orders/orderService.js` (`payOrder`): muda o status, libera a reserva e emite o evento.
  - `src/orders/order.js` (`markPaymentFailed`): grava o status `payment_failed`.
  - `src/inventory/inventory.js` (`release`): devolve a reserva ao estoque.
  - `src/notifications/templates.js` e `src/notifications/notifier.js`: texto e envio da mensagem.
  - `src/reports/salesReport.js`: exclusão do pedido do relatório.