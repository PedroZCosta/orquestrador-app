## (a) Quanto ela paga

Total: **R$ 288,88**. O cartão de crédito não muda o cálculo, porque não há acréscimo por forma de pagamento. A ordem do cálculo está em `computeTotals`.

| Item | Valor | Como é calculado |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 (LIV-001) = 179,80, mais 1 × 39,90 (CAN-010) |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. O cupom exige subtotal acima de R$ 100, e 219,70 passa. |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97. É a base do frete e do imposto. |
| Frete | **R$ 51,60** | Peso: 2 × 0,6 + 0,4 = 1,6 kg, que vira 2 kg ao arredondar para cima. AM fica na região norte: base 32,00 + 9,80 × 2 kg = 51,60. Não há frete grátis, porque 197,73 está abaixo de 299,90 e o cupom não dá frete grátis. |
| Imposto | **R$ 39,55** | AM tem alíquota de 20% sobre o subtotal com desconto: 197,73 × 0,20 = 39,546, arredondado para 39,55. O frete não é tributado. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3, que é o `maxAttempts`. O `timeout` é tratado como falha temporária (`retryable`), então o sistema tenta de novo até esgotar as tentativas.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Depois da última tentativa não há espera.
- **Status final:** `payment_failed`. O pedido vai de `pending` para `payment_failed`, com `reason: 'timeout'` e `attempts: 3`.
- **Reserva de estoque:** é desfeita (`inventory.release`). As unidades voltam ao disponível e nada sai do estoque físico, porque o `commit` só acontece quando o pagamento é aprovado.
- **Mensagem à cliente:** o evento `payment.failed` dispara o e-mail com assunto "Pagamento do pedido ORD-… não aprovado". O corpo é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." seguido da assinatura da loja.
- **Relatório de vendas:** não entra. `salesReport` exclui os pedidos com status `payment_failed`.

## (c) Arquivos com as regras

- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/pricing/pricing.js`: ordem do cálculo dos totais.
- `src/pricing/coupons.js` e `src/pricing/discounts.js`: definição do cupom BEMVINDO10 e sua validação (subtotal mínimo e 10%).
- `src/pricing/shipping.js`: frete por peso e região.
- `src/pricing/tax.js`: imposto sobre o subtotal com desconto.
- `src/config.js`: alíquota e região de AM, tabela de frete, limite de frete grátis, tentativas e espera entre elas (`PAYMENT`).
- `src/payments/paymentService.js`: tentativas e espera.
- `src/payments/paymentGateway.js`: contrato do gateway.
- `src/orders/orderService.js`: `payOrder`, com a falha do pagamento e a liberação da reserva.
- `src/orders/order.js`: transições de status.
- `src/inventory/inventory.js`: `reserve`, `commit` e `release`.
- `src/notifications/templates.js` e `src/notifications/notifier.js`: texto e envio da mensagem.
- `src/reports/salesReport.js`: filtro do relatório de vendas.

Não alterei nem criei arquivos, e não fiz commit.