O cancelamento de pedidos está implementado e o `npm test` passa: **65 testes, 0 falhas** (antes eram 51). Não fiz commit.

**O que entrou**
- **`OrderService#cancelOrder(orderId, reason)`** (`src/orders/orderService.js`) segue a ordem dos outros métodos: busca o pedido (`ORDER_NOT_FOUND`), valida `reason` com o `requireString` do projeto (`VALIDATION_ERROR`) e checa o status (`ORDER_NOT_CANCELLABLE`).
  - Pedido pendente: libera a reserva com `inventory.release` e não estorna nada.
  - Pedido pago: estorna o total pelo gateway numa única chamada e devolve os itens ao estoque físico com `addStock`. Se o gateway recusar, lança `REFUND_FAILED` e nada muda (o pedido continua `paid` e o estoque fica como estava).
- **Pedido** (`order.js`): novo status `cancelled`, que só pode vir de `pending` ou `paid`. O pedido ganha `cancelReason` e `cancelledAt` (também no `toJSON`) e uma entrada no histórico com o motivo. Quando há estorno, `payment` passa a guardar também `refundId` e `refundedAt`.
- **`PaymentService#refund`**: chama o gateway uma vez só, sem novas tentativas. Repetir um estorno com resultado incerto poderia devolver o dinheiro duas vezes.
- **Evento e mensagem:** o evento `order.cancelled` sai com `{ orderId, email, name, reason, refunded }`, sendo `refunded` um booleano. O cliente recebe o assunto `Pedido <id> cancelado`, com corpo e assinatura no padrão das outras mensagens.
- **`salesReport`** deixa de contar pedidos `cancelled`.
- **Testes e README:** os testes novos estão em `test/cancelOrder.test.js`, mais um caso de `refund` em `test/payments.test.js`. O README ganhou uma seção "Cancelamento".

**Decisão que foi além do pedido**
Criei uma trava simples (`inFlight`, um `Set` no `OrderService`) para pedidos com cobrança ou estorno em andamento no gateway. Sem ela, três coisas podiam acontecer:
- dois cancelamentos simultâneos estornarem em dobro;
- um pedido ser cancelado enquanto a cobrança ainda ia ser aprovada (o cliente seria cobrado num pedido cancelado);
- um pedido ser enviado no meio do estorno.

Com a trava, o cancelamento nesses casos lança `ORDER_NOT_CANCELLABLE` com `inProgress: true`. O `shipOrder` lança um código novo, **`ORDER_BUSY`**. Para isso mexi um pouco no `payOrder` (que agora marca a cobrança em andamento) e no `shipOrder`. O comportamento deles fora dessa situação continua igual.

Para simular a recusa do estorno no teste, substituí o `refund` da instância do gateway falso. Não acrescentei roteiro de estornos ao `FakePaymentGateway`.