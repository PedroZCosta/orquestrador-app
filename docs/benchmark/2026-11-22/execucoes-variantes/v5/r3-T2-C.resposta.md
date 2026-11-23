O cancelamento de pedidos está implementado em `OrderService#cancelOrder(orderId, reason)`, e o `npm test` passou com 58 testes e 0 falhas (resultado relatado pelo subagente, que eu não rodei de novo). Não fiz commit.

- **Regras do pedido:** o novo status `cancelled`, `cancelReason`, `cancelledAt` e a entrada no histórico estão em `src/orders/order.js`. A validação, o estorno, o estoque e o evento `order.cancelled` estão em `src/orders/orderService.js`.
- **Mensagem e relatório:** o assunto `Pedido <id> cancelado` vem do template novo em `src/notifications/templates.js`. O `salesReport` (`src/reports/salesReport.js`) agora ignora pedidos cancelados.
- **Testes e README:** `test/orderService.test.js` ganhou o bloco `cancelOrder` e `test/salesReport.test.js` ganhou um caso. O README tem uma seção "Cancelamento" nova.
- **Extra que não estava no pedido:** duas chamadas simultâneas a um pedido `paid` não estornam duas vezes, e a segunda recebe `ORDER_NOT_CANCELLABLE`.

Não ficou nada pendente.