`cancelOrder` está implementado e `npm test` passa: 61 testes, 0 falhas, incluindo os 10 novos em `test/cancelOrder.test.js`. Não fiz commit.

**O que mudou**
- **`src/orders/order.js`**:
  - O status `cancelled` entra em `ORDER_STATUSES`, e `pending` e `paid` podem ir para ele.
  - O pedido ganha `cancelReason` e `cancelledAt`, que também saem no `toJSON`.
  - O histórico registra `reason` e `refunded`.
- **`src/orders/orderService.js`**: `cancelOrder(orderId, reason)` valida o motivo, depois busca o pedido e segue por um destes caminhos:
  - **Pendente:** desfaz a reserva de estoque, sem estorno.
  - **Pago:** chama `gateway.refund` com o `paymentId` e o total do pedido e devolve os itens ao estoque físico.
  - **Qualquer outro status:** lança `ORDER_NOT_CANCELLABLE`.
- **`src/notifications/templates.js`**: o template `order.cancelled` tem o assunto `Pedido <id> cancelado`. O corpo diz se o valor será estornado ou se não houve cobrança.
- **`src/reports/salesReport.js`**: pedidos cancelados ficam fora do relatório.
- **`README.md`**: o passo 4 do fluxo descreve o cancelamento.

**Decisões minhas**
- **Estorno recusado ou gateway com exceção:** os dois viram `REFUND_FAILED`. O pedido continua `paid`, o estoque fica intacto e dá para tentar de novo.
- **Chamadas concorrentes:** como o estorno é assíncrono, duas chamadas simultâneas para o mesmo pedido poderiam estornar duas vezes. Um controle interno deixa só a primeira seguir, e a outra recebe `ORDER_NOT_CANCELLABLE`. Há um teste para isso.
- **Ordem das validações:** o motivo é validado antes da busca do pedido. Motivo vazio num pedido inexistente dá `VALIDATION_ERROR`, não `ORDER_NOT_FOUND`.