O cancelamento de pedidos está implementado e o `npm test` passa: 61 testes, 0 falhas. Rodei o comando de novo depois do subagente. Dos 61 testes, 10 são novos. Não fiz commit.

**O que mudou**
- **`OrderService#cancelOrder(orderId, reason)`:** `reason` vazio ou só com espaços lança `VALIDATION_ERROR`. Pedido inexistente lança `ORDER_NOT_FOUND`. Só cancela `pending` ou `paid`; qualquer outro status, inclusive `cancelled`, lança `ORDER_NOT_CANCELLABLE`.
- **Pedido (`src/orders/order.js`):** novo status `cancelled`. O pedido guarda `cancelReason` e `cancelledAt` e ganha a entrada no histórico.
- **Pendente:** desfaz a reserva de estoque, sem estorno.
- **Pago:** estorna o total pelo gateway com o `paymentId` e devolve os itens ao estoque físico. Se o gateway recusar, lança `REFUND_FAILED`, o pedido continua `paid` e o estoque não é alterado.
- **Estorno único:** dois cancelamentos simultâneos do mesmo pedido pago estornam uma vez só. A segunda chamada recebe `ORDER_NOT_CANCELLABLE`.
- **`PaymentService#refund`:** método novo, que delega ao gateway.
- **Evento e mensagem:** `order.cancelled` com `{ orderId, email, name, reason, refunded }`, e o cliente recebe a mensagem `Pedido <id> cancelado`.
- **`salesReport`:** ignora pedidos cancelados.
- **Testes e README:** os testes novos estão em `test/cancelOrder.test.js`, e o README foi atualizado.

**Ponto de atenção:** o corpo da mensagem diz "O valor pago será estornado." quando houve estorno, mas não mostra o valor. O payload que você especificou não traz o valor. Para exibi-lo, seria preciso acrescentar um campo como `refundedAmount` ao evento.