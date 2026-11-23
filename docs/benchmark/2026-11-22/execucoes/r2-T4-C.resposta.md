**(a) Valores do pedido**

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto (BEMVINDO10) | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto (AM, 20%) | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor sai:
- **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 = 219,70.
- **Desconto:** o cupom BEMVINDO10 é de 10% com subtotal mínimo de R$ 100. O subtotal de 219,70 passa, então o desconto é 10% de 219,70 = 21,97. O subtotal com desconto fica em 197,73.
- **Frete:** é calculado sobre o subtotal já com desconto. Como 197,73 é menor que o limite de frete grátis (299,90), o frete é cobrado. O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg. AM está na região norte, com base de R$ 32,00 mais R$ 9,80 por kg: 32 + 9,80 × 2 = 51,60.
- **Imposto:** a alíquota de AM é 20%, aplicada sobre 197,73 (com desconto, sem o frete): 39,546, arredondado para 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88. O pagamento por cartão de crédito não altera o valor.

**(b) Gateway responde `timeout` em todas as tentativas**

- **Cobranças:** 3, que é o `maxAttempts`. `timeout` é falha temporária (`retryable`), então o sistema tenta de novo até esgotar as tentativas.
- **Espera:** 200 ms entre a 1ª e a 2ª tentativa e 400 ms entre a 2ª e a 3ª, 600 ms no total. Não há espera depois da última.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Estoque:** a reserva é liberada (`inventory.release`). As unidades voltam ao disponível e nada é baixado de `onHand`.
- **Mensagem à cliente:** é enviada pelo evento `payment.failed`. O assunto é "Pagamento do pedido ORD-… não aprovado". O corpo é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." e termina com a assinatura da loja.
- **Relatório de vendas:** não entra. O `salesReport` exclui pedidos com status `payment_failed`.

Observação: o texto da mensagem mostra o motivo cru, `timeout`, sem tradução.

**(c) Onde estão as regras (em `src/`)**

- **Preços do catálogo e peso:** `catalog/seed.js`.
- **Cupom:** `pricing/coupons.js` (definição) e `pricing/discounts.js` (validação e cálculo do desconto).
- **Ordem do cálculo (subtotal, desconto, frete, imposto, total):** `pricing/pricing.js`.
- **Frete:** `pricing/shipping.js`.
- **Imposto:** `pricing/tax.js`.
- **Alíquota por estado, frete por região, limite de frete grátis e tentativas/backoff do pagamento:** `config.js`.
- **Tentativas e espera da cobrança:** `payments/paymentService.js`. O gateway falso está em `payments/paymentGateway.js`.
- **Fluxo do pedido, liberação da reserva e evento de falha:** `orders/orderService.js`.
- **Status `payment_failed`:** `orders/order.js`.
- **Reserva e liberação de estoque:** `inventory/inventory.js`.
- **Mensagem à cliente:** `notifications/templates.js` e `notifications/notifier.js`.
- **Exclusão do relatório:** `reports/salesReport.js`.

Não alterei nem criei arquivos, e não fiz commit.