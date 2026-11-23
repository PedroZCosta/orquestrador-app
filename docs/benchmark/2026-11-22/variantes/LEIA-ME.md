# Variantes de corte de tokens (benchmark 2026-11-22)

Nada em `src/` do app muda. O app chama o executável de `CLAUDE_CODE_BIN`; aqui ele aponta para `variantes/claude`, que lê `BENCH_VARIANTE`, reescreve os argumentos (`transformar.mjs`), registra cada chamada em `/tmp/bench-gosub/variantes.log` (argumentos originais, finais e detalhes) e faz `exec` de `/opt/homebrew/bin/claude` (stdin/stdout passam direto). Arquivos alterados (configurações, agentes, instruções) são cópias em `/tmp/bench-gosub/variantes/<carimbo>-<pid>/`; os originais do app não são tocados. Só chamadas com `-p`/`--print` são reescritas; `--version` e afins passam intactos.

## Como usar

```bash
# ao subir a instância isolada do app (BENCH_VARIANTE vale para todos os turnos dela):
CLAUDE_CODE_BIN="<esta pasta>/claude" BENCH_VARIANTE=v1 tsx src/root.ts   # + PORTA, PASTA_DADOS, PASTA_RAIZ_PROJETOS, ORQUESTRADOR_CHAVE_DE_ACESSO
```

`BENCH_VARIANTE`: `base` (ou vazia: repassa intacto), `v1`, `v2`, `v3`, `v5`, `vr`, nomes longos (`sem-peso-do-usuario`, `agents-enxutos`, `agrupar-chamadas`, `instrucoes-enxutas`, `recomendadas`) ou combinação com vírgula (`v1,v2`). Valor desconhecido: o script sai com código 2 (não roda nada). Opcionais: `BENCH_CLAUDE_REAL` (binário real), `BENCH_NODE`, `BENCH_LOG`.

Fumaça: `node variantes/fumaca.mjs base v1 v2 v3` (uma variante por vez: sobe a instância na porta 3317 com a variante, roda a T1, checa, mede, apaga orquestrador e pastas, derruba a instância; resultado em `variantes/fumaca/`).

## Variantes

| Variante | O que faz | Opções |
|---|---|---|
| V1 `sem-peso-do-usuario` | Tira os 10 plugins (e com eles skills, comandos, agentes e o hook SessionStart de plugin), todas as skills e slash commands, e os hooks do usuário. Login (OAuth) e CLAUDE.md do usuário, `~/.claude/rules` e CLAUDE.md do projeto ficam. | `--settings` com `enabledPlugins: {<id>: false}` para cada plugin conhecido (lista fixa da máquina + `~/.claude/settings.json` + `installed_plugins.json` + `plugins/synced`) e `disableAllHooks: true`; se o app já passa `--settings`, o JSON dele é mesclado numa cópia. Mais `--disable-slash-commands`. |
| V2 `agents-enxutos` | JSON do `--agents` só com o `executor` (descrição curta: "Executa uma subtarefa delegada e devolve o resultado."; prompt, tools, model e effort iguais) e nega os 6 agentes embutidos (`claude`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`, `web-fetch`), que somem da lista da ferramenta Agent. | Cópia do `agentes.json`; `Agent(<nome>)` acrescentado à lista do `--disallowedTools` do app. |
| V3 `agrupar-chamadas` | Acrescenta `v3-agrupar.txt` (agrupar buscas num comando que busca, filtra e corta; ler vários arquivos numa chamada) ao fim das instruções do Orquestrador e ao prompt do executor. | Cópia do arquivo do `--append-system-prompt-file` com o texto no fim; cópia do `--agents` com o texto no `prompt` do executor. |
| V5 `instrucoes-enxutas` | Igual à V3 com `v5-instrucoes.txt`. Sem o arquivo (ou vazio), não faz nada (fica registrado no log). | Idem V3. |
| VR `recomendadas` | V1 + V2 + V3 + V5. | |

## Fontes (documentação oficial, lida em 23/11/2026)

- `enabledPlugins` / `disableAllHooks` em `--settings`: https://code.claude.com/docs/en/settings-reference. "`disableAllHooks`: Turn off hooks, a custom status line, and a custom `@` file suggestion command at once"; "`enabledPlugins`: Turn individual plugins on or off per scope". `--settings` (https://code.claude.com/docs/en/cli-reference): "Values you set here override the same keys in your settings.json files for this session".
- `--disable-slash-commands` (cli-reference): "Disable all skills and commands for this session". Leva junto a ferramenta `Skill` (some do init).
- `Agent(<nome>)` em `--disallowedTools` (https://code.claude.com/docs/en/sub-agents, "Disable specific subagents"): "Use the format `Agent(subagent-name)` ... This works for both built-in and custom subagents. You can also use the `--disallowedTools` CLI flag".
- `--append-system-prompt-file` (cli-reference): "Load additional system prompt text from a file and append to the default prompt". `--agents` aceita caminho de arquivo com `--print` desde a v2.1.281.

## Opções descartadas (e por quê)

- `--bare` (https://code.claude.com/docs/en/headless, "Start faster with bare mode"): pula hooks, skills, comandos, subagentes, plugins, MCP, auto memory e CLAUDE.md, e "In bare mode, Claude Code never reads OAuth credentials or the system keychain". Perde o login da assinatura e o CLAUDE.md, e tira lembretes do sistema e tarefas em segundo plano.
- `--safe-mode` (cli-reference): "CLAUDE.md, skills, plugins, hooks, MCP servers, custom commands and agents ... do not load. Authentication ... work normally". Mantém o login, mas perde todo CLAUDE.md (usuário e projeto) e possivelmente o `--agents`; exigiria reinjetar o CLAUDE.md à mão. Desnecessário, porque a V1 preserva tudo.
- `--setting-sources` sem `user`: tira o `enabledPlugins` e os hooks do usuário, mas também o resto do `~/.claude/settings.json` (env, permissões, modelo) e, pela página de memória, regras e CLAUDE.md ficam amarrados às fontes (`project` excluído pula as regras do projeto). Muda demais o ambiente.
- `--restricted`: tira Bash e outras ferramentas e recusa permissões; inviável para as tarefas.
- `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`: o contrário do que se quer. `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1`: coberto pelo `--disable-slash-commands`.
- Code Mode (`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1`, https://code.claude.com/docs/en/code-mode): requer v2.1.323+ (a instalada é 2.1.322) e "Surface: an interactive `claude` session in a terminal". Não vale para `-p` nem para o app. Sonda com a variável ligada em `-p`: nenhuma ferramenta `REPL` no init.

## Sondas (claude 2.1.322, `-p`, sonnet, `--max-turns 1`, em /tmp, ambiente limpo)

| Sonda | Plugins | Skills | Slash | Hooks no início | 1a chamada (tokens de entrada) | CLAUDE.md usuário / projeto / rules | US$ |
|---|---|---|---|---|---|---|---|
| s1 base | 10 | 59 | 99 | 2 eventos | 28.107 | sim / sim / sim | 0,0688 |
| s2 V1 (`enabledPlugins` falso + `disableAllHooks` + `--disable-slash-commands`) | 0 | 0 | 0 | 0 | 23.373 | sim / sim / sim | 0,0287 |
| s3 V1 + `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1` | 0 | | | | sem `REPL` | | 0,0196 |
| s4 V1 + `--disallowedTools Agent(...)` dos 6 embutidos | 0 | 0 | 0 | 0 | 22.216 (−1.157) | sim / sim / sim | 0,0056 |

Login: `apiKeySource: none` (OAuth da assinatura) em todas. O init continua listando os agentes embutidos mesmo negados, mas a primeira chamada encolhe.

## Fumaça (T1, app 45b1b81 na porta 3317, config C, 23/11 12:47 a 12:51)

| Variante | Checador | 1a chamada do Orquestrador | 1a chamada do executor | Índice | US$ | Subagentes | Observação |
|---|---|---|---|---|---|---|---|
| base | passou | 28.348 | 20.230 | 99.305 | 0,2249 | 1 | hook SessionStart e lista de skills presentes |
| V1 | passou | 17.351 (−39%) | 10.857 (−46%) | 71.575 | 0,1616 | 1 | sem hook, sem skill_listing, sem "superpowers"; CLAUDE.md e rules presentes |
| V2 | passou | 27.624 (−724) | 20.283 | 93.585 | 0,2116 | 1 | descrição curta chegou; embutidos negados |
| V3 | passou | 28.579 (+231) | | 47.877 | 0,1177 | 0 | texto extra no prompt do Orquestrador (snapshot) e no agentes.json; o Orquestrador fez sozinho (uma execução só, não conclui nada) |

Antes da V2 e da V3 a carga estava em 6,35 e 6,8: esperou 30 s em cada (registrado em `fumaca/*.json`, campo `carga`).
