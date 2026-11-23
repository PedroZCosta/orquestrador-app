Cancelamento implementado. `npm test` passa: **64 testes, 0 falhas** (eram 51; 13 são novos). Não fiz commit, e o projeto não tem lint nem build para rodar.

**O que mudou**
- **`src/orders/order.js`**: novo status `cancelled`, que só pode ser alcançado a partir de `pending` ou `paid`. O pedido ganha os campos `cancelReason` e `cancelledAt`, que também aparecem no `toJSON`. O novo `markCancelled` grava a entrada `{ status: 'cancelled', at, reason }` no histórico e, se houve estorno, acrescenta `refundId` e `refundedAt` ao `payment`.
- **`src/orders/orderService.js`**: novo `cancelOrder(orderId, reason)`. Verifica nesta ordem: pedido inexistente (`ORDER_NOT_FOUND`), motivo vazio (`VALIDATION_ERROR`, usando o `requireString` do projeto) e status (`ORDER_NOT_CANCELLABLE`). Pedido pendente libera a reserva. Pedido pago é estornado primeiro; só com o estorno aprovado o pedido vira `cancelled` e os itens voltam ao `onHand` (via `addStock`). Estorno recusado lança `REFUND_FAILED` com `details.reason` e não altera pedido nem estoque. Depois emite `order.cancelled`.
- **`src/payments/paymentService.js`**: novo `refund`, que chama o gateway uma única vez. Não há nova tentativa de propósito, porque repetir um estorno sem saber se o primeiro passou pode devolver o dinheiro duas vezes.
- **`src/notifications/templates.js`**: mensagem com o assunto `Pedido <id> cancelado`. O corpo segue o padrão das outras mensagens e diz se houve estorno ou se não houve cobrança.
- **`src/reports/salesReport.js`**: ignora pedidos `cancelled`, como já fazia com `payment_failed`.
- **Testes**: `test/cancelOrder.test.js` (novo) e 2 casos de `refund` em `test/payments.test.js`.
- **README**: nova seção "Cancelamento" e a lista de status.

**Uma decisão além do pedido:** criei uma trava por pedido enquanto o gateway está processando uma cobrança ou um estorno.
- **Dois cancelamentos ao mesmo tempo:** sem a trava, os dois passavam pela checagem de status e os dois chamavam o estorno.
- **Cancelar com o pagamento em andamento:** sem a trava, o cancelamento liberava a reserva, a cobrança aprovava em seguida e o cliente ficava cobrado sem estorno.

Nos dois casos o segundo pedido de cancelamento agora recebe `ORDER_NOT_CANCELLABLE`, e há teste para cada um. Para isso, o `payOrder` passou a registrar a cobrança em andamento; o comportamento dele não mudou.

**Fora do escopo, não corrigido:** dois `payOrder` ao mesmo tempo no mesmo pedido continuam podendo cobrar em dobro. Esse problema já existia antes desta mudança.