Já li as regras e fechei os cálculos, então só falta entregar a resposta.

## (a) Quanto ela paga

| Item | Valor |
|---|---|
| Subtotal | **R$ 219,70** |
| Desconto (BEMVINDO10) | **R$ 21,97** |
| Frete | **R$ 51,60** |
| Imposto (AM, 20%) | **R$ 39,55** |
| **Total** | **R$ 288,88** |

Como cada valor é calculado:
- **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 = 219,70.
- **Desconto:** o BEMVINDO10 dá 10% sobre o subtotal e exige subtotal acima de R$ 100. Como 219,70 passa disso, o desconto é 21,97. O subtotal com desconto fica em 197,73.
- **Frete:**
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg.
  - Amazonas é região norte: base de 32,00 + 9,80 × 2 kg = 51,60.
  - O frete só seria grátis com subtotal já descontado a partir de R$ 299,90. Aqui são 197,73, então ela paga o frete.
- **Imposto:** 20% (alíquota do AM) sobre o subtotal com desconto, sem incluir o frete: 197,73 × 0,20 = 39,546, que arredonda para 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3, pelo limite `maxAttempts` de 3. O `timeout` é falha temporária (`retryable`), então o sistema tenta de novo.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª tentativa, e 400 ms entre a 2ª e a 3ª. Depois da última tentativa não há espera.
- **Status final:** `payment_failed`, com o motivo `timeout` e 3 tentativas registradas.
- **Estoque:** a reserva é liberada (`inventory.release`). As unidades voltam ao disponível e nada sai do estoque de vez.
- **Mensagem à cliente:** o evento `payment.failed` dispara este e-mail:
  - Assunto: "Pagamento do pedido ORD-… não aprovado".
  - Corpo: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Termina com a assinatura da Loja Dev e o e-mail de atendimento.
- **Relatório de vendas:** não entra. O `salesReport` exclui os pedidos com status `payment_failed`.

## (c) Onde estão as regras

- **Preços e catálogo:** `src/catalog/seed.js`.
- **Cupom:** `src/pricing/coupons.js` (definição) e `src/pricing/discounts.js` (avaliação).
- **Ordem dos cálculos:** `src/pricing/pricing.js`.
- **Frete:** `src/pricing/shipping.js`.
- **Imposto:** `src/pricing/tax.js`.
- **Alíquotas, frete por região, limite de frete grátis e tentativas/espera de pagamento:** `src/config.js`.
- **Tentativas e espera da cobrança:** `src/payments/paymentService.js`. O `timeout` e o `retryable` vêm de `src/payments/paymentGateway.js`.
- **Fluxo do pedido (status e liberação da reserva):** `src/orders/orderService.js`, `src/orders/order.js` e `src/inventory/inventory.js`.
- **Mensagem à cliente:** `src/notifications/templates.js`.
- **Relatório:** `src/reports/salesReport.js`.

Não alterei nem criei nada no projeto e não fiz commit.