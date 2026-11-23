Li as regras no código e calculei os valores, sem alterar nada. Segue a resposta.

## (a) Quanto ela paga

O total é **R$ 288,88**.

| Item | Valor | Cálculo |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. Vale porque 219,70 está acima do mínimo de R$ 100. |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97 |
| Frete | **R$ 51,60** | AM fica na região norte, com base de R$ 32,00 e R$ 9,80 por kg. O peso é 2 × 0,6 + 0,4 = 1,6 kg, cobrado como 2 kg: 32 + 9,80 × 2. O frete grátis não vale, porque 197,73 é menor que 299,90 e o cupom não dá frete grátis. |
| Imposto | **R$ 39,55** | AM tem alíquota de 20%. Incide sobre o subtotal com desconto, sem o frete: 197,73 × 0,20 = 39,546, arredondado para 39,55. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

A ordem do cálculo é: subtotal, desconto, frete (sobre o valor já com desconto), imposto (sobre o valor com desconto, sem frete) e total.

O comentário em `coupons.js` diz que o mínimo vale "a partir de" (inclusive). O código em `discounts.js` usa `<=` e recusa o cupom quando o subtotal é exatamente igual ao mínimo. Neste pedido isso não muda nada.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3 (`maxAttempts` = 3). O `timeout` é tratado como falha temporária (`retryable`).
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última, o que dá 600 ms no total.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada (`inventory.release`). As unidades voltam a ficar disponíveis e nada é baixado definitivamente.
- **Mensagem à cliente:** o assunto é "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Termina com a assinatura da loja e o e-mail de atendimento.
- **Relatório de vendas:** não entra. `salesReport` exclui pedidos com status `payment_failed`.

## (c) Onde estão as regras

- `src/pricing/pricing.js`: ordem do cálculo do total.
- `src/pricing/discounts.js`: avaliação do cupom e arredondamento.
- `src/pricing/coupons.js`: definição do BEMVINDO10 (10%, mínimo de R$ 100).
- `src/pricing/shipping.js`: frete, peso arredondado para cima e frete grátis.
- `src/pricing/tax.js`: imposto.
- `src/config.js`: alíquota e região de AM, tabela de frete, limite de frete grátis, tentativas (3) e espera (`[200, 400]`).
- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/payments/paymentGateway.js`: o gateway falso, usado para simular `timeout`.
- `src/orders/orderService.js` (`payOrder`): marca o pedido como falho, libera a reserva e emite o evento de falha.
- `src/orders/order.js` (`markPaymentFailed`): status `payment_failed`.
- `src/inventory/inventory.js` (`release`): devolve a reserva.
- `src/notifications/templates.js` e `src/notifications/notifier.js`: texto e envio da mensagem `payment.failed`.
- `src/reports/salesReport.js`: exclusão do pedido do relatório.