Li as regras e vou fechar a resposta. Não precisei de subagentes nem alterei arquivos.

## (a) Quanto ela paga

| Item | Valor |
|---|---|
| Subtotal | **R$ 219,70** |
| Desconto | **R$ 21,97** |
| Frete | **R$ 51,60** |
| Imposto | **R$ 39,55** |
| **Total** | **R$ 288,88** |

Como cada valor é calculado:
- **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 219,70.
- **Desconto:** BEMVINDO10 dá 10% sobre o subtotal, desde que ele seja maior que R$ 100. Aqui é 219,70, então o cupom vale e o desconto é 21,97. O subtotal com desconto fica em 197,73.
- **Frete:** o peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg. Manaus é região norte, então o frete é base 32,00 + 9,80 × 2 = 51,60. Não é grátis, porque 197,73 é menor que o limite de 299,90 e o cupom não dá frete grátis. O frete usa o subtotal já com desconto.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal com desconto, sem incluir o frete. 197,73 × 0,20 = 39,546, que arredonda para 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = 288,88.

Esses valores vêm da leitura do código. Não rodei o cálculo.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3 (`maxAttempts = 3`). O timeout é falha temporária, então o sistema tenta de novo.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última.
- **Status final:** `payment_failed`. O pedido passa de `pending` para `payment_failed`, guardando o motivo `timeout` e `attempts = 3`.
- **Reserva de estoque:** é liberada (`inventory.release`). As 2 unidades de LIV-001 e a 1 de CAN-010 voltam a ficar disponíveis e nada sai do estoque.
- **Mensagem à cliente:** o evento `payment.failed` dispara o e-mail "Pagamento do pedido ORD-… não aprovado". O corpo diz: "Olá, <nome>. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." Termina com a assinatura da Loja Dev.
- **Relatório de vendas:** não entra. `salesReport` descarta os pedidos com status `payment_failed`.

## (c) Arquivos com as regras

Caminhos relativos à raiz do projeto:
- `src/config.js`: alíquotas por estado, frete por região, limite de frete grátis, tentativas e backoff do pagamento.
- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010.
- `src/pricing/coupons.js` e `src/pricing/discounts.js`: definição e avaliação do BEMVINDO10.
- `src/pricing/pricing.js`: ordem do cálculo (subtotal, desconto, frete, imposto, total).
- `src/pricing/shipping.js`: frete.
- `src/pricing/tax.js`: imposto.
- `src/payments/paymentService.js`: tentativas e espera entre elas.
- `src/payments/paymentGateway.js`: gateway falso (o `timeout` roteirizado).
- `src/orders/orderService.js`: fluxo de `payOrder` (falha de pagamento e liberação da reserva).
- `src/orders/order.js`: status e transições do pedido.
- `src/inventory/inventory.js`: reserva e liberação de estoque.
- `src/notifications/templates.js` e `src/notifications/notifier.js`: texto e envio do e-mail.
- `src/reports/salesReport.js`: exclusão de `payment_failed` do relatório.

Um detalhe que não muda o resultado: o comentário de `coupons.js` diz que `minSubtotal` é inclusivo, mas `discounts.js` usa `subtotal <= minSubtotal` para recusar. Um subtotal de exatamente R$ 100,00 seria recusado. Neste pedido não importa, porque o subtotal é 219,70.