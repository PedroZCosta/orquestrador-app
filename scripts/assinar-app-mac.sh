#!/bin/bash
# Assina o .app do Mac gerado pelo dist:mac.
#
# Com a identidade "Go SubAgents Local" no chaveiro (criada uma vez por
# scripts/criar-certificado-mac.sh), o requisito designado vira
# "certificate leaf = H..." e fica igual entre builds: o macOS mantém as
# permissões (Gravação de Tela, Microfone, Acesso Total ao Disco).
# Sem ela, assina "ad hoc" como antes e avisa que as permissões vão cair.
#
# Uso: bash scripts/assinar-app-mac.sh "caminho/do/App.app"

set -euo pipefail

NOME="Go SubAgents Local"
APP="${1:-}"

if [ -z "$APP" ] || [ ! -d "$APP" ]; then
  echo "Uso: bash scripts/assinar-app-mac.sh \"caminho/do/App.app\""
  echo "Não achei o app: ${APP:-(nenhum caminho informado)}"
  exit 1
fi

# Assina pelo hash SHA-1 da identidade: evita erro de nome ambíguo se houver
# mais de um certificado com o mesmo nome no chaveiro.
HASH="$(security find-identity -v -p codesigning 2>/dev/null \
  | awk -v nome="\"$NOME\"" 'index($0, nome) { print $2; exit }')"

if [ -n "$HASH" ]; then
  echo "Assinando com o certificado \"$NOME\" ($HASH)..."
  codesign --force --deep --timestamp=none --sign "$HASH" "$APP"
else
  echo
  echo "AVISO: a identidade de assinatura \"$NOME\" não existe neste Mac."
  echo "O app vai ser assinado \"ad hoc\", e o macOS vai esquecer as permissões dele"
  echo "nesta atualização (Gravação de Tela, Microfone e Acesso Total ao Disco)."
  echo "Para isso não acontecer mais, rode uma única vez no Terminal:"
  echo "  bash scripts/criar-certificado-mac.sh"
  echo
  codesign --force --deep --sign - "$APP"
fi

if ! codesign --verify --deep "$APP" 2>&1; then
  echo "Aviso: a verificação da assinatura (codesign --verify) apontou problema."
fi

echo "Requisito designado (o macOS usa para reconhecer o app nas permissões):"
codesign -dr - "$APP" 2>&1
