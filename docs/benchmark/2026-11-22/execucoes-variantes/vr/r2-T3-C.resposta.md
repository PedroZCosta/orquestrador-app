Refatoração concluída. O `npm test` passou, 51 de 51, e não há commit.

- **Centralização:** todos os arredondamentos e formatadores de "R$" espalhados em 8 arquivos agora usam `src/money.js` (`round2`, `sumMoney`, `percentOf`, `formatBRL`). O `rg` não encontra mais `Math.round` nem `toFixed` fora desse arquivo.
- **Funções novas em `money.js`:**
  - `formatBRLExact` mantém o `formatReport` do relatório de vendas idêntico ao original, porque o formatador antigo não arredondava antes de formatar.
  - `formatBRLSafe` mantém o `lowStockAlert` idêntico com valores não finitos. Para NaN ou Infinity devolve `R$ NaN` ou `R$ Infinity`, como antes.
- **Testes:** os existentes não foram alterados.

Não comparei a saída com NaN contra a original; o `formatBRLSafe` foi escrito para reproduzi-la, mas esse caso não foi testado.