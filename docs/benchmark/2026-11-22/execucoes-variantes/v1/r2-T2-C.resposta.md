O cancelamento de pedidos está implementado e `npm test` passa: 60 testes, 0 falhas (conferi rodando de novo). Não fiz commit.

- **Status e pedido** (`src/orders/order.js`): o status `cancelled` foi adicionado, e o pedido ganhou `cancelReason`, `cancelledAt` (ISO, do relógio da loja) e a entrada no histórico.
- **`cancelOrder`** (`src/orders/orderService.js`): o `reason` é validado antes de qualquer efeito (`VALIDATION_ERROR`). Pedido inexistente dá `ORDER_NOT_FOUND`. Qualquer status diferente de `pending` ou `paid`, inclusive `cancelled`, dá `ORDER_NOT_CANCELLABLE`.
- **Pedido pendente:** a reserva de estoque é desfeita, sem estorno.
- **Pedido pago:** o valor total é estornado uma vez, pelo `paymentId` do pagamento, e os itens voltam ao estoque físico. Se o gateway recusar, lança `REFUND_FAILED`, o pedido continua `paid` e o estoque fica intocado.
- **Estorno único:** duas chamadas simultâneas no mesmo pedido pago geram um só estorno. A segunda recebe `ORDER_NOT_CANCELLABLE`.
- **`refund` no `PaymentService`** (`src/payments/paymentService.js`): ele só tinha `charge`, então acrescentei um `refund` que repassa a chamada ao gateway.
- **Evento e mensagem:** `order.cancelled` sai com `{ orderId, email, name, reason, refunded }`. O cliente recebe a mensagem `Pedido <id> cancelado`, no padrão das outras.
- **Relatório e documentação:** `salesReport` não conta mais pedidos cancelados. Os testes novos cobrem os casos acima, e o `README.md` foi atualizado.

**Pendente:** se `payOrder` estiver esperando a cobrança e `cancelOrder` cancelar o mesmo pedido pendente nesse intervalo, o `payOrder` falha depois com `INVALID_TRANSITION`. Isso não estava no pedido e não foi tratado.