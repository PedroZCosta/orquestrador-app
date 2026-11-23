# Tarefas do benchmark

Projeto: `fixture/` (loja-pedidos, Node 22 sem dependências, 51 testes). Cada execução trabalha numa cópia nova da fixture em /tmp com `git init` e commit inicial. O prompt enviado é o texto abaixo seguido do sufixo comum:

> Não faça perguntas: decida o que for preciso e siga até o fim. Não faça commit.

O checador (`scripts/checar.mjs`) roda numa cópia do resultado; os testes ocultos nunca entram na pasta em que o agente trabalhou.

## T1: Correção pequena: pedido mínimo do cupom inclusivo

### Prompt

```text
Bug relatado por uma cliente neste projeto (loja-pedidos, Node sem dependências): um pedido de exatamente R$ 100,00 com o cupom BEMVINDO10 foi recusado por pedido mínimo não atingido, mas a descrição do cupom diz "para pedidos a partir de R$ 100,00". Corrija para que o pedido mínimo dos cupons seja inclusivo (vale para todos os cupons com mínimo), sem mudar mais nada do comportamento, e acrescente um teste que cubra o caso. Rode `npm test` ao final: tudo tem de passar.

Não faça perguntas: decida o que for preciso e siga até o fim. Não faça commit.
```

### Critério de sucesso

Checador: a suíte do projeto (`node --test`, com os testes que o agente escreveu) passa e o teste oculto `ocultos/t1.test.js` passa (pedido de exatamente R$ 100,00 recebe o BEMVINDO10; DESC50 e FRETEGRATIS também inclusivos no mínimo; abaixo do mínimo continua recusado; acima segue igual).

## T2: Feature em vários arquivos: cancelamento de pedidos

### Prompt

```text
Implemente o cancelamento de pedidos neste projeto (loja-pedidos, Node sem dependências). Requisitos:
1. Novo método assíncrono `OrderService#cancelOrder(orderId, reason)`, que devolve o pedido atualizado. `reason` é obrigatório (texto não vazio); sem ele, lança o erro de validação do projeto (código `VALIDATION_ERROR`). Pedido inexistente: `ORDER_NOT_FOUND`, como nos outros métodos.
2. Só cancela pedido `pending` ou `paid`; em qualquer outro status (inclusive um pedido já cancelado) lança `DomainError` com o código `ORDER_NOT_CANCELLABLE`.
3. Novo status `cancelled` (em `ORDER_STATUSES`); o pedido guarda `cancelReason` e `cancelledAt` (ISO, do relógio da loja) e ganha a entrada correspondente no histórico.
4. Pedido pendente: desfaz a reserva de estoque; não há estorno.
5. Pedido pago: estorna o valor total pelo gateway (`refund` com o `paymentId` do pagamento), uma única vez, e devolve os itens ao estoque físico. Se o gateway recusar o estorno, lança `REFUND_FAILED` e o pedido continua `paid`, sem mexer no estoque.
6. Emite o evento `order.cancelled` com `{ orderId, email, name, reason, refunded }`, e o cliente recebe uma mensagem com o assunto `Pedido <id> cancelado` (corpo no padrão das outras mensagens).
7. O relatório de vendas (`salesReport`) deixa de contar pedidos cancelados.
8. Testes novos cobrindo esses casos e o README atualizado. Rode `npm test` ao final: tudo tem de passar.

Não faça perguntas: decida o que for preciso e siga até o fim. Não faça commit.
```

### Critério de sucesso

Checador: a suíte do projeto passa e o teste oculto `ocultos/t2.test.js` passa (status `cancelled`; pendente desfaz reserva sem estorno; pago estorna o total uma vez e devolve ao estoque físico; `ORDER_NOT_CANCELLABLE` para enviado, entregue, recusado e já cancelado; `VALIDATION_ERROR` sem motivo; `ORDER_NOT_FOUND`; `REFUND_FAILED` mantém `paid`; evento `order.cancelled`; e-mail `Pedido <id> cancelado`; relatório ignora cancelados).

## T3: Refatoração sem mudar comportamento: dinheiro centralizado em src/money.js

### Prompt

```text
Refatoração sem mudança de comportamento neste projeto (loja-pedidos, Node sem dependências): o arredondamento e a formatação de dinheiro estão espalhados pelo código, com `Math.round(x * 100) / 100` e formatadores de "R$" locais repetidos em vários módulos. Centralize tudo em `src/money.js` (use `round2`, `formatBRL`, `sumMoney` e `percentOf`, ampliando-as se precisar) e troque os usos espalhados por essas funções. Regras: nenhuma saída pública pode mudar (valores, textos das mensagens, relatório, alertas), byte a byte; ao final não pode sobrar `Math.round` nem `toFixed` fora de `src/money.js`; não altere os testes existentes, que têm de continuar passando sem mudança. Rode `npm test` ao final.

Não faça perguntas: decida o que for preciso e siga até o fim. Não faça commit.
```

### Critério de sucesso

Checador: a suíte do projeto passa; os testes originais da fixture, recolocados sem mudança, passam; as saídas públicas (round2, formatBRL, sumMoney, percentOf, totais de 8 cestas × 7 cupons × 14 estados, mensagens, relatório e alertas) são idênticas byte a byte a `ocultos/t3-golden.json` (`scripts/t3-verificar.mjs`); não sobra `Math.round` nem `toFixed` em `src/` fora de `src/money.js`.

## T4: Investigação com resposta em texto: total e falha de pagamento

### Prompt

```text
Pergunta sobre este projeto (loja-pedidos, Node sem dependências); responda em texto, sem alterar nem criar arquivos no projeto. Uma cliente de Manaus (AM) faz um pedido de 2 unidades de LIV-001 e 1 de CAN-010 com o cupom BEMVINDO10 e paga com cartão de crédito.
(a) Quanto ela paga? Informe, em reais, o subtotal, o desconto, o frete, o imposto e o total, e explique como cada valor é calculado.
(b) Se o gateway responder `timeout` (falha temporária) em todas as tentativas de cobrança: quantas cobranças são feitas, quanto tempo de espera há entre elas (em ms), em que status o pedido termina, o que acontece com a reserva de estoque, que mensagem a cliente recebe e se o pedido entra no relatório de vendas.
(c) Indique os arquivos (caminho) onde estão as regras usadas nas respostas.

Não faça perguntas: decida o que for preciso e siga até o fim. Não faça commit.
```

### Critério de sucesso

Checador: nenhum arquivo alterado ou criado no projeto (`git status --porcelain` vazio) e a resposta final contém os 14 fatos de `ocultos/t4-fatos.mjs`: subtotal 219,70; desconto 21,97; frete 51,60; imposto 39,55; total 288,88; 3 cobranças; esperas de 200 e 400 ms; `payment_failed`; reserva liberada; mensagem de pagamento não aprovado; fora do relatório; cita shipping.js, tax.js e paymentService.js.
