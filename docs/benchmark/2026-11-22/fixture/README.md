# loja-pedidos

Núcleo de pedidos de uma loja on-line, sem dependências externas.

## Módulos

- `src/catalog`: produtos e busca no catálogo.
- `src/inventory`: estoque com reservas por pedido.
- `src/cart`: carrinho de compras.
- `src/pricing`: cupons, impostos por estado, frete e o total do pedido.
- `src/orders`: o pedido, o repositório em memória e o serviço que coordena o fluxo.
- `src/payments`: gateway de pagamento (falso, para testes) e o serviço com novas tentativas.
- `src/events`: barramento de eventos em memória.
- `src/notifications`: mensagens ao cliente a partir dos eventos.
- `src/reports`: relatório de vendas.
- `src/util`: erros de domínio, validação, ids, relógio e log.

## Fluxo de um pedido

1. `placeOrder` valida o cliente e os itens, reserva o estoque, calcula o total e grava o pedido como `pending`.
2. `payOrder` cobra pelo `PaymentService`; com sucesso o pedido vira `paid` e o estoque reservado sai do estoque.
   Se a cobrança falhar de vez, o pedido vira `payment_failed`.
3. `shipOrder` e `deliverOrder` levam o pedido a `shipped` e `delivered`.

## Testes

```
npm test
```
