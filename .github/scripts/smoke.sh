#!/usr/bin/env bash
# Smoke tests do staging: a imagem sobe, responde e protege o que é privado.
# Uso: smoke.sh <base-url>
set -euo pipefail

BASE="${1:?uso: smoke.sh <base-url>}"
falhas=0

# status <descrição> <caminho> <códigos aceitos, separados por |>
status() {
  local codigo
  codigo=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$2")
  if [[ "|$3|" == *"|$codigo|"* ]]; then
    echo "ok   $1 ($2 → $codigo)"
  else
    echo "::error::$1: $2 respondeu $codigo, esperado $3"
    falhas=$((falhas + 1))
  fi
}

status "health responde com o banco" /api/health 200
status "tela de login renderiza" /sign-in 200
# Sem sessão, rota privada não pode responder 200 com conteúdo: ou redireciona
# para o login, ou nega.
status "Cosmos exige sessão" /cosmos "302|303|307|308|401|403"
status "API privada exige sessão" /api/platform/health "302|303|307|308|401|403"

# Os headers de segurança vêm do middleware (nosecone): se sumirem, o ZAP
# acusa depois, mas aqui a falha é imediata e aponta a causa.
headers=$(curl -s -D - -o /dev/null "$BASE/sign-in")
for h in x-content-type-options x-frame-options referrer-policy; do
  if grep -qi "^$h:" <<<"$headers"; then
    echo "ok   header $h presente"
  else
    echo "::error::header de segurança $h ausente em /sign-in"
    falhas=$((falhas + 1))
  fi
done

if (( falhas > 0 )); then
  echo "$falhas verificação(ões) falharam"
  exit 1
fi
echo "smoke: tudo ok"
