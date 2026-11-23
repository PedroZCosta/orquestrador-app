O cancelamento de pedidos está implementado e `npm test` passa: 58 testes, 0 falhas. Não fiz commit.

- **Regras do pedido:** em `src/orders/order.js` entrou o status `cancelled`, com os campos `cancelReason` e `cancelledAt` e a entrada no histórico. Só `pending` e `paid` podem ser cancelados.
- **Serviço:** `OrderService#cancelOrder` em `src/orders/orderService.js` cobre as validações (`VALIDATION_ERROR`, `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLABLE`) e o estorno de pedido pago com `REFUND_FAILED`. Também trata o estoque e emite `order.cancelled`.
- **Chamadas simultâneas:** para evitar estorno duplo, uma segunda chamada em paralelo para o mesmo pedido recebe `ORDER_NOT_CANCELLABLE`. Isso é uma decisão do executor, não estava nos requisitos.
- **Mensagem e relatório:** o template em `src/notifications/templates.js` gera o assunto `Pedido <id> cancelado`. O `salesReport` (`src/reports/salesReport.js`) ignora pedidos cancelados.
- **Testes e README:** 7 casos novos em `test/orderService.test.js`, e o `README.md` foi atualizado.

Não conferi os arquivos nem rodei os testes por conta própria, vale o relatório do executor.