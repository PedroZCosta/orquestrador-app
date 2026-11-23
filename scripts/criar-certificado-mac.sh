#!/bin/bash
# Cria, uma única vez, a identidade de assinatura de código "Go SubAgents Local"
# no chaveiro login: certificado autoassinado (uso estendido codeSigning, 10 anos)
# marcado como confiável para assinatura de código.
#
# Por quê: assinado "ad hoc", o requisito do app vira o cdhash, que muda a cada
# build, e o macOS esquece as permissões (Gravação de Tela, Microfone, Acesso
# Total ao Disco) a cada atualização. Assinado sempre com o mesmo certificado, o
# requisito vira "certificate leaf = H..." e fica igual entre builds.
#
# Idempotente: se a identidade já existir e for válida, só avisa.
# Rode no Terminal: bash scripts/criar-certificado-mac.sh

set -euo pipefail

NOME="Go SubAgents Local"
CHAVEIRO="$HOME/Library/Keychains/login.keychain-db"
# LibreSSL do sistema: gera um .p12 que o "security import" aceita (o OpenSSL 3
# ou mais novo usa uma cifra que o chaveiro do macOS não lê sem -legacy).
OPENSSL="/usr/bin/openssl"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Este script é só para macOS."
  exit 1
fi

identidade_valida() {
  security find-identity -v -p codesigning "$CHAVEIRO" 2>/dev/null | grep -qF "\"$NOME\""
}

if identidade_valida; then
  echo "A identidade \"$NOME\" já existe e é válida para assinar código. Nada a fazer."
  security find-identity -v -p codesigning "$CHAVEIRO" | grep -F "\"$NOME\""
  exit 0
fi

TEMP="$(mktemp -d "${TMPDIR:-/tmp}/certificado-mac.XXXXXX")"
trap 'rm -rf "$TEMP"' EXIT
chmod 700 "$TEMP"

echo "Vou criar o certificado \"$NOME\" no chaveiro login."
echo "O macOS vai pedir a senha do Mac (ou do chaveiro) uma ou duas vezes:"
echo "  1. para marcar o certificado como confiável para assinatura de código (janela do sistema);"
echo "  2. para liberar o codesign a usar a chave sem perguntar a cada build (aqui no Terminal)."
echo "A senha vai direto para o macOS; este script não a lê nem a guarda."
echo

if security find-certificate -c "$NOME" "$CHAVEIRO" >/dev/null 2>&1; then
  # Já foi importado antes, mas não ficou confiável: só refaz a confiança.
  echo "O certificado já está no chaveiro, mas ainda não é confiável. Marcando como confiável..."
  security find-certificate -c "$NOME" -p "$CHAVEIRO" > "$TEMP/certificado.pem"
else
  cat > "$TEMP/openssl.cnf" <<EOF
[ req ]
distinguished_name = nome
prompt = no
x509_extensions = assinatura

[ nome ]
CN = $NOME

[ assinatura ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
subjectKeyIdentifier = hash
EOF

  echo "Gerando a chave e o certificado (validade de 10 anos)..."
  "$OPENSSL" req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 \
    -config "$TEMP/openssl.cnf" \
    -keyout "$TEMP/chave.pem" -out "$TEMP/certificado.pem" 2>/dev/null

  # Senha só do arquivo .p12 temporário, gerada aqui e descartada no fim.
  SENHA_P12="$("$OPENSSL" rand -hex 16)"
  export SENHA_P12
  "$OPENSSL" pkcs12 -export -name "$NOME" \
    -inkey "$TEMP/chave.pem" -in "$TEMP/certificado.pem" \
    -out "$TEMP/identidade.p12" -passout env:SENHA_P12

  echo "Importando no chaveiro login (liberado para o /usr/bin/codesign)..."
  security import "$TEMP/identidade.p12" -k "$CHAVEIRO" -f pkcs12 \
    -P "$SENHA_P12" -T /usr/bin/codesign >/dev/null
  unset SENHA_P12

  echo "Liberando o codesign a usar a chave sem abrir janela a cada build..."
  echo "(se pedir, digite a senha do chaveiro login, que costuma ser a senha do Mac)"
  if ! security set-key-partition-list -S apple-tool:,apple: -s -l "$NOME" "$CHAVEIRO" >/dev/null; then
    echo "Aviso: não consegui liberar a chave para o codesign. Na primeira assinatura o macOS"
    echo "pode perguntar se o codesign pode usar a chave: responda \"Sempre Permitir\"."
  fi
fi

echo "Marcando o certificado como confiável para assinatura de código..."
security add-trusted-cert -r trustRoot -p codeSign -k "$CHAVEIRO" "$TEMP/certificado.pem"

echo
if identidade_valida; then
  echo "Pronto. Identidade de assinatura disponível:"
  security find-identity -v -p codesigning "$CHAVEIRO" | grep -F "\"$NOME\""
  echo
  echo "Próximos passos (uma única vez):"
  echo "  1. Gere o app de novo (npm run dist:mac ou atualizar-app-mac.command)."
  echo "  2. Em Ajustes do Sistema > Privacidade e Segurança, remova o app (botão \"-\") e"
  echo "     adicione de novo em Gravação de Tela, Microfone e Acesso Total ao Disco."
  echo "Depois disso as permissões continuam valendo nas próximas atualizações."
else
  echo "O certificado foi criado, mas não aparece como identidade válida em:"
  echo "  security find-identity -v -p codesigning"
  echo "Abra o Acesso às Chaves, procure \"$NOME\" e confira se a confiança para"
  echo "\"Assinatura de Código\" está como \"Sempre Confiar\"."
  exit 1
fi
