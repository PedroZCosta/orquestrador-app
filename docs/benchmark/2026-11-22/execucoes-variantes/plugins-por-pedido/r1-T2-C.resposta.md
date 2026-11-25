O cancelamento de pedidos está implementado. O executor rodou `npm test` e passaram os 61 testes, sem falhas. Eu não rodei os testes de novo. Não houve commit nem push.

- **Validação e erros:** `OrderService#cancelOrder(orderId, reason)` devolve o pedido atualizado. Sem `reason` lança `VALIDATION_ERROR`. Pedido inexistente lança `ORDER_NOT_FOUND`. Qualquer status diferente de `pending` ou `paid`, inclusive `cancelled`, lança `ORDER_NOT_CANCELLABLE`.
- **Status e histórico:** `cancelled` entrou em `ORDER_STATUSES`. O pedido guarda `cancelReason` e `cancelledAt` e ganha a entrada no histórico.
- **Pedido pendente:** desfaz a reserva de estoque, sem estorno.
- **Pedido pago:** estorna o valor total pelo gateway com o `paymentId`, uma única vez, e devolve os itens ao estoque físico. O estorno vem antes de qualquer mudança de estoque ou de estado. Se o gateway recusar, lança `REFUND_FAILED`, o pedido continua `paid` e o estoque não muda.
- **Evento e mensagem:** emite `order.cancelled` com `{ orderId, email, name, reason, refunded }`. O cliente recebe a mensagem com o assunto `Pedido <id> cancelado`. No caso de pedido pago, o corpo acrescenta que o estorno foi solicitado.
- **Relatório:** `salesReport` deixa de contar pedidos cancelados.
- **Testes e README:** os testes novos estão em `test/cancelOrder.test.js` e cobrem todos os casos pedidos. O README foi atualizado.

Duas coisas além do pedido:
- **`PaymentService#refund`:** o `FakePaymentGateway` já tinha `refund`, mas faltava o método no `PaymentService`, que o `OrderService` usa. O executor adicionou, sem novas tentativas.
- **Cancelamentos simultâneos:** dois cancelamentos ao mesmo tempo no mesmo pedido pago poderiam estornar duas vezes. Há uma proteção: só o primeiro passa e o segundo recebe `ORDER_NOT_CANCELLABLE`. Um teste cobre isso.

Arquivos alterados: `src/orders/order.js`, `src/orders/orderService.js`, `src/payments/paymentService.js`, `src/notifications/templates.js`, `src/reports/salesReport.js` e `README.md`. O arquivo novo é `test/cancelOrder.test.js`.

Não ficou nada pendente.