**(a) Quanto ela paga: R$ 288,88**

| Item | Valor | Como é calculado |
|---|---|---|
| Subtotal | R$ 219,70 | 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) |
| Desconto | R$ 21,97 | BEMVINDO10 dá 10% sobre o subtotal. O cupom exige subtotal acima de R$ 100,00 (a checagem é estrita, `<=` recusa), e 219,70 passa. |
| Frete | R$ 51,60 | Peso: 2 × 0,6 + 0,4 = 1,6 kg, arredondado para 2 kg. AM é região norte: base 32,00 + 9,80 × 2 kg. O frete não é grátis: o subtotal com desconto (197,73) fica abaixo de 299,90 e o cupom não é de frete grátis. |
| Imposto | R$ 39,55 | AM tem alíquota de 20%, aplicada sobre o subtotal com desconto: 197,73 × 0,20 = 39,546, que arredonda para 39,55. O frete não é tributado. |
| Total | R$ 288,88 | 197,73 + 39,55 + 51,60 |

**(b) Gateway com `timeout` em todas as tentativas**

- **Cobranças:** 3 (`maxAttempts` = 3). O `timeout` vem como falha `retryable` no gateway, então o serviço tenta de novo.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última, então o total é 600 ms.
- **Status final:** `payment_failed`. O pedido registra `reason: 'timeout'` e `attempts: 3`.
- **Reserva de estoque:** é desfeita com `inventory.release`. As 2 unidades de LIV-001 e a 1 de CAN-010 voltam ao disponível, e nada sai do `onHand`.
- **Mensagem à cliente:** evento `payment.failed`, com assunto "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Ela já tinha recebido antes o e-mail "Pedido … recebido".
- **Relatório de vendas:** não entra. `salesReport` descarta pedidos com status `payment_failed`.

**(c) Arquivos das regras**

Caminhos relativos à raiz do projeto.

- **Preços, frete e imposto:** `src/catalog/seed.js` (preços e pesos), `src/pricing/pricing.js` (ordem do cálculo), `src/pricing/coupons.js` e `src/pricing/discounts.js` (cupom), `src/pricing/shipping.js`, `src/pricing/tax.js`, `src/config.js` (alíquota e frete de AM, limite de frete grátis).
- **Pagamento e falha:** `src/config.js` (`PAYMENT.maxAttempts` e `backoffMs`), `src/payments/paymentService.js` (retentativas e espera), `src/payments/paymentGateway.js` (contrato do gateway), `src/orders/orderService.js` (`payOrder`), `src/orders/order.js` (status).
- **Reserva, mensagem e relatório:** `src/inventory/inventory.js` (`release`), `src/notifications/templates.js` e `src/notifications/notifier.js`, `src/reports/salesReport.js`.

Li o código e calculei à mão, sem rodar nada. Não alterei nem criei arquivos e não fiz commit.