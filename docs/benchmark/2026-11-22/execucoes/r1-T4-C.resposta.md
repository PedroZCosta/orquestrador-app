**(a) Valor pago: R$ 288,88**

A conta está em `computeTotals`, na ordem abaixo. Os preços vêm do seed (LIV-001 R$ 89,90 com 0,6 kg; CAN-010 R$ 39,90 com 0,4 kg).

| Item | Valor | Cálculo |
|---|---|---|
| Subtotal | R$ 219,70 | 2 × 89,90 + 1 × 39,90 = 179,80 + 39,90 |
| Desconto | R$ 21,97 | BEMVINDO10 é 10% sobre o subtotal. O mínimo de R$ 100 é cumprido (219,70 > 100). |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97 |
| Frete | R$ 51,60 | O peso é 2 × 0,6 + 0,4 = 1,6 kg, cobrado como 2 kg. AM é região norte: base 32 + 9,80 × 2 = 51,60. Não é grátis, porque 197,73 fica abaixo de 299,90 e o cupom não dá frete grátis. |
| Imposto | R$ 39,55 | AM tem alíquota de 20%, aplicada sobre o subtotal com desconto: 197,73 × 0,20 = 39,546, arredondado para 39,55. O frete não é tributado. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

Fiz as contas à mão sobre o código e não rodei o projeto.

**(b) Gateway responde `timeout` em todas as tentativas**

- **Cobranças:** 3, que é `maxAttempts`. O `timeout` é tratado como falha temporária (`retryable`), então ela tenta de novo até esgotar as tentativas.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª cobrança, e 400 ms entre a 2ª e a 3ª. São 600 ms no total. Não há espera depois da última.
- **Status do pedido:** termina em `payment_failed`, com `payment.attempts = 3` e `failureReason = 'timeout'`.
- **Reserva de estoque:** é liberada com `inventory.release`. As 2 unidades de LIV-001 e a 1 de CAN-010 voltam a ficar disponíveis, e nada sai do `onHand`.
- **Mensagem à cliente:** sai pelo evento `payment.failed`, com o assunto "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." A assinatura traz o nome da loja e o e-mail de suporte.
- **Relatório de vendas:** o pedido não entra, porque `salesReport` exclui os pedidos com status `payment_failed`.

**(c) Arquivos com as regras**

Todos ficam em `src/`:
- `catalog/seed.js`: preços e pesos dos produtos.
- `pricing/pricing.js`: ordem do cálculo do total.
- `pricing/coupons.js` e `pricing/discounts.js`: cupom BEMVINDO10 e regra de mínimo e percentual.
- `pricing/shipping.js`: frete, peso arredondado para cima e frete grátis.
- `pricing/tax.js`: imposto.
- `config.js`: alíquota e região de AM, tabela de frete, limite de frete grátis, `maxAttempts` e `backoffMs` (`[200, 400]`).
- `payments/paymentService.js`: tentativas e espera entre elas.
- `payments/paymentGateway.js`: contrato do gateway e o campo `retryable`.
- `orders/orderService.js` (`payOrder`): ligação entre pagamento, reserva e eventos.
- `orders/order.js`: status e transições.
- `inventory/inventory.js`: `reserve`, `commit` e `release`.
- `notifications/templates.js`: mensagem `payment.failed`.
- `reports/salesReport.js`: exclusão de `payment_failed`.

Não alterei nenhum arquivo e não fiz commit.