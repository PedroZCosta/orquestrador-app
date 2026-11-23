Implementei o cancelamento de pedidos. `npm test` passa inteiro: 64 testes, 0 falhas (eram 51). Não fiz commit.

**Como funciona `cancelOrder(orderId, reason)`** (`src/orders/orderService.js`)
- **Ordem das verificações:** busca o pedido (`ORDER_NOT_FOUND`), depois valida o motivo com o `requireString` do projeto (`VALIDATION_ERROR`) e por fim checa o status (`ORDER_NOT_CANCELLABLE`). Segui a mesma ordem do `shipOrder`. O motivo é gravado sem espaços nas pontas.
- **Pedido pendente:** desfaz a reserva com `inventory.release` e não chama o gateway.
- **Pedido pago:**
  - Estorna o total com o `paymentId`, numa única chamada ao gateway, sem novas tentativas.
  - Se o gateway recusar, lança `REFUND_FAILED` com o motivo no erro, e o pedido continua `paid` com o estoque intacto.
  - Se o estorno passar, os itens voltam ao estoque físico com `addStock`.
- O pedido ganha `cancelReason`, `cancelledAt` e a entrada `{ status: 'cancelled', at, reason }` no histórico. Também emite `order.cancelled` com exatamente `{ orderId, email, name, reason, refunded }`.

**Outros arquivos**
- `src/orders/order.js`: novo status `cancelled`, transições `pending → cancelled` e `paid → cancelled`, método `markCancelled` e os campos novos no `toJSON`.
- `src/payments/paymentService.js`: novo `refund`. É uma chamada só ao gateway, porque repetir um estorno às cegas pode devolver o dinheiro duas vezes.
- `src/notifications/templates.js`: mensagem com o assunto `Pedido <id> cancelado`. O corpo segue o padrão das outras e diz se houve estorno ou se nada foi cobrado.
- `src/reports/salesReport.js`: o relatório deixa de contar pedidos `cancelled`, como já fazia com `payment_failed`.
- `README.md`: nova seção "Cancelamento".

**Decisões que tomei além do pedido**
1. **Pedido ocupado durante uma operação no gateway.** Sem isso havia três problemas:
   - dois cancelamentos simultâneos estornariam duas vezes;
   - um cancelamento durante o `payOrder` liberaria a reserva de um pedido que acabaria sendo cobrado;
   - um envio no meio do estorno mandaria a mercadoria de um pedido já estornado.

   Enquanto uma cobrança ou um estorno espera o gateway, `cancelOrder` recusa com `ORDER_NOT_CANCELLABLE`, `payOrder` com `ORDER_NOT_PAYABLE` e `shipOrder` com um código novo, `ORDER_BUSY`. Isso muda um pouco o `payOrder` e o `shipOrder`, mas só nesses casos de concorrência.
2. **Estorno guardado no pedido.** O `payment` do pedido passa a ter `refundId`, `refundedAmount` e `refundedAt`.
3. **Erro lançado pelo gateway.** Se o gateway lançar uma exceção em vez de recusar, ela sobe como está, sem virar `REFUND_FAILED`. O pedido continua `paid` e pode ser cancelado de novo.

**Testes**
- `test/cancelOrder.test.js` (novo) cobre todos os requisitos e também os casos de concorrência, usando gateways com resposta atrasada.
- `test/payments.test.js` ganhou testes do `PaymentService.refund`.