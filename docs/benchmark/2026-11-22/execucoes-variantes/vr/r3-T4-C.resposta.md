## (a) Quanto ela paga

O total é **R$ 288,88**. Os valores:

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto (BEMVINDO10) | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto (AM) | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor é calculado, na ordem de `computeTotals`:

1. **Subtotal:** 2 × 89,90 (LIV-001) + 1 × 39,90 (CAN-010) = 179,80 + 39,90 = R$ 219,70.
2. **Desconto:** BEMVINDO10 dá 10% sobre o subtotal e exige subtotal acima de R$ 100. Como 219,70 passa dessa marca, o desconto é 21,97. O subtotal com desconto fica em R$ 197,73.
3. **Frete:** o peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima para 2 kg. AM está na região norte, com base de R$ 32,00 mais R$ 9,80 por kg: 32 + 9,80 × 2 = R$ 51,60. O frete grátis só vale a partir de R$ 299,90 sobre o subtotal com desconto. Aqui são 197,73, então o frete é cobrado.
4. **Imposto:** a alíquota de AM é 20%, aplicada sobre o subtotal com desconto, sem incluir o frete. 197,73 × 0,20 = 39,546, que arredonda para R$ 39,55.
5. **Total:** 197,73 + 39,55 + 51,60 = R$ 288,88.

## (b) Gateway responde `timeout` em todas as tentativas

- **Cobranças:** 3 (`maxAttempts` = 3).
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª e 400 ms entre a 2ª e a 3ª. Não há espera depois da última.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas. A cobrança é repetida porque o gateway marca `timeout` como falha temporária.
- **Reserva de estoque:** é liberada (`inventory.release`), então os itens voltam ao estoque.
- **Mensagem à cliente:** o evento `payment.failed` dispara o e-mail "Pagamento do pedido ORD-… não aprovado". O texto é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser."
- **Relatório de vendas:** o pedido não entra, porque `salesReport` filtra os pedidos com status `payment_failed`.

Não rodei o código nem os testes. As respostas vêm da leitura das regras.

## (c) Arquivos com as regras

- **Catálogo, preços e pesos:** `src/catalog/seed.js`
- **Alíquotas, frete por região, limite de frete grátis e política de pagamento (tentativas e espera):** `src/config.js`
- **Cupom BEMVINDO10:** `src/pricing/coupons.js` e `src/pricing/discounts.js`
- **Ordem do cálculo (subtotal, desconto, frete, imposto, total):** `src/pricing/pricing.js`
- **Frete:** `src/pricing/shipping.js`
- **Imposto:** `src/pricing/tax.js`
- **Arredondamento:** `src/money.js`
- **Tentativas e espera da cobrança:** `src/payments/paymentService.js`
- **Falha temporária do gateway:** `src/payments/paymentGateway.js`
- **Status do pedido e liberação do estoque:** `src/orders/orderService.js` e `src/orders/order.js`
- **Mensagem à cliente:** `src/notifications/templates.js`
- **Relatório de vendas:** `src/reports/salesReport.js`