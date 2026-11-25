**(a) Valores do pedido (Manaus/AM, 2× LIV-001 + 1× CAN-010, cupom BEMVINDO10)**

| Item | Valor | Cálculo |
|---|---|---|
| Subtotal | **R$ 219,70** | 2 × 89,90 + 1 × 39,90 = 179,80 + 39,90 |
| Desconto | **R$ 21,97** | BEMVINDO10 dá 10% sobre o subtotal. Vale porque 219,70 é maior que o mínimo de R$ 100. |
| Frete | **R$ 51,60** | Subtotal com desconto = 197,73, abaixo do limite de frete grátis (299,90). Peso = 2 × 0,6 + 0,4 = 1,6 kg, que arredonda para 2 kg. AM é região norte: base 32,00 + 9,80 × 2 kg. |
| Imposto | **R$ 39,55** | AM tem alíquota de 20%, aplicada sobre o subtotal com desconto: 197,73 × 0,20 = 39,546, arredondado para 39,55. O frete não é tributado. |
| **Total** | **R$ 288,88** | 197,73 + 39,55 + 51,60 |

Fiz essas contas à mão a partir do código. Não rodei o sistema.

**(b) Gateway responde `timeout` em todas as tentativas**
- **Cobranças:** 3 (`maxAttempts = 3`). O `timeout` é falha temporária, então o sistema tenta de novo.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª tentativa, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última.
- **Status final:** `payment_failed`, com o motivo `timeout` e 3 tentativas registrados.
- **Reserva de estoque:** é liberada (`inventory.release`), e as unidades voltam ao estoque.
- **Mensagem à cliente:** evento `payment.failed`, com o assunto "Pagamento do pedido ORD-… não aprovado". O corpo é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Termina com a assinatura da Loja Dev.
- **Relatório de vendas:** não entra. O `salesReport` exclui pedidos com status `payment_failed`.

**(c) Arquivos com as regras (em `src/`)**
- `catalog/seed.js`: preços e pesos dos produtos.
- `pricing/pricing.js`: ordem do cálculo (subtotal, desconto, frete, imposto, total).
- `pricing/coupons.js` e `pricing/discounts.js`: definição e avaliação do cupom.
- `pricing/shipping.js`: frete e peso arredondado para cima.
- `pricing/tax.js`: imposto.
- `config.js`: alíquota e região de AM, tabelas de frete, limite de frete grátis, tentativas (3) e espera entre elas (`backoffMs` [200, 400]).
- `money.js`: arredondamento.
- `payments/paymentService.js`: lógica de novas tentativas e espera.
- `payments/paymentGateway.js`: contrato do gateway.
- `orders/orderService.js`: `payOrder` marca a falha e libera a reserva.
- `orders/order.js`: status do pedido.
- `inventory/inventory.js`: `release` da reserva.
- `notifications/templates.js`: mensagem `payment.failed`.
- `reports/salesReport.js`: exclusão de `payment_failed` do relatório.

Não alterei nem criei arquivos, e não fiz commit.