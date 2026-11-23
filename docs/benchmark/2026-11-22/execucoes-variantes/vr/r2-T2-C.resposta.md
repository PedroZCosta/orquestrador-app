`OrderService#cancelOrder(orderId, reason)` está implementado conforme os 8 requisitos. O executor relatou `npm test` com 58 de 58 testes passando; não rodei de novo. Não fiz commit.

- **Cancelamento** (`src/orders/orderService.js`):
  - Pedido pendente desfaz a reserva de estoque, sem estorno.
  - Pedido pago estorna o total pelo gateway e devolve os itens ao estoque.
  - Se o gateway recusar, lança `REFUND_FAILED`, o pedido segue `paid` e o estoque não é mexido.
- **Chamadas simultâneas:** para garantir o estorno uma única vez, uma segunda chamada enquanto o pedido já está sendo cancelado recebe `ORDER_NOT_CANCELLABLE`. Isso vai além do que você descreveu.
- **Pedido e notificação:**
  - O status `cancelled`, `cancelReason` e `cancelledAt` estão em `src/orders/order.js`.
  - A mensagem `Pedido <id> cancelado` está em `src/notifications/templates.js`.
- **Relatório:** o `salesReport` ignora pedidos cancelados (`src/reports/salesReport.js`).
- **Testes e documentação:** casos novos em `test/orderService.test.js` e `test/salesReport.test.js`, e `README.md` atualizado.

Não há pendências.