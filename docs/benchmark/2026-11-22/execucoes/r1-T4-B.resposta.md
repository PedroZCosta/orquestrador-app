## (a) Valores do pedido

Rodei `computeTotals` com os dados reais do projeto, sem criar nenhum arquivo, e o resultado bate com o cálculo abaixo.

| Item | Valor | Como é calculado |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. O mínimo de R$ 100 é atendido. |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97 |
| Frete | **R$ 51,60** | Manaus está na região norte. O peso é 2 × 0,6 + 0,4 = 1,6 kg, cobrado como 2 kg (arredonda para cima). O frete é a base de 32,00 mais 9,80 × 2 kg. Não há frete grátis, porque 197,73 fica abaixo de 299,90 e o cupom não dá frete grátis. |
| Imposto | **R$ 39,55** | AM tem alíquota de 20%. Incide sobre o subtotal com desconto, sem o frete: 197,73 × 0,20 = 39,546, que arredonda para 39,55. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

O método de pagamento (cartão) não altera nenhum valor.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3 (`maxAttempts = 3`). `timeout` é falha temporária, então o serviço tenta de novo até o limite.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª tentativa, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última. Total de 600 ms.
- **Status final:** `payment_failed`, com `reason: 'timeout'` e 3 tentativas registradas. Esse status não tem transições de saída.
- **Reserva de estoque:** `payOrder` chama `inventory.release`. As unidades reservadas voltam a ficar disponíveis (2 de LIV-001 e 1 de CAN-010). Nada é baixado do estoque físico, porque `commit` só roda com pagamento aprovado.
- **Mensagem à cliente:** o evento `payment.failed` gera o assunto "Pagamento do pedido ORD-… não aprovado". O corpo é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Termina com a assinatura da Loja Dev e o e-mail de atendimento. Antes disso, a cliente já tinha recebido o aviso "Pedido recebido" (`order.placed`).
- **Relatório de vendas:** **não entra.** `salesReport` exclui os pedidos com status `payment_failed`.

## (c) Onde estão as regras

- `src/catalog/seed.js`: preços, pesos e categorias dos produtos.
- `src/pricing/coupons.js`: definição do BEMVINDO10 (10%, mínimo de R$ 100).
- `src/pricing/discounts.js`: avaliação do cupom e `lineSubtotal`.
- `src/pricing/pricing.js`: ordem do cálculo (subtotal, desconto, frete, imposto, total).
- `src/pricing/shipping.js`: frete por região e peso, e limite de frete grátis.
- `src/pricing/tax.js`: imposto sobre o valor já com desconto, sem o frete.
- `src/config.js`: alíquota do AM, tabelas de frete, `PAYMENT.maxAttempts` e `backoffMs`.
- `src/payments/paymentService.js`: novas tentativas e espera entre elas.
- `src/payments/paymentGateway.js`: contrato do gateway, com `retryable` e `reason`.
- `src/orders/orderService.js` e `src/orders/order.js`: `placeOrder` e `payOrder` (reserva, `release`/`commit`) e as transições de status.
- `src/inventory/inventory.js`: reservar, confirmar e liberar estoque.
- `src/notifications/templates.js`: texto da mensagem de falha de pagamento.
- `src/reports/salesReport.js`: exclusão de `payment_failed`.
- `src/money.js`: arredondamento em duas casas.

Uma discrepância no código: o comentário em `src/pricing/coupons.js` diz que o mínimo do cupom vale "a partir de" o valor, inclusive. Mas `src/pricing/discounts.js` rejeita quando `subtotal <= minSubtotal`, ou seja, um subtotal exatamente igual a R$ 100,00 seria recusado. Isso não afeta este pedido, cujo subtotal é R$ 219,70.

Não alterei nem criei arquivos, e não fiz commit.