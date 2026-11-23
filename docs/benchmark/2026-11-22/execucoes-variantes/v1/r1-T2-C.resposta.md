O cancelamento de pedidos está implementado. Rodei `npm test` e passaram os 58 testes, 6 deles novos, sem falhas. Não fiz commit.

**O que mudou**
- **`OrderService#cancelOrder(orderId, reason)`** em `src/orders/orderService.js`:
  - As validações seguem esta ordem: `ORDER_NOT_FOUND`, depois `VALIDATION_ERROR` para motivo vazio, depois `ORDER_NOT_CANCELLABLE` para pedido que não seja `pending` ou `paid`.
  - **Pedido pendente:** desfaz a reserva de estoque, sem estorno.
  - **Pedido pago:** estorna o valor total pelo gateway antes de qualquer mudança. Se o gateway recusar, lança `REFUND_FAILED` e o pedido continua `paid`, sem mexer no estoque nem emitir evento. Se o estorno passar, devolve os itens ao estoque físico.
  - **Pedido cancelado:** grava `cancelReason`, `cancelledAt` e a entrada no histórico. Emite `order.cancelled` com `{ orderId, email, name, reason, refunded }`.
- **`src/orders/order.js`:** novo status `cancelled`, com as transições `pending→cancelled` e `paid→cancelled`.
- **Arquivos de apoio:**
  - `paymentService.js` ganhou `refund`, que o gateway já tinha mas o serviço não expunha.
  - `inventory.js` ganhou `restock`.
- **Mensagem ao cliente:** o template em `templates.js` usa o assunto `Pedido <id> cancelado`. O corpo cita o motivo e, se houve estorno, avisa que o valor será estornado.
- **`salesReport`:** deixa de contar pedidos cancelados.
- **Testes e documentação:** os testes novos estão em `test/orderService.test.js` e o README foi atualizado.

**Decisão minha:** para garantir o estorno uma única vez, o serviço guarda um conjunto de pedidos em cancelamento. Se duas chamadas simultâneas chegarem para o mesmo pedido, a segunda recebe `ORDER_NOT_CANCELLABLE`, e há teste para isso.

Não ficou nada pendente.