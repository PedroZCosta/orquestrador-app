O cancelamento de pedidos está implementado. `npm test` passa: 60 testes, 0 falhas, incluindo os 9 novos de cancelamento. Não fiz commit.

**O que mudou**
- **`order.js`:** novo status `cancelled`. Pedidos `pending` e `paid` podem passar para ele. O pedido guarda `cancelReason` e `cancelledAt` e ganha a entrada no histórico.
- **`orderService.js`:** o método `cancelOrder(orderId, reason)`.
- **`paymentService.js`:** novo `refund({ paymentId, amount })`, que repassa ao gateway. Criei esse método porque o `OrderService` só conhece o `PaymentService`.
- **`inventory.js`:** novo `restock(lines)`, que devolve os itens ao estoque físico.
- **`templates.js`:** mensagem `Pedido <id> cancelado`. O texto só avisa do estorno quando houve estorno.
- **`salesReport.js`:** pedidos cancelados ficam fora do relatório.
- **`README.md`:** atualizado com o método, o status, os erros e o evento.
- **`test/cancelOrder.test.js` (novo):** cobre todos os casos pedidos, inclusive dois cancelamentos simultâneos de um pedido pago.

**Decisões**
- **Ordem das validações:** busca o pedido primeiro (`ORDER_NOT_FOUND`) e depois valida o `reason` (`VALIDATION_ERROR`), como o `shipOrder` faz.
- **Estorno:** acontece antes de qualquer mudança de estado ou de estoque. Se o gateway recusar, lança `REFUND_FAILED`, o pedido continua `paid` e o estoque fica intacto.
- **Cancelamento simultâneo:** um `Set` marcado antes do `await` do estorno faz a segunda chamada receber `ORDER_NOT_CANCELLABLE`. O estorno acontece uma vez só.

Não há pendências.