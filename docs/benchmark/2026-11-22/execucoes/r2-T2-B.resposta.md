`OrderService#cancelOrder(orderId, reason)` está implementado e `npm test` passa: 58 testes, 0 falhas. Não fiz commit.

- **Validação e status:** o `reason` é validado com `requireString` e gravado já sem espaços nas pontas. Pedido inexistente dá `ORDER_NOT_FOUND`. Qualquer status fora de `pending` e `paid` dá `ORDER_NOT_CANCELLABLE`. O novo status `cancelled` entra em `ORDER_STATUSES`, e o pedido guarda `cancelReason`, `cancelledAt` e a entrada no histórico (com `reason` e `refunded`).
- **Pedido pendente:** desfaz a reserva (`inventory.release`) e não estorna.
- **Pedido pago:** estorna o total com o `paymentId`. Se o gateway recusar (ou lançar exceção), dá `REFUND_FAILED`. Nesse caso o pedido continua `paid`, o estoque não muda e nenhum evento é emitido. Se o estorno passar, os itens voltam ao estoque físico por um novo `Inventory#restock`.
- **Evento e mensagem:** emite `order.cancelled` com `{ orderId, email, name, reason, refunded }`. O cliente recebe a mensagem com assunto `Pedido <id> cancelado`, seguindo o padrão das outras mensagens.
- **Relatório e README:** `salesReport` não conta mais pedidos cancelados, e o README tem o novo passo do fluxo.
- **Testes novos:** cobrem pendente, pago, estorno recusado, motivo ausente, pedido inexistente, status não cancelável e o relatório.

Decidi duas coisas além do pedido:
- **`PaymentService#refund`:** é um método novo que delega ao gateway, porque o `OrderService` só conversa com o `PaymentService`.
- **Cancelamentos simultâneos:** o `OrderService` guarda os pedidos em cancelamento. Se duas chamadas chegarem ao mesmo tempo para um pedido pago, a segunda recebe `ORDER_NOT_CANCELLABLE` e o estorno acontece uma vez só (há teste para isso).

Uma limitação que deixei de fora: se `cancelOrder` rodar enquanto um `payOrder` do mesmo pedido ainda espera a cobrança, a cobrança pode ser aprovada depois do cancelamento. O `payOrder` então falha com `INVALID_TRANSITION` e o dinheiro fica cobrado sem estorno. Posso tratar isso se quiser.