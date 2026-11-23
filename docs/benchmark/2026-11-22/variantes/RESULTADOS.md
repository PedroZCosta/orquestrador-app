# Resultados das variantes de corte de tokens (config C, 23/11/2026)

App 45b1b81 na instância isolada (porta 3317), configuração padrão de criação (Sonnet 5.5, esforço médio, até 3 subagentes) com `edicao_e_comandos`, as mesmas 4 tarefas, o mesmo checador e o mesmo medidor (`scripts/medir.ts`) da linha de base de 22/11. 3 execuções por tarefa e por variante (60 no total), em sequência, das 12:56 às 13:55 (-03). Cada variante subiu a sua própria instância (`BENCH_VARIANTE`, `CLAUDE_CODE_BIN=variantes/claude`), derrubada ao fim. Todas as execuções têm no JSON as chamadas do intermediário com a variante aplicada (`chamadasDoIntermediario`).

Dados completos: `../resumo-variantes.json` (gerado por `scripts/analisar-variantes.mjs`); execuções em `../execucoes-variantes/<variante>/`.

## Soma das médias das 4 tarefas

Só execuções que passaram no checador. Primeira chamada = tokens de entrada (entrada + criação + leitura de cache) da primeira resposta, média entre as tarefas. Tokens totais = entrada + criação de cache + leitura de cache + saída.

| Variante | US$ | Índice | Tokens totais | Tempo (s) | Válidas | US$ vs C base | US$ vs B | US$ vs A | Índice vs C base | Tempo vs C base |
|---|---|---|---|---|---|---|---|---|---|---|
| A (base, Opus) | 2,6544 | 598.251 | 1.840.641 | 422,8 | 12/12 | | | | | |
| B (base, Sonnet puro) | 0,7795 | 331.993 | 959.948 | 159,9 | 12/12 | | | | | |
| C (base, app) | 1,0727 | 503.680 | 1.429.622 | 181,7 | 12/12 | | | | | |
| V1 sem peso do usuário | 0,7115 | 335.784 | 837.456 | 149,5 | 12/12 | −33,7% | −8,7% | −73,2% | −33,3% | −17,7% |
| V2 agents enxutos | 1,0708 | 509.212 | 1.441.865 | 183,2 | 12/12 | −0,2% | +37,4% | −59,7% | +1,1% | +0,8% |
| V3 agrupar chamadas | 0,9726 | 447.842 | 1.234.070 | 159,7 | 12/12 | −9,3% | +24,8% | −63,4% | −11,1% | −12,1% |
| V5 instruções enxutas | 0,8644 | 393.594 | 953.831 | 134,2 | 12/12 | −19,4% | +10,9% | −67,4% | −21,9% | −26,1% |
| **VR (V1+V2+V3+V5)** | **0,5836** | **274.619** | **688.158** | **119,3** | 12/12 | **−45,6%** | **−25,1%** | **−78,0%** | −45,5% | −34,3% |

### Tokens por tipo, primeira chamada e chamadas

| Variante | Entrada | Criação de cache | Leitura de cache | Saída | 1a chamada Orquestrador | 1a chamada executor | Chamadas ao modelo | Chamadas de ferramenta | Subagentes |
|---|---|---|---|---|---|---|---|---|---|
| C base | 90 | 204.309 | 1.199.574 | 25.649 | 28.512 | 20.936 | 42,3 | 64,7 | 2,67 |
| V1 | 85 | 124.254 | 690.858 | 22.259 | 17.519 | 11.304 | 39,7 | 47,3 | 3,00 |
| V2 | 96 | 205.119 | 1.210.312 | 26.337 | 27.803 | 20.814 | 44,7 | 68,0 | 3,33 |
| V3 | 82 | 188.953 | 1.023.185 | 21.850 | 28.733 | 21.100 | 38,3 | 35,7 | 2,67 |
| V5 | 69 | 179.486 | 755.553 | 18.722 | 28.822 | 20.693 | 31,7 | 53,7 | 3,00 |
| VR | 78 | 106.837 | 564.331 | 16.912 | 17.329 | 11.425 | 36,0 | 31,3 | 3,00 |

Contra B no índice: V1 +1,1%, V2 +53,4%, V3 +34,9%, V5 +18,6%, VR −17,3%. Contra B no tempo: VR −25,4%, V5 −16,1%, V1 −6,5%.

## Por tarefa (US$ médio; % contra C base)

| Tarefa | C base | V1 | V2 | V3 | V5 | VR |
|---|---|---|---|---|---|---|
| T1 correção pequena | 0,167 | 0,112 (−33%) | 0,186 (+11%) | 0,174 (+4%) | 0,163 (−3%) | 0,107 (−36%) |
| T2 feature | 0,447 | 0,277 (−38%) | 0,449 (0%) | 0,375 (−16%) | 0,306 (−32%) | 0,193 (−57%) |
| T3 refatoração | 0,282 | 0,194 (−31%) | 0,267 (−5%) | 0,246 (−12%) | 0,215 (−24%) | 0,165 (−41%) |
| T4 investigação | 0,177 | 0,128 (−28%) | 0,170 (−4%) | 0,177 (0%) | 0,181 (+2%) | 0,119 (−33%) |

- V1 ganha em todas (−28% a −38%), por cortar ~11 mil tokens do prefixo de cada sessão (Orquestrador e executor).
- V2 não muda nada fora do ruído; na T1 perdeu 11%.
- V3 e V5 ganham onde há trabalho de leitura e edição (T2 e T3) e empatam na T1 e na T4, que são curtas e quase só do Orquestrador. A V5 é a que mais reduz a leitura de cache (menos chamadas ao modelo: 31,7 contra 42,3).
- VR é a melhor em todas as tarefas e a única abaixo da B em todas; na T2 cai 57% e fica 30% abaixo da B.

## Qualidade, erros e carga

- Falhas no checador: nenhuma (60/60 válidas).
- Erros de API (529/500) e repetições: nenhum.
- Carga alta (1 min > 6): uma marca, VR r3-T4 (1,8 antes, 8,5 depois); nenhuma espera foi necessária antes das execuções. Maior carga lida: 8,5.
- Custo gasto (equivalente de API, todas as execuções): V1 US$ 2,14; V2 3,21; V3 2,92; V5 2,59; VR 1,75; total US$ 12,61. Cota da assinatura (janela de 7 dias, contaminada por outros orquestradores): 2% no início, 4% no fim.

## Reproduzir

```bash
cd docs/benchmark/2026-11-22
nohup bash scripts/rodar-variantes.sh v1 v2 v3 v5 vr > /tmp/bench-gosub/rodada-todas.log 2>&1 &
# uma só: node scripts/harness.mjs --variante v1   (retomável; pula quem tem JSON em execucoes-variantes/v1/)
node scripts/analisar-variantes.mjs   # regrava resumo-variantes.json
```

Requer a instância preparada em `/tmp/bench-gosub` (ver DECISOES.md, "Instância isolada") e a porta 3317 livre.
