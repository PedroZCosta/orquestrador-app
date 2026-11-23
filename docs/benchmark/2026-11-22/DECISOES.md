# Decisões do benchmark Go SubAgents x Claude Code (2026-11-22/23)

Registro de cada decisão e do porquê, na ordem em que foram tomadas. Atualizado a cada passo (pode haver interrupção).

## Progresso

- [x] fixture/ (projeto loja-pedidos, Node sem dependências): `node --test` passa (51 testes, 14 suítes), conferido em 23/11.
- [x] tarefas.json (T1 a T4) e ocultos/ (t1.test.js, t2.test.js, t3-casos.mjs, t4-fatos.mjs).
- [x] ocultos/t3-golden.json gerado do código original (`node scripts/t3-verificar.mjs fixture --gerar`), 289 KB; a fixture original confere idêntica.
- [x] scripts/checar.mjs conferido na fixture original: T1, T2 e T3 reprovam (como devem); T4 com resposta vazia reprova; T1 com a correção de referência (`<=` para `<` em `src/pricing/discounts.js:19`) aprova; T4 com resposta de referência aprova.
- [x] Fatos da T4 conferidos rodando o código original: subtotal 219,70; desconto 21,97; frete 51,60; imposto 39,55; total 288,88; 3 cobranças; esperas [200, 400] ms; `payment_failed`; reserva liberada (disponível volta a 20); e-mail "Pagamento do pedido ORD-0001 não aprovado"; relatório com 0 pedidos.
- [x] Tabela de preços de scripts/medir.ts conferida com a página oficial em 23/11 (ver "Preços").
- [x] TAREFAS.md
- [x] scripts/harness.mjs e scripts/analisar.mjs (revisados em 23/11; ver "Revisão do harness")
- [x] Fumaça A, B e C (fumaca/), T1, 23/11 07:05 a 07:07: as três com sucesso
- [x] Disparo das 36 execuções (ver "Disparo")

## Correções feitas no que já existia

- `scripts/checar.mjs`: `node --test test/` e `node --test test-ocultos/` não funcionam no Node 22.21 (diretório como argumento vira "arquivo não encontrado" e o teste falha). Trocado por globs `test/*.test.js` e `test-ocultos/*.test.js`. Sem essa correção, toda T3 reprovaria em "os testes originais falham" e a T1/T2 reprovariam por motivo errado.
- `ocultos/t3-golden.json` não existia: gerado.

## Tarefas

Ver TAREFAS.md. As 4 tarefas do benchmark original do Leandro não estão nesta máquina; foram criadas 4 tarefas novas na fixture, cobrindo os 4 tipos (correção pequena, feature em vários arquivos, refatoração sem mudar comportamento, investigação com resposta em texto). Mesmo prompt nas 3 configurações; todo prompt termina com "Não faça perguntas: decida o que for preciso e siga até o fim. Não faça commit." (campo `sufixo` de tarefas.json).

## Configurações

- **A (Claude Code puro, padrão da máquina)**: `claude -p <prompt> --output-format stream-json --verbose --session-id <uuid> --permission-mode bypassPermissions`, sem `--model`/`--effort`. Valem `~/.claude/settings.json` (`model: opus`, `effortLevel: high`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW=350000`, hooks do usuário). Permissão: `bypassPermissions`, porque a pasta é temporária e descartável e o teste exige editar e rodar `npm test` sem ninguém para aprovar; é o equivalente ao "Editar e rodar comandos" do app.
- **B (Claude Code puro com o modelo e o esforço do app)**: igual à A com `--model sonnet --effort medium`. Em 45b1b81 a configuração padrão de criação (`web/src/shared/modelos.ts:46-60`, `CONFIGURACAO_PADRAO_DO_ORQUESTRADOR`) é: Orquestrador `sonnet` com esforço `medio`; Subagentes `sonnet` com esforço `medio`; quantidade automática até 3; nível `leitura`. `medio` vira `--effort medium` (`ArgumentosDoClaudeCode.ts:55`).
- **C (o app em 45b1b81 de verdade)**: só o servidor Node (sem Electron, sem tela), numa instância isolada (ver "Instância isolada"). Orquestrador criado pela API com a configuração padrão de criação, mudando só `nivelDePermissao` de `leitura` para `edicao_e_comandos`: no nível padrão (só leitura) o Orquestrador não consegue editar nem rodar `npm test`, e T1 a T3 seriam impossíveis. É a escolha que o usuário faria na tela para essas tarefas.
- Ambiente das três: o harness limpa do ambiente as variáveis herdadas da sessão que o disparou (`CLAUDE*`, `AI_AGENT`), porque `CLAUDE_EFFORT=high`, `CLAUDECODE=1`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` etc. alterariam o comportamento. As variáveis de `settings.json` (como `CLAUDE_CODE_AUTO_COMPACT_WINDOW`) o próprio Claude Code reaplica.

## Instância isolada (C)

- Código: `git archive 45b1b81` em `/tmp/bench-gosub/app-45b1b81`, `node_modules` por symlink para `/Users/pedro/Projetos/orquestrador-app-atualizacao/node_modules` (só leitura; nada instalado nem gerado lá).
- Servidor: `tsx src/root.ts` com `PORTA=3317`, `PASTA_DADOS=/tmp/bench-gosub/dados-c`, `PASTA_RAIZ_PROJETOS=/tmp/bench-gosub/projetos`, `ORQUESTRADOR_CHAVE_DE_ACESSO=<64 hex em /tmp/bench-gosub/chave>`. A trava continua ligada (sem `ORQUESTRADOR_PERMITIR_NAVEGADOR`): o harness entra com o cookie `orquestrador_acesso` e o `Host` local, como o Electron faz. Log em `/tmp/bench-gosub/servidor-c.log`, PID em `/tmp/bench-gosub/servidor-c.pid`. Encerrado (kill) pelo harness ao fim.
- O registro de processos órfãos do servidor fica em `dados-c`, então ele não enxerga nem encerra processos do app instalado.

## Preços (US$ por milhão de tokens)

Fonte: https://platform.claude.com/docs/en/about-claude/pricing, lida em 23/11/2026. Entrada / escrita de cache 5 min / escrita 1 h / leitura de cache / saída:

| Modelo | Entrada | Cache 5m | Cache 1h | Leitura | Saída |
|---|---|---|---|---|---|
| Opus 5.5 | 4 | 5 | 8 | 0,20 | 20 |
| Opus 5 / 4.8 / 4.7 / 4.6 | 5 | 6,25 | 10 | 0,50 | 25 |
| Sonnet 5.5 | 2 | 2,50 | 4 | 0,10 | 10 |
| Sonnet 5 | 2 | 2,50 | 4 | 0,20 | 10 |
| Sonnet 4.6 | 3 | 3,75 | 6 | 0,30 | 15 |
| Haiku 5.5 (até 100k de prompt) | 0,10 | 0,125 | 0,20 | 0,01 | 0,50 |
| Haiku 5.5 (acima de 100k) | 0,50 | 0,625 | 1 | 0,05 | 2,50 |
| Haiku 4.5 | 1 | 1,25 | 2 | 0,10 | 5 |

O custo em US$ é o equivalente de API (a máquina usa assinatura); o índice de custo é o do app (`UsoDeTokens.indiceDeCusto`: entrada + 1,25×criação + 0,1×leitura + 5×saída).

## Revisão do harness (23/11, executor da retomada)

- Achado na fumaça C interrompida (orquestrador 4cfe7681, 06:56): o app em 45b1b81 cria uma worktree própria (`dados-c/worktrees/<id8>`, branch `orquestrador/<id>`) e o agente edita lá, não na pasta preparada pelo harness. Sem correção, o checador, o diff e a T4 (git status) olhariam a pasta intacta e toda T1 a T3 da C reprovaria. Correção: o harness lê `orquestrador.json` (`worktree.caminho`) e usa essa pasta para checador, diff e medição (a medição pelas transcrições deu o mesmo índice do app, 107929, nas duas pastas).
- Fumaça disparada em 07:05 (T1, A,B,C), log em /tmp/bench-gosub/fumaca.log.
- Outras correções no harness: em C o tempo agora vem do carimbo `em` do evento de fim de turno (antes era "agora menos 20 s", com erro de até 3 s do intervalo de leitura); ao fim de cada execução da C, `eventos.jsonl` e `orquestrador.json` são copiados para a pasta de saída (`<id>.eventos.jsonl`, `<id>.orquestrador.json`), o orquestrador é removido pela API (DELETE) e a worktree do app é apagada junto com a pasta do projeto (só dentro de /tmp/bench-gosub). O mesmo vale numa nova tentativa por erro transitório.
- Conferido contra o prometido: 36 execuções (3 rodadas × T1..T4 × A/B/C, mulberry32 semente 20261122, Fisher-Yates por rodada e tarefa, plano gravado em plano.json), sequencial, retomável (pula quem tem JSON), teto de 40 min, até 3 novas tentativas em 529/500/overloaded/limite sem contar como falha (esperas 2, 5 e 10 min; no limite, até a renovação + 1 min, no máximo 6 h), carga antes (espera até 10 min se houver render/build pesado) e depois, JSON com tokens por tipo do principal e dos subagentes, índice, US$, tempo, modelo real, subagentes, turnos, checador com motivo, cota antes/depois, diff e resposta guardados, "Plano aprovado." automático na C (rota `plano/aprovar`, a mesma da tela), ao fim analisar.mjs, encerra a instância isolada e cria FIM.
- A sobra da fumaça C interrompida (orquestrador 4cfe7681, pasta e worktree) foi removida antes da fumaça nova.

## Fumaça (T1, fora da contagem)

| Config | Sucesso | Índice | US$ | Tempo | Modelo | Subagentes | Turnos do agente |
|---|---|---|---|---|---|---|---|
| A | sim | 62.060 | 0,2914 | 24,8 s | claude-opus-5-5 | 0 | 8 |
| B | sim | 60.643 | 0,1367 | 18,7 s | claude-sonnet-5-5 | 0 | 9 |
| C | sim | 93.584 | 0,2016 (principal 0,1280 + subagentes 0,0737) | 22,3 s | claude-sonnet-5-5 | 1 | (app: 1 turno) |

- US$ da A e da B confere com o `total_cost_usd` do próprio Claude Code (0,291416 e 0,136650). Índice da C confere com o `consumo_do_turno_medido` do app (93.584, 1 subagente medido). Checador rodou na worktree do app na C (diff com `src/pricing/discounts.js` e `test/discounts.test.js`).
- Cota da assinatura: cada execução traz uma leitura (janela de 7 dias em 54%), então "antes" e "depois" coincidem; é contaminada pelos outros orquestradores da máquina.
- Pastas temporárias, orquestrador e worktree limpos ao fim (projetos/, dados-c/worktrees e dados-c/orquestradores vazios).

## Disparo

- PID 20258, início 2026-11-23 07:07:42 -03, comando `nohup node scripts/harness.mjs > execucao.log 2>&1 &` nesta pasta. Fim: arquivo `FIM` aqui; resumo em `resumo.json`.
- Primeira execução (r1-T1-B) esperou 60 s por um render do Remotion de outro orquestrador (espera registrada em `carga.esperouS`), rodou às 07:08 e passou (US$ 0,1476, 24,4 s); a segunda (r1-T1-A) começou em seguida. Estimativa: 2 h 30 a 4 h para as 36.
