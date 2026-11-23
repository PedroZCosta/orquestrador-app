O cancelamento de pedidos está implementado e `npm test` passa: 61 testes, 61 aprovados, 0 falhas. Não fiz commit.

- **`cancelOrder(orderId, reason)`:** valida o motivo e busca o pedido primeiro, então `VALIDATION_ERROR` e `ORDER_NOT_FOUND` saem antes de qualquer efeito. Só aceita `pending` ou `paid`; qualquer outro status, inclusive `cancelled`, lança `ORDER_NOT_CANCELLABLE`.
- **Pedido:** ganhou o status `cancelled` e os campos `cancelReason` e `cancelledAt`. O cancelamento entra no histórico. O pedido também guarda `refund` (`{refundId, amount}`) quando houve estorno, algo que você não pediu.
- **Pendente:** desfaz a reserva de estoque, sem estorno.
- **Pago:**
  - Estorna o valor total pelo gateway com o `paymentId` do pagamento e devolve os itens ao estoque físico.
  - Se o gateway recusar, lança `REFUND_FAILED` e o pedido continua `paid`, sem mexer em estoque, histórico nem evento.
  - Cancelamentos simultâneos do mesmo pedido estornam uma vez só; a segunda chamada recebe `ORDER_NOT_CANCELLABLE`.
- **`PaymentService`:** não tinha `refund`, então acrescentei um que repassa ao gateway.
- **Evento e mensagem:** `order.cancelled` sai com `{ orderId, email, name, reason, refunded }`. O cliente recebe a mensagem `Pedido <id> cancelado`, que menciona o estorno quando houve.
- **`salesReport`:** deixa de contar pedidos cancelados.
- **Testes e README:** os testes novos estão em `orderService`, `salesReport` e `notifier`. O README ganhou o novo passo no fluxo do pedido.