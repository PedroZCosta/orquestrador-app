# Plugins e skills por pedido: ajuste e validação (25/11/2026)

Código medido: worktree 549e8a7f (0f773b8 + alterações locais em `src/`). Página com tudo: `entrega.html` (autocontida). Números brutos: `dados/comparacao.json`, `provas.json` e `../2026-11-22/resumo-variantes.json` (variante `plugins-por-pedido`).

## O que mudou

- `src/infraestrutura/claudecode/SeletorDePlugins.ts`
  - Escolha **cumulativa** na sessão (`acumular`): anterior ∪ (citado ∪ modelo); nunca remove o que já foi carregado. Origem, motivo e consumo são os do turno; o motivo cita o que foi mantido (`"...; mantidas da sessão: dataviz"` ou `"...; nada novo, mantidas da sessão: ..."`).
  - `ehMensagemDeContinuacao`: começa com "Plano aprovado.", "continue", "continua", "prossiga", "ok" ou "sim", ou tem menos de 40 caracteres. Sem citação e com escolha anterior na sessão, não chama o Haiku: repete a anterior (origem `anterior`, motivo `mensagem sem tarefa nova; ...`). No primeiro turno da sessão o Haiku é consultado mesmo assim (senão "crie um gráfico de barras" nunca carregaria nada).
  - `aindaNoCatalogo` (filtro da anterior pelo catálogo) reaproveitado por `repetir`.
- `src/infraestrutura/Configuracao.ts`: `selecaoDePlugins`, de `ORQUESTRADOR_SELECAO_DE_PLUGINS` (`desligada` ou `0` desliga). `src/root.ts`: desligada, os dois motores recebem `null` (comportamento antigo). `.env.example` documenta.
- **Correção achada pelas provas**: a sessão não tinha a ferramenta `Skill` (fora de `--tools`), então as skills escolhidas nem entravam no contexto; na primeira rodada das provas o agente respondeu "Não consegui acionar a skill logo-design, porque ela não está disponível como ferramenta aqui". Sonda no CLI: com `--tools Read` o init lista 59 skills mas o contexto não as traz (8,2 mil tokens); com `--tools Read Skill`, 17,8 mil tokens. Agora `FERRAMENTA_DE_SKILLS` entra em `--tools`, `--allowedTools` e nas ferramentas dos subagentes só no turno em que algo foi carregado:
  - `ArgumentosDoClaudeCode.ts`: `montarArgumentos(pedido, arquivos, comSkills)` e `definicaoDosAgentes(pedido, comSkills)`.
  - `ArgumentosDoChat.ts`: `montarArgumentosDoChat(pergunta, arquivos, comSkills)`.
  - `MotorClaudeCodeCli.ts`: grava `agentes.json` depois da escolha; `MotorDeChatClaudeCodeCli.ts` passa `comSkills`.
  - Sem nada carregado (ou seletor desligado), os argumentos ficam iguais aos de antes.
- Harness (`../2026-11-22/scripts/harness.mjs`): `--app <pasta>` (ou `BENCH_APP`) escolhe o código que a instância sobe; `--saida <nome>` escolhe a pasta em `execucoes-variantes/`; com `--saida`, `--variante base` é aceita. Sem as opções, comportamento anterior. A medição (`medir.ts`) continua com o código de 45b1b81 (cópia recriada em `/tmp/bench-gosub/app-45b1b81` por `git archive 45b1b81`). Registra `pluginsEscolhidos` por execução.
- `../2026-11-22/scripts/analisar-variantes.mjs`: soma o seletor (`usdDoSeletor`, `usdComSeletor`, `tempoDoSeletorS`, `chamadasAoSeletor`); o custo do Haiku não está nas transcrições.

Testes: `vitest run --maxWorkers=2` em SeletorDePlugins, Configuracao, ArgumentosDoClaudeCode, ArgumentosDoChat, MotorClaudeCodeCli e MotorDeChatClaudeCodeCli: 6 arquivos, 132 testes, todos passaram. `tsc --noEmit`: sem erros.

## Benchmark (config C, 3 rodadas × T1..T4, só execuções que passaram no checador)

Comando: `node scripts/harness.mjs --variante base --app <worktree> --saida plugins-por-pedido` (por nohup; intermediário `variantes/claude` repassando intacto). Soma das médias das 4 tarefas; US$ desta entrega inclui o seletor.

| Configuração | US$ | Índice | Tokens | 1a chamada orq. | 1a chamada exec. | Tempo (s) | Válidas | vs C base | vs B | vs A |
|---|---|---|---|---|---|---|---|---|---|---|
| A (Claude Code puro, Opus) | 2.6544 | 598.251 | 1.840.641 | 30.928 | - | 422.8 | 12/12 | +147.4% | +240.5% | 0 |
| B (Claude Code puro, Sonnet) | 0.7795 | 331.993 | 959.948 | 30.818 | - | 159.9 | 12/12 | -27.3% | 0 | -70.6% |
| C base (app 45b1b81) | 1.0727 | 503.680 | 1.429.622 | 28.512 | 20.936 | 181.7 | 12/12 | 0 | +37.6% | -59.6% |
| V1 (sem peso do usuário) | 0.7115 | 335.784 | 837.456 | 17.519 | 11.304 | 149.5 | 12/12 | -33.7% | -8.7% | -73.2% |
| VR (recomendadas) | 0.5836 | 274.619 | 688.158 | 17.329 | 11.425 | 119.3 | 12/12 | -45.6% | -25.1% | -78.0% |
| **Plugins por pedido** | **0.7961** | **381.138** | **943.599** | **17.755** | **11.493** | **204.1** | **12/12** | **-25.8%** | **+2.1%** | **-70.0%** |

Índice vs C base: -24.3%. Tempo vs C base: +12.3% (inclui 14,0 s do seletor na soma das médias; a linha de base é de outro dia, então o tempo tem ruído de máquina).

| Tarefa | Válidas | US$ (c/ seletor) | US$ C base | vs C base | 1a chamada orq. | C base | Tempo (s) | C base |
|---|---|---|---|---|---|---|---|---|
| T1 | 3/3 | 0.1074 | 0.1673 | -35.8% | 17.053 | 28.363 | 27.2 | 20.2 |
| T2 | 3/3 | 0.3293 | 0.4468 | -26.3% | 19.643 | 28.785 | 81.6 | 90.0 |
| T3 | 3/3 | 0.2367 | 0.2815 | -15.9% | 17.137 | 28.430 | 71.1 | 50.5 |
| T4 | 3/3 | 0.1227 | 0.1771 | -30.7% | 17.185 | 28.468 | 24.2 | 20.9 |

Seletor: 12 chamadas ao Haiku (uma por execução), US$ 0,0073 e 41,9 s somados nas 12 execuções; na soma das médias, US$ 0,0024 e 14,0 s. Escolhas: superpowers em 2 das 3 execuções de T2 (o subagente chamou a Skill 2 vezes em r1 e 1 vez em r2); nada nas demais. Em r2-T3 e r3-T3 a resposta "Decida você e siga até o fim." repetiu a escolha sem Haiku (origem `anterior`).

Leitura: a primeira chamada cai ao nível da V1 (17,8 mil contra 17,5 mil tokens) e o custo fica a 12 pontos da V1, sem perder o acesso às skills quando o pedido pede. VR continua mais barata porque soma cortes que não são de plugin.

## Provas de comportamento

Instância isolada na porta 3317, `PASTA_DADOS=/tmp/bench-gosub/dados-c`, projeto `/tmp/bench-gosub/projetos/prova-plugins-mwwfk7oo`, config C, Claude Code real. Script: `scripts/provas.mjs`; eventos em `dados/provas-*.eventos.jsonl`.

| Prova | Evento plugins_escolhidos | Transcrição | 1a chamada orq. (tokens) | Custo do turno |
|---|---|---|---|---|
| 1. "crie um gráfico de barras em HTML com estes dados: jan 10, fev 14, mar 9" | `skills: ["dataviz"]`, origem `modelo`, motivo "Pedido de criar um gráfico de barras em HTML, que é exatamente o escopo da skill dataviz.", US$ 0,00009, 2,4 s | Orquestrador: `Skill({"skill":"dataviz"})`, sem perguntar | 18.398 | US$ 0,1241 + seletor 0,00009 |
| 3. "Plano aprovado. continue" (mesma sessão da 1) | `skills: ["dataviz"]`, origem `anterior`, motivo "mensagem sem tarefa nova; mantida a escolha do turno anterior", US$ 0, 4 ms | sem chamada nova (gráfico já pronto) | 25.389 (23.471 lidos do cache: cache preservado) | US$ 0,0113 |
| 2. "use o logo-design para esboçar um ícone simples em SVG de uma xícara" | `plugins: ["logo-design@logo-design-skill"]`, origem `citado`, US$ 0 | Orquestrador: `Skill({"skill":"logo-design:logo-design","args":"esboçar um ícone simples em SVG de uma xícara"})` | 18.224 | US$ 0,1034 |
| 4. "corrija o typo em README" | `plugins: [], skills: []`, origem `modelo`, motivo "Correção de typo num README é tarefa direta de edição...", US$ 0,00009 | nenhuma Skill; subagente corrigiu "exenplo" | 16.826 (exec. 10.498) | US$ 0,0720 + seletor 0,00009 |

Primeira rodada (antes da correção da ferramenta Skill, `dados/provas-sem-ferramenta-skill.json`): mesmas escolhas, nenhuma Skill chamada.

## Riscos

- Cumulativa: numa sessão longa que muda de assunto, o que foi carregado fica até o fim da sessão (custo pequeno por skill; preferido a invalidar o cache a cada turno).
- Mensagem que começa com "ok", "sim", "continue" ou "Plano aprovado." não consulta o Haiku mesmo trazendo tarefa nova depois (observações da aprovação, por exemplo); citar a skill pelo nome continua valendo. Curta (menos de 40 caracteres) idem, salvo no primeiro turno.
- Escolha em memória: reiniciar o app zera; o primeiro turno depois consulta o Haiku de novo.
- Seletor depende do Haiku: falha ou 8 s esgotados repetem a anterior (ou nenhuma) e o turno segue.
- Tempo: +3,5 s por turno com chamada ao Haiku.

## Como desligar

`ORQUESTRADOR_SELECAO_DE_PLUGINS=desligada` (ou `0`) no `.env`, e reiniciar o servidor: sem Haiku, sem `--settings` de plugins, sem a ferramenta Skill; tudo como o usuário configurou.

## Custo desta validação

Benchmark US$ 2,3884 (12 execuções, com seletor). Provas US$ 0,5667 (duas rodadas de 4). Sondas do CLI US$ 0,0049. Total cerca de US$ 2,96 (equivalente de API).
