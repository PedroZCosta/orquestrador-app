O cancelamento de pedidos está implementado, e `npm test` passa com 61 testes aprovados e 0 falhas. Rodei o `npm test` de novo depois do subagente. Não fiz commit.

**O que mudou**
- **`OrderService#cancelOrder(orderId, reason)`**:
  - `reason` vazio ou ausente lança `VALIDATION_ERROR`, e pedido inexistente lança `ORDER_NOT_FOUND`.
  - Só cancela `pending` ou `paid`. Qualquer outro status, inclusive `cancelled`, lança `ORDER_NOT_CANCELLABLE`.
- **Pedido pendente**: desfaz a reserva de estoque e não há estorno.
- **Pedido pago**:
  - O estorno do valor total sai pelo gateway, com o `paymentId` do pagamento, uma única vez. Para isso o `PaymentService` ganhou `refund`, sem retentativas.
  - Duas chamadas simultâneas de cancelamento do mesmo pedido não geram estorno duplicado. A segunda lança `ORDER_NOT_CANCELLABLE`.
  - Os itens voltam ao estoque físico.
  - Se o gateway recusar, lança `REFUND_FAILED` e o pedido continua `paid`, sem mexer no estoque.
- **Pedido**: ganhou o status `cancelled`, os campos `cancelReason` e `cancelledAt` (do relógio da loja) e a entrada no histórico.
- **Evento e mensagem**: emite `order.cancelled` com `{ orderId, email, name, reason, refunded }`. O cliente recebe a mensagem `Pedido <id> cancelado`, no padrão das outras.
- **Relatório de vendas**: `salesReport` não conta mais pedidos cancelados.
- **Testes e README**: testes novos em `test/orderService.test.js`, `test/salesReport.test.js` e `test/notifier.test.js`, e o README tem uma seção "Cancelamento".

**Pendente**: um `??` redundante num dos testes novos, que é inofensivo.