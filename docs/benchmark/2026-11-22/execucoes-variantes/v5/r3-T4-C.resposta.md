**(a) Valores do pedido** (Manaus/AM, 2× LIV-001 + 1× CAN-010, cupom BEMVINDO10)

| Item | Valor | Cálculo |
|---|---|---|
| Subtotal | R$ 219,70 | 2 × 89,90 + 1 × 39,90 |
| Desconto | R$ 21,97 | BEMVINDO10 dá 10% sobre o subtotal. Vale porque 219,70 é maior que o mínimo de R$ 100. |
| Subtotal com desconto | R$ 197,73 | 219,70 − 21,97 |
| Frete | R$ 51,60 | Peso 2 × 0,6 + 0,4 = 1,6 kg, cobrado como 2 kg (arredonda para cima). Região norte: 32,00 + 9,80 × 2. Não é grátis, porque 197,73 fica abaixo de R$ 299,90 e o cupom não dá frete grátis. |
| Imposto | R$ 39,55 | AM tem alíquota de 20% sobre o subtotal com desconto: 197,73 × 0,20 = 39,546, arredondado para 39,55. O frete não é tributado. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

O tipo de pagamento (cartão de crédito) não altera nenhum valor. Calculei à mão e não executei o código.

**(b) Gateway com `timeout` em todas as tentativas**
- **Cobranças:** 3, que é o `maxAttempts`. O `timeout` é uma falha temporária (`retryable`), então o sistema tenta de novo até esgotar as tentativas.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Depois da última tentativa não há espera.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada com `inventory.release`, e as unidades voltam ao estoque (não há `commit`).
- **Mensagem à cliente:** o evento `payment.failed` dispara o assunto "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Ao final vêm o nome da loja e o e-mail de suporte.
- **Relatório de vendas:** não entra, porque o `salesReport` exclui os pedidos com status `payment_failed`.

**(c) Onde estão as regras** (caminhos a partir da raiz do projeto)
- `src/pricing/pricing.js`: ordem do cálculo (subtotal, desconto, frete, imposto, total).
- `src/pricing/coupons.js` e `src/pricing/discounts.js`: definição do BEMVINDO10 e sua avaliação.
- `src/pricing/shipping.js`: frete.
- `src/pricing/tax.js`: imposto.
- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/config.js`: alíquota do AM, tabela de frete, limite de frete grátis, tentativas e esperas (`backoffMs`).
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/orders/orderService.js` (`payOrder`): marca o pedido como `payment_failed` e libera o estoque.
- `src/orders/order.js`: status e transições do pedido.
- `src/inventory/inventory.js`: liberação da reserva.
- `src/notifications/templates.js`: texto enviado à cliente.
- `src/reports/salesReport.js`: exclusão dos pedidos com pagamento recusado.

Nenhum arquivo foi alterado e não houve commit.