**(a) Valores do pedido (Manaus/AM, 2× LIV-001 + 1× CAN-010, BEMVINDO10, cartão)**

| Item | Valor | Cálculo |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 + 1 × 39,90 = 179,80 + 39,90 |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. O pedido passa do mínimo, porque 219,70 é maior que 100. |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97 |
| Frete | **R$ 51,60** | Peso 2 × 0,6 + 0,4 = 1,6 kg, arredondado para 2 kg. Região norte: base 32,00 + 9,80 × 2. Não é grátis, porque 197,73 fica abaixo de 299,90 e o cupom não dá frete grátis. |
| Imposto | **R$ 39,55** | AM tem alíquota de 20%. 197,73 × 0,20 = 39,546, que arredonda para 39,55. O imposto incide sobre o subtotal já com desconto e não sobre o frete. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

**(b) Gateway responde `timeout` em todas as tentativas**

`timeout` é uma falha temporária (`retryable`). O fluxo é:

- **Cobranças:** são 3 (`maxAttempts` = 3).
- **Espera:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última, então o total é 600 ms.
- **Status final:** `payment_failed`. O pedido guarda `failureReason` = `timeout` e `attempts` = 3.
- **Estoque:** a reserva é liberada com `inventory.release`, e as unidades voltam ao disponível. O `commit` não acontece.
- **Mensagem à cliente:** o evento `payment.failed` envia o e-mail "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." A assinatura é da Loja Dev, com o e-mail de atendimento.
- **Relatório de vendas:** não entra. `salesReport.js:11` filtra fora os pedidos com status `payment_failed`.

**(c) Arquivos com as regras** (caminhos a partir da raiz do projeto)

- Alíquotas, frete, política de tentativas e backoff: `src/config.js`
- Preços e pesos dos produtos: `src/catalog/seed.js`
- Cupom BEMVINDO10: `src/pricing/coupons.js`
- Avaliação do cupom e mínimo do subtotal: `src/pricing/discounts.js`
- Ordem do cálculo e total: `src/pricing/pricing.js`
- Frete: `src/pricing/shipping.js`
- Imposto: `src/pricing/tax.js`
- Arredondamento: `src/money.js`
- Retentativas e espera entre elas: `src/payments/paymentService.js`
- Resposta `timeout` e `retryable`: `src/payments/paymentGateway.js`
- Fluxo de falha de pagamento (`payOrder`): `src/orders/orderService.js`
- Status `payment_failed`: `src/orders/order.js`
- Liberação da reserva de estoque: `src/inventory/inventory.js`
- Texto do e-mail: `src/notifications/templates.js`
- Exclusão do relatório de vendas: `src/reports/salesReport.js`

Não alterei nem criei arquivos no projeto, e não fiz commit. Os valores saem da leitura do código, não de uma execução.