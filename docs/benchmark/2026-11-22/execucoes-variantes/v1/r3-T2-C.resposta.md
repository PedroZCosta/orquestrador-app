O cancelamento de pedidos está implementado. Rodei `npm test` e passaram os 59 testes, sem falhas. Não fiz commit.

- **`cancelOrder(orderId, reason)`:**
  - Valida o motivo antes de buscar o pedido (`VALIDATION_ERROR`). Pedido inexistente dá `ORDER_NOT_FOUND`.
  - Só cancela `pending` ou `paid`; qualquer outro status, inclusive `cancelled`, dá `ORDER_NOT_CANCELLABLE`.
  - O pedido ganha o status `cancelled`, os campos `cancelReason` e `cancelledAt` e a entrada no histórico.
- **Pedido pendente:** a reserva de estoque é desfeita e não há estorno.
- **Pedido pago:**
  - O valor total é estornado uma única vez, pelo gateway, com o `paymentId` do pagamento. Para isso criei `PaymentService#refund`, que repassa ao gateway.
  - Os itens voltam ao estoque físico.
  - Se o gateway recusar, lança `REFUND_FAILED`; o pedido continua `paid`, o estoque não muda e não sai evento nem mensagem. Dá para tentar cancelar de novo depois.
- **Chamadas simultâneas:** acrescentei uma proteção que o enunciado não pedia. Um segundo cancelamento do mesmo pedido enquanto o primeiro está em curso dá `ORDER_NOT_CANCELLABLE`, para o estorno não ser feito duas vezes.
- **Evento e mensagem:** `order.cancelled` sai com `{ orderId, email, name, reason, refunded }`. O cliente recebe a mensagem `Pedido <id> cancelado`, com o motivo e, se houve estorno, o aviso de que o valor foi estornado.
- **`salesReport`:** deixa de contar pedidos cancelados.
- **Testes e README:** os testes novos estão em `test/cancelOrder.test.js`, mais um caso em `test/salesReport.test.js`. Não acrescentei caso em `test/notifier.test.js`; a mensagem é conferida no teste de cancelamento. O README foi atualizado.

Nenhum ponto ficou pendente.