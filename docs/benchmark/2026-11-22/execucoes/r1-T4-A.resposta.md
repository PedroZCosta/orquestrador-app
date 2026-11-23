A cliente paga **R$ 288,88**. Conferi os valores lendo o código e também rodando o fluxo real (`createStore`, `placeOrder`, `payOrder`) num script temporário fora do projeto, com um gateway roteirizado para responder `timeout`. Apaguei o script depois, e o `git status` do projeto continua limpo.

## (a) Quanto ela paga

| Item | Valor |
|---|---|
| Subtotal | R$ 219,70 |
| Desconto (BEMVINDO10) | R$ 21,97 |
| Frete | R$ 51,60 |
| Imposto | R$ 39,55 |
| **Total** | **R$ 288,88** |

O cálculo segue esta ordem:

1. **Subtotal:** 2 × R$ 89,90 (LIV-001) + 1 × R$ 39,90 (CAN-010) = R$ 219,70, arredondado em 2 casas.
2. **Desconto:** BEMVINDO10 dá 10% sobre o subtotal e só vale com subtotal **acima** de R$ 100. O código recusa quando `subtotal <= minSubtotal`, ou seja, exatamente R$ 100,00 não passa, embora a descrição do cupom diga "a partir de". Aqui 219,70 > 100, então o cupom vale: 10% de 219,70 = R$ 21,97. O subtotal com desconto fica em R$ 197,73.
3. **Frete:** AM fica na região `norte`, com base de R$ 32,00 e R$ 9,80 por kg. O peso é 2 × 0,6 + 0,4 = 1,6 kg, arredondado para cima até 2 kg. Frete = 32 + 9,80 × 2 = R$ 51,60. Não é grátis, porque o subtotal com desconto (197,73) não chega ao limite de R$ 299,90 e o cupom não dá frete grátis.
4. **Imposto:** a alíquota de AM é 20% e incide sobre o subtotal com desconto. O frete não é tributado. 197,73 × 0,20 = 39,546, que arredonda para R$ 39,55.
5. **Total:** 197,73 + 39,55 + 51,60 = R$ 288,88.

O cartão de crédito (`credit_card`) não altera o preço. Ele só precisa ser um dos métodos aceitos.

## (b) Gateway responde `timeout` em todas as tentativas

- **Número de cobranças:** 3, que é o `maxAttempts`. O `timeout` é uma falha temporária (`retryable: true`), então o serviço tenta de novo até chegar ao limite.
- **Espera entre elas:** 200 ms antes da 2ª tentativa e 400 ms antes da 3ª. Depois da última não há espera. São 600 ms de espera no total.
- **Status final:** `payment_failed`, com `payment = { paymentId: null, attempts: 3, failureReason: 'timeout' }`. É um status final, sem nenhuma transição possível depois dele.
- **Reserva de estoque:** é desfeita com `release`. As 2 unidades de LIV-001 e a 1 de CAN-010 voltam a ficar disponíveis (`reserved` volta a 0) e o `onHand` não muda (continua 20 e 30). Nada sai do estoque.
- **Mensagens que a cliente recebe:**
  - Ao criar o pedido, antes do pagamento: "Pedido ORD-0001 recebido", com o valor de R$ 288,88.
  - Depois da falha:
    - Assunto: `Pagamento do pedido ORD-0001 não aprovado`
    - Corpo: `Olá, <nome>. Não conseguimos aprovar o pagamento do pedido ORD-0001 (timeout). Os itens voltaram ao estoque; faça um novo pedido quando quiser.` seguido da assinatura "Loja Dev / Dúvidas: atendimento@lojadev.example".
  - O ID ORD-0001 é o da simulação numa loja nova. Na prática depende do gerador de IDs.
- **Relatório de vendas:** o pedido **não entra**. O `salesReport` exclui pedidos com status `payment_failed`, e na simulação `orderCount` deu 0.

## (c) Arquivos com as regras

- `src/catalog/seed.js`: preços e pesos de LIV-001 e CAN-010, e o estoque inicial.
- `src/pricing/coupons.js`: definição do cupom BEMVINDO10.
- `src/pricing/discounts.js`: avaliação do cupom (mínimo com `<=`, desconto percentual) e o subtotal.
- `src/pricing/pricing.js`: ordem do cálculo e o total.
- `src/pricing/shipping.js`: frete (base + kg arredondado para cima, frete grátis).
- `src/pricing/tax.js`: imposto sobre o subtotal com desconto.
- `src/config.js`: alíquota e região de AM, tabela de frete, limite de frete grátis, `maxAttempts`, `backoffMs` e métodos de pagamento.
- `src/payments/paymentService.js`: lógica das novas tentativas e das esperas.
- `src/payments/paymentGateway.js`: contrato do gateway (`retryable`, `reason`).
- `src/orders/orderService.js`: `payOrder` (marca a falha, libera a reserva, emite `payment.failed`).
- `src/orders/order.js`: status e transições.
- `src/inventory/inventory.js`: `reserve` e `release`.
- `src/notifications/templates.js` e `src/notifications/notifier.js`: texto e envio das mensagens.
- `src/reports/salesReport.js`: exclusão de `payment_failed` do relatório.