#!/bin/bash
# Roda as variantes em sequência (uma instância do app por variante), cada uma com 3 rodadas × T1..T4 na config C.
# Uso: nohup bash scripts/rodar-variantes.sh [v1 v2 v3 v5 vr] > /tmp/bench-gosub/rodada-todas.log 2>&1 &
# Retomável: rodar de novo pula execuções que já têm JSON em execucoes-variantes/<variante>/.
cd "$(dirname "$0")/.." || exit 1
NODE="$(command -v node || echo /Users/pedro/.nvm/versions/node/v22.21.0/bin/node)"
LISTA=("$@"); [ ${#LISTA[@]} -eq 0 ] && LISTA=(v1 v2 v3 v5 vr)
echo "$$" > /tmp/bench-gosub/rodar-variantes.pid
for v in "${LISTA[@]}"; do
  echo "$(date -u +%FT%TZ) iniciando $v"
  "$NODE" scripts/harness.mjs --variante "$v" > "/tmp/bench-gosub/rodada-$v.log" 2>&1
  echo "$(date -u +%FT%TZ) fim de $v (código $?)"
done
"$NODE" scripts/analisar-variantes.mjs > /tmp/bench-gosub/analise-variantes.log 2>&1
echo "$(date -u +%FT%TZ) TODAS CONCLUÍDAS"
rm -f /tmp/bench-gosub/rodar-variantes.pid
