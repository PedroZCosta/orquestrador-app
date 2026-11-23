**Observação:** `src/pricing/discounts.js:23` usa `subtotal <= coupon.minSubtotal`, mas o comentário em `src/pricing/coupons.js` diz "a partir de, inclusive". Isso só afeta um subtotal exatamente igual ao mínimo. Aqui o subtotal é R$ 219,70, então o resultado não muda.

## (a) Valores do pedido (Manaus/AM, cartão, BEMVINDO10)

| Item | Valor |
|---|---|
| Subtotal | **R$ 219,70** |
| Desconto | **R$ 21,97** |
| Frete | **R$ 51,60** |
| Imposto | **R$ 39,55** |
| Total | **R$ 288,88** |

Como cada valor é calculado (`computeTotals` em `src/pricing/pricing.js`):
- **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 = 219,70.
- **Desconto:** BEMVINDO10 é 10% com subtotal mínimo de R$ 100. O subtotal de 219,70 passa do mínimo, então o desconto é 10% de 219,70 = 21,97. O subtotal com desconto fica em 197,73.
- **Frete:** é calculado sobre o subtotal com desconto.
  - AM fica na região norte, com base de R$ 32,00 e R$ 9,80 por kg.
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima = 2 kg.
  - Frete = 32 + 9,80 × 2 = 51,60.
  - Não é grátis: 197,73 está abaixo de 299,90, e o cupom não dá frete grátis.
- **Imposto:** a alíquota de AM é 20%, aplicada sobre o subtotal com desconto (o frete não é tributado). 197,73 × 0,20 = 39,546, que arredonda para 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3, pois `PAYMENT.maxAttempts = 3`. O timeout é `retryable`, então o sistema repete até esgotar as tentativas.
- **Espera entre elas:** 200 ms antes da 2ª tentativa e 400 ms antes da 3ª (`backoffMs: [200, 400]`). Não há espera depois da última.
- **Status final:** `payment_failed`. O pedido registra o motivo `timeout` e 3 tentativas.
- **Reserva de estoque:** `inventory.release` devolve as unidades reservadas ao disponível. Nada é baixado do estoque.
- **Mensagem à cliente:** é disparada pelo evento `payment.failed`, com o assunto "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Termina com a assinatura da loja.
- **Relatório de vendas:** não entra. `salesReport` filtra `status !== 'payment_failed'`.

## (c) Arquivos com as regras

- `src/config.js`: alíquotas por estado, frete por região, limite de frete grátis, tentativas e backoff do pagamento.
- `src/catalog/seed.js`: preços, pesos e categorias dos produtos.
- `src/pricing/coupons.js` e `src/pricing/discounts.js`: definição do cupom e regra de desconto.
- `src/pricing/shipping.js`: frete.
- `src/pricing/tax.js`: imposto.
- `src/pricing/pricing.js`: ordem e composição do total.
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/payments/paymentGateway.js`: gateway falso, que retorna `retryable` e `reason`.
- `src/orders/orderService.js`: `payOrder`, que muda o status, libera a reserva e emite o evento.
- `src/orders/order.js`: `markPaymentFailed`.
- `src/inventory/inventory.js`: `release`.
- `src/notifications/templates.js`: texto da mensagem `payment.failed`.
- `src/reports/salesReport.js`: exclusão dos pedidos `payment_failed`.

Não alterei nem criei arquivos, não rodei testes e não usei subagentes. Os valores vêm da leitura do código, não de uma execução.