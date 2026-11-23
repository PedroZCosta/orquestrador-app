Os valores e o comportamento abaixo vêm da leitura do código e foram conferidos rodando o fluxo real em memória com `node -e`. Nenhum arquivo foi criado ou alterado.

## (a) Quanto ela paga: **R$ 288,88**

| Item | Valor | Cálculo |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. O subtotal mínimo é R$ 100 e 219,70 passa dele. 10% de 219,70 = 21,97. A base tributável fica em 197,73. |
| Frete | **R$ 51,60** | AM fica na região `norte`. O frete grátis só vale a partir de R$ 299,90 de subtotal com desconto, e 197,73 não chega lá. O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg. Base 32,00 + 9,80 × 2 = 51,60. |
| Imposto | **R$ 39,55** | A alíquota de AM é 20% e incide sobre o subtotal com desconto. O frete não é tributado. 197,73 × 0,20 = 39,546, arredondado para 39,55. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

A ordem do cálculo é fixa: subtotal, depois desconto, depois frete (sobre o valor com desconto), depois imposto (sobre o valor com desconto, sem o frete) e por fim a soma. Pagar com cartão de crédito não muda nenhum desses valores.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3, que é o valor de `PAYMENT.maxAttempts`. O `timeout` chega com `retryable: true`, então o serviço tenta de novo até esgotar as tentativas.
- **Espera entre elas:** 200 ms antes da 2ª tentativa e 400 ms antes da 3ª. São 600 ms no total. Depois da última não há espera.
- **Status final:** `payment_failed`, com `payment = { paymentId: null, attempts: 3, failureReason: 'timeout' }`. É um status terminal, porque não há transição saindo dele.
- **Reserva de estoque:** é liberada (`inventory.release`). As unidades reservadas voltam a ficar disponíveis e o `onHand` não muda: LIV-001 continua com 20 e CAN-010 com 30, ambos com `reserved: 0`.
- **Mensagem para a cliente:** ela recebe dois e-mails. O primeiro chega na criação do pedido: "Pedido ORD-0001 recebido … no valor de R$ 288,88". O segundo chega quando a cobrança falha de vez:
  - Assunto: `Pagamento do pedido ORD-0001 não aprovado`
  - Corpo: `Olá, <nome>. Não conseguimos aprovar o pagamento do pedido ORD-0001 (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser.` e, em seguida, a assinatura "Loja Dev / Dúvidas: atendimento@lojadev.example".
- **Relatório de vendas:** o pedido **não entra**. O `salesReport` exclui pedidos com status `payment_failed`. Na simulação o relatório saiu com `orderCount: 0` e receita 0.

Uma observação à parte: o comentário em `coupons.js` diz que o `minSubtotal` é "inclusive", mas o código em `discounts.js:19` recusa quando `subtotal <= minSubtotal`. Isso não afeta este pedido (219,70 > 100). Só faria diferença com um subtotal exatamente igual ao mínimo.

## (c) Arquivos com as regras

- `src/catalog/seed.js`: preços, pesos e estoque inicial de LIV-001 e CAN-010
- `src/pricing/pricing.js`: ordem do cálculo e composição do total
- `src/pricing/coupons.js`: definição do cupom BEMVINDO10
- `src/pricing/discounts.js`: validação do cupom (`minSubtotal`) e desconto percentual
- `src/pricing/shipping.js`: fórmula do frete, peso arredondado para cima e frete grátis
- `src/pricing/tax.js`: imposto sobre o subtotal com desconto, sem o frete
- `src/config.js`: alíquota e região de AM, tabela de frete, `PAYMENT.maxAttempts`, `backoffMs` e meios de pagamento
- `src/payments/paymentService.js`: lógica das novas tentativas e das esperas
- `src/payments/paymentGateway.js`: contrato `{ ok, retryable, reason }` do gateway
- `src/orders/orderService.js`: `payOrder`, que marca a falha, libera a reserva e emite `payment.failed`
- `src/orders/order.js`: status `payment_failed` e suas transições
- `src/inventory/inventory.js`: `reserve` e `release`
- `src/notifications/templates.js` e `src/notifications/notifier.js`: texto e envio da mensagem
- `src/reports/salesReport.js`: exclusão dos pedidos `payment_failed` do relatório