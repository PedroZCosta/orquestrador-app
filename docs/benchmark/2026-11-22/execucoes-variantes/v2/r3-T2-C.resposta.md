O cancelamento de pedidos está implementado e `npm test` passa: 61 testes, 61 ok, 0 falhas (rodei de novo ao final). Não fiz commit.

**Núcleo (`src/`)**
- **Status e pedido:** `cancelled` entrou em `ORDER_STATUSES`. `pending` e `paid` podem ir para ele. O pedido guarda `cancelReason` e `cancelledAt` e ganha a entrada no histórico (em `order.js`).
- **`OrderService#cancelOrder(orderId, reason)`** (`orderService.js`):
  - **Validação:** `reason` vazio dá `VALIDATION_ERROR`, pedido inexistente dá `ORDER_NOT_FOUND` e status fora de `pending`/`paid` dá `ORDER_NOT_CANCELLABLE`.
  - **Pendente:** libera a reserva de estoque, sem estorno.
  - **Pago:** estorna o total antes de mudar qualquer estado. Se o gateway recusar, lança `REFUND_FAILED` e o pedido segue `paid`, com o estoque intacto. Se aprovar, os itens voltam ao estoque físico.
  - **Evento:** emite `order.cancelled` com `{ orderId, email, name, reason, refunded }`.
- **Mensagem ao cliente:** novo template com o assunto `Pedido <id> cancelado` (`templates.js`).
- **Relatório:** `salesReport` ignora pedidos cancelados.

**Testes e README**
- Novo `test/cancelOrder.test.js`, mais casos em `salesReport.test.js` e `notifier.test.js`. Eles cobrem os dois fluxos de cancelamento, a recusa do estorno, o estorno uma única vez, os status não canceláveis, o evento e a mensagem.
- O `README.md` ganhou uma seção "Cancelamento".

**Pendente**
- `PaymentService` só tem `charge`, então `cancelOrder` chama `payments.gateway.refund` direto. Um `PaymentService.refund` seria mais limpo, mas não estava no plano e não o criei.