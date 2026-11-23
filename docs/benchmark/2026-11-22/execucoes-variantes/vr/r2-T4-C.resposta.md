**(a) Valores do pedido (cliente de Manaus, AM)**

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

Como cada valor é calculado:
- **Subtotal:** 2 × R$ 89,90 (LIV-001) = R$ 179,80, mais 1 × R$ 39,90 (CAN-010). Soma R$ 219,70.
- **Desconto:** BEMVINDO10 é 10% sobre o subtotal, com subtotal mínimo de R$ 100. Aqui o subtotal é R$ 219,70, então o cupom vale. O desconto é R$ 21,97, e o subtotal com desconto fica em R$ 197,73.
- **Frete:**
  - É calculado sobre o subtotal já com desconto.
  - O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima: 2 kg.
  - AM está na região norte, com base de R$ 32,00 mais R$ 9,80 por kg: 32 + 9,8 × 2 = R$ 51,60.
  - Não há frete grátis, porque R$ 197,73 está abaixo de R$ 299,90 e o cupom não é de frete grátis.
- **Imposto:** AM tem alíquota de 20%, aplicada sobre o subtotal com desconto, sem incluir o frete. 197,73 × 0,20 = 39,546, que arredonda para R$ 39,55.
- **Total:** 197,73 + 39,55 + 51,60 = R$ 288,88.

**(b) Gateway com `timeout` em todas as tentativas**

- **Cobranças:** 3 (`maxAttempts` = 3). O timeout é falha temporária (`retryable`), então o sistema tenta de novo.
- **Espera entre elas:** 200 ms entre a 1ª e a 2ª, e 400 ms entre a 2ª e a 3ª. Não há espera depois da última tentativa.
- **Status final:** `payment_failed`, com motivo `timeout` e 3 tentativas registradas.
- **Estoque:** a reserva é liberada com `inventory.release`. As unidades voltam ao disponível e nada é baixado definitivamente.
- **Mensagem à cliente:** o evento `payment.failed` envia o e-mail "Pagamento do pedido ORD-… não aprovado". O texto é: "Olá, {nome}. Não conseguimos aprovar o pagamento do pedido … (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser." No fim vêm o nome da loja e o e-mail de atendimento.
- **Relatório de vendas:** não entra. `salesReport` descarta pedidos com status `payment_failed`.

**(c) Arquivos com as regras**

- **Catálogo (preços, pesos, categorias):** `src/catalog/seed.js`
- **Alíquotas, frete (base, por kg, limite de frete grátis) e política de pagamento (tentativas e backoff):** `src/config.js`
- **Cupons (BEMVINDO10):** `src/pricing/coupons.js` e `src/pricing/discounts.js`
- **Ordem do cálculo e total:** `src/pricing/pricing.js`
- **Frete:** `src/pricing/shipping.js`
- **Imposto:** `src/pricing/tax.js`
- **Tentativas e espera da cobrança:** `src/payments/paymentService.js`. O contrato do gateway está em `src/payments/paymentGateway.js`.
- **Status do pedido e liberação do estoque:** `src/orders/orderService.js` (`payOrder`), `src/orders/order.js` (`markPaymentFailed`) e `src/inventory/inventory.js` (`release`)
- **Mensagem à cliente:** `src/notifications/templates.js`
- **Relatório de vendas:** `src/reports/salesReport.js`

Não alterei nem criei arquivos, e não fiz commit.