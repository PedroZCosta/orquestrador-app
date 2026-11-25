Já li as regras e conferi os valores na calculadora. Abaixo vai a resposta, sem nenhuma alteração no projeto.

## (a) Quanto ela paga

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto (BEMVINDO10) | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto (AM, 20%) | R$ 39,55 |
| **Total** | **R$ 288,88** |

**Como cada valor é calculado**
- **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 = 219,70.
- **Desconto:** o cupom BEMVINDO10 é de 10% e exige subtotal acima de R$ 100. O subtotal de 219,70 atende. Desconto = 10% de 219,70 = 21,97, o que deixa 197,73 de base.
- **Frete:**
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg.
  - Manaus fica na região norte: base 32,00 + 9,80 × 2 kg = 51,60.
  - O frete grátis exige subtotal já com desconto de pelo menos 299,90. Aqui são 197,73, então não vale. O BEMVINDO10 também não dá frete grátis.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal já com desconto (o frete não é tributado). 197,73 × 0,20 = 39,546, que arredonda para 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88. Pagar com cartão de crédito não altera nenhum valor.

## (b) Gateway com `timeout` em todas as tentativas

O `timeout` é tratado como falha temporária (`retryable`).

- **Cobranças:** 3 (`maxAttempts` = 3).
- **Espera entre elas:** 200 ms antes da 2ª tentativa e 400 ms antes da 3ª. Depois da 3ª não há espera.
- **Status final do pedido:** `payment_failed`, com o motivo `timeout` e 3 tentativas registradas.
- **Reserva de estoque:** é liberada (`inventory.release`). As unidades voltam a ficar disponíveis e nada é baixado do estoque (o `commit` só ocorre quando o pagamento é aprovado).
- **Mensagem à cliente:** o evento `payment.failed` dispara o e-mail com o assunto "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." e traz a assinatura da loja.
- **Relatório de vendas:** não entra, porque o `salesReport` exclui pedidos com status `payment_failed`.

## (c) Arquivos com as regras

Os caminhos são relativos à raiz do projeto.
- **Preços do catálogo e peso:** `src/catalog/seed.js`
- **Alíquota por estado, frete por região, limite de frete grátis e parâmetros de pagamento (tentativas e backoff):** `src/config.js`
- **Cupons (BEMVINDO10):** `src/pricing/coupons.js` e `src/pricing/discounts.js`
- **Ordem do cálculo (subtotal, desconto, frete, imposto, total):** `src/pricing/pricing.js`
- **Frete:** `src/pricing/shipping.js`
- **Imposto:** `src/pricing/tax.js`
- **Tentativas e espera da cobrança:** `src/payments/paymentService.js`
- **Resposta `timeout` do gateway:** `src/payments/paymentGateway.js`. Este é um gateway falso (`FakePaymentGateway`), cujo roteiro de respostas é definido nos testes.
- **Fluxo do pedido (status e liberação da reserva):** `src/orders/orderService.js`, `src/orders/order.js` e `src/inventory/inventory.js`
- **Texto da mensagem:** `src/notifications/templates.js`
- **Exclusão do relatório:** `src/reports/salesReport.js`