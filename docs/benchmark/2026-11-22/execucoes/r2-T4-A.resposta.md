A simulação rodou com o próprio código (`createStore`, gateway roteirizado com `timeout` e um `sleep` que só registra as esperas), sem criar nem alterar arquivos. Os números abaixo saíram dessa execução. O `npm test` também passou, com 0 falhas.

## (a) Quanto ela paga

| Item | Valor |
|---|---|
| Subtotal | **R$ 219,70** |
| Desconto (BEMVINDO10) | **R$ 21,97** |
| Frete | **R$ 51,60** |
| Imposto (AM) | **R$ 39,55** |
| **Total** | **R$ 288,88** |

- **Subtotal:** soma de preço × quantidade, arredondada a 2 casas. São 2 × LIV‑001 (R$ 89,90), que dão R$ 179,80, mais 1 × CAN‑010 (R$ 39,90). Total de R$ 219,70.
- **Desconto:** BEMVINDO10 dá 10% sobre o subtotal inteiro, porque não é restrito a uma categoria. Ele exige subtotal mínimo de R$ 100 (219,70 passa) e não tem validade. 10% de 219,70 dá R$ 21,97. O subtotal com desconto fica em R$ 197,73.
- **Frete:** primeiro o código verifica se o frete é grátis. Não é: o subtotal com desconto (197,73) fica abaixo do limite de R$ 299,90, e o cupom não dá frete grátis. AM pertence à região norte, cuja base é R$ 32,00, mais R$ 9,80 por kg. O peso é 2 × 0,6 + 0,4 = 1,6 kg, e o código arredonda o peso para cima, então cobra 2 kg. 32 + 9,80 × 2 = R$ 51,60.
- **Imposto:** a alíquota de AM é 20% e incide sobre o subtotal com desconto. O frete não é tributado. 197,73 × 0,20 = 39,546, arredondado para R$ 39,55.
- **Total:** subtotal com desconto + imposto + frete = 197,73 + 39,55 + 51,60 = **R$ 288,88**.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças feitas:** **3**, o máximo configurado (`maxAttempts`), cada uma de R$ 288,88. O `timeout` é marcado como falha temporária (`retryable: true`), então o sistema tenta de novo até chegar ao limite.
- **Espera entre elas:** **200 ms** entre a 1ª e a 2ª cobrança e **400 ms** entre a 2ª e a 3ª. Depois da 3ª não há espera. No total são 600 ms.
- **Status final:** **`payment_failed`**. O histórico guarda o motivo `timeout`, e o campo `payment` fica `{ paymentId: null, attempts: 3, failureReason: 'timeout' }`. Esse status é final: não há como voltar para `pending` nem pagar de novo, porque `payOrder` exige `pending`.
- **Reserva de estoque:** quando o pedido é criado, 2 unidades de LIV‑001 e 1 de CAN‑010 ficam reservadas. Com a falha, `release` desfaz a reserva e as unidades voltam a ficar disponíveis. O `onHand` não muda (fica em 20 e 30) e o `reserved` volta a 0.
- **Mensagem à cliente:** ela recebe dois e-mails.
  1. Quando o pedido é criado: "Pedido ORD‑xxxx recebido", com o valor de R$ 288,88.
  2. Depois da falha, com o assunto **"Pagamento do pedido ORD‑xxxx não aprovado"**:
     > Olá, {nome}. Não conseguimos aprovar o pagamento do pedido ORD‑xxxx (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser.
     >
     > Loja Dev
     > Dúvidas: atendimento@lojadev.example
- **Relatório de vendas:** **não entra**. O relatório descarta os pedidos com status `payment_failed`; na simulação, `orderCount` deu 0.

## (c) Onde estão as regras

- `src/catalog/seed.js`: preço e peso de LIV‑001 e CAN‑010.
- `src/pricing/coupons.js`: definição do cupom BEMVINDO10.
- `src/pricing/discounts.js`: validação do cupom e cálculo do desconto percentual.
- `src/pricing/pricing.js`: ordem do cálculo (subtotal, desconto, frete, imposto, total).
- `src/pricing/shipping.js`: cálculo do frete, com arredondamento do peso para cima e regra de frete grátis.
- `src/pricing/tax.js`: imposto sobre o subtotal com desconto.
- `src/config.js`: dados de AM (alíquota de 20%, região norte), frete por região (base 32 e 9,80/kg), limite de frete grátis (299,90) e as regras de pagamento (`maxAttempts: 3`, `backoffMs: [200, 400]`).
- `src/payments/paymentService.js`: lógica das novas tentativas e das esperas.
- `src/payments/paymentGateway.js`: contrato do gateway, com `retryable` e `reason`.
- `src/orders/orderService.js`: `payOrder`, que marca a falha, libera a reserva e emite `payment.failed`.
- `src/orders/order.js`: status e transições do pedido.
- `src/inventory/inventory.js`: `reserve` e `release` do estoque.
- `src/notifications/templates.js` e `src/notifications/notifier.js`: textos e envio dos e-mails.
- `src/reports/salesReport.js`: exclusão dos pedidos `payment_failed` do relatório.

**Divergência no código:** o comentário de `coupons.js` diz que o `minSubtotal` vale "inclusive", mas `discounts.js:19` recusa o cupom com `subtotal <= minSubtotal`. Assim, um pedido de exatamente R$ 100,00 não ganharia o BEMVINDO10. Isso não afeta este caso, porque o subtotal é R$ 219,70.