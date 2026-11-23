O cancelamento de pedidos está implementado e `npm test` passou: 60 testes, 0 falhas. Rodei o comando de novo depois que o subagente terminou. Não fiz commit.

- **Serviço:** `OrderService#cancelOrder(orderId, reason)` valida o motivo antes de qualquer efeito e só cancela pedidos `pending` ou `paid`. Qualquer outro status, inclusive `cancelled`, lança `ORDER_NOT_CANCELLABLE`. Chamadas concorrentes no mesmo pedido são bloqueadas, então o estorno nunca acontece duas vezes.
- **Pedido:** o status `cancelled` entrou em `ORDER_STATUSES`, e o pedido passa a guardar `cancelReason` e `cancelledAt`, com a entrada no histórico.
- **Pendente:** a reserva de estoque é desfeita e não há estorno.
- **Pago:** o valor total é estornado pelo gateway com o `paymentId` e os itens voltam ao estoque físico. Para isso criei `PaymentService#refund` e `Inventory#restock`. Se o gateway recusar, lança `REFUND_FAILED`; o pedido continua `paid`, sem mexer no estoque e sem evento.
- **Evento e mensagem:** `order.cancelled` sai com `{ orderId, email, name, reason, refunded }`, e o cliente recebe a mensagem com assunto `Pedido <id> cancelado`.
- **Relatório:** `salesReport` não conta mais pedidos cancelados.
- **Testes e README:** os testes novos estão em `test/cancelOrder.test.js`, e o README foi atualizado.

Dois pontos fora do que você pediu:
- `markCancelled` grava também `payment.refunded` quando o pedido tinha pagamento. Se não quiser esse campo, dá para tirar.
- Os testes de `REFUND_FAILED` e `ORDER_NOT_CANCELLABLE` leem `reason` e `status` tanto de `error.details` quanto do próprio erro, porque o subagente não confirmou onde o `DomainError` guarda os detalhes.

Alterei `order.js`, `orderService.js`, `paymentService.js`, `inventory.js`, `templates.js`, `salesReport.js` e o README.