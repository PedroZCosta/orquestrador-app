**(a) Valores do pedido** (Manaus, AM, região norte; 2× LIV-001 a R$ 89,90 e 1× CAN-010 a R$ 39,90; cupom BEMVINDO10; cartão)

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor é calculado:
- **Subtotal:** 2 × 89,90 = 179,80, mais 39,90 = **219,70**.
- **Desconto:** BEMVINDO10 dá 10% sobre o subtotal e exige subtotal estritamente maior que R$ 100 (`<=` é recusado). Como 219,70 passa, o desconto é 21,97. O subtotal com desconto fica **197,73**.
- **Frete:** o peso é 2 × 0,6 + 0,4 = 1,6 kg, que arredonda para cima e fatura 2 kg. A região norte tem base de R$ 32,00 mais R$ 9,80 por kg: 32 + 9,80 × 2 = **51,60**. O frete grátis só vale a partir de 299,90 sobre o subtotal já com desconto, e 197,73 não chega lá. O cupom também não dá frete grátis.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal com desconto, sem incluir o frete. 197,73 × 0,20 = 39,546, que arredonda para **39,55**.
- **Total:** 197,73 + 39,55 + 51,60 = **288,88**.

**(b) Gateway responde `timeout` em todas as tentativas**
- **Cobranças:** 3 (`maxAttempts` = 3). `timeout` é falha temporária (`retryable`), então o serviço repete até esgotar as tentativas.
- **Espera entre elas:** 200 ms antes da 2ª tentativa e 400 ms antes da 3ª, num total de 600 ms. Não há espera depois da última.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada com `inventory.release`. As quantidades reservadas voltam ao estoque disponível e nada é baixado definitivamente.
- **Mensagem à cliente:** o assunto é "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser."
- **Relatório de vendas:** não entra. O relatório exclui pedidos com status `payment_failed`.

**(c) Onde estão as regras**
- `src/pricing/pricing.js`: ordem do cálculo (subtotal, desconto, frete, imposto, total).
- `src/pricing/coupons.js` e `src/pricing/discounts.js`: cupom BEMVINDO10, o mínimo de R$ 100 e o cálculo do desconto.
- `src/pricing/shipping.js`: frete, peso arredondado para cima e frete grátis.
- `src/pricing/tax.js`: imposto.
- `src/config.js`: alíquota e região de AM, tabela de frete, limite de frete grátis, tentativas e backoff `[200, 400]`.
- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/orders/orderService.js` (`payOrder`): marca `payment_failed`, libera a reserva e emite o evento.
- `src/orders/order.js`: status e transições.
- `src/inventory/inventory.js`: `release`.
- `src/notifications/templates.js`: texto enviado à cliente.
- `src/reports/salesReport.js`: exclusão de `payment_failed` do relatório.

Não alterei nem criei arquivos e não fiz commit. Não rodei o código: os valores vêm da leitura das regras.