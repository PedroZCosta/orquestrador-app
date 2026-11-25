O cancelamento de pedidos está implementado e `npm test` passa: 61 testes, 61 passes, 0 falhas. Não houve commit nem push. Só vi o relatório do executor, não rodei os testes por conta própria.

**O que foi feito**
- **`src/orders/order.js`:** status `cancelled`, campos `cancelReason` e `cancelledAt`, transições a partir de `pending` e `paid`, e a entrada no histórico.
- **`src/orders/orderService.js`:** `cancelOrder(orderId, reason)`.
  - `reason` vazio dá `VALIDATION_ERROR`. Pedido inexistente dá `ORDER_NOT_FOUND`. Qualquer status que não seja `pending` ou `paid` dá `ORDER_NOT_CANCELLABLE`.
  - Pedido pendente: libera a reserva de estoque, sem estorno.
  - Pedido pago: estorna pelo gateway antes de mexer em estado ou estoque e depois devolve os itens ao estoque físico. Se o gateway recusar, lança `REFUND_FAILED` e o pedido continua `paid`, com o estoque intacto.
  - Cancelamentos simultâneos do mesmo pedido estornam uma vez só, e o segundo recebe `ORDER_NOT_CANCELLABLE`.
- **`src/inventory/inventory.js`:** método novo `restock`.
- **`src/payments/paymentService.js`:** método novo `refund`.
- **`src/notifications/templates.js`:** evento `order.cancelled` e mensagem `Pedido <id> cancelado`.
- **`src/reports/salesReport.js`:** pedidos cancelados deixam de ser contados.
- **`test/cancelOrder.test.js`:** 10 testes novos, um por caso pedido (validação, não encontrado, pendente, pago, recusa do gateway, não cancelável, evento e mensagem, relatório de vendas) e um para o duplo cancelamento.
- **`README.md`:** passo de cancelamento no fluxo do pedido.
- **`src/events/eventBus.js`:** só um comentário foi alterado.

**Decisões que você pode querer revisar**
- Depois de um `REFUND_FAILED`, dá para tentar cancelar de novo.
- Em pedido estornado, gravei também `refundId` e `refundedAt` em `order.payment`. Isso não estava nos requisitos.

Não ficou nada pendente.