#!/usr/bin/env bash
# Sobe a memória dos agentes. Idempotente: pode rodar de novo.
#   1. gera o .env com senhas aleatórias, na primeira vez;
#   2. sobe Postgres, Qdrant, Neo4j, MinIO e o serviço;
#   3. cria o tenant "nebuloz" e a chave do Maestri (guardada em ~/.nebuloz/memoria, fora do repo);
#   4. importa lições do Maestri, ADRs e registro de decisões.
# Ligar ao Claude Code é um passo seu, uma vez: o comando aparece no fim (README, "Ligar aos agentes").
# Variáveis: MEMORIA_PORTA (8003), MEMORIA_HOME (~/.nebuloz/memoria), MEMORIA_SEM_BUILD=1.
set -euo pipefail
cd "$(dirname "$0")/.."

PORTA="${MEMORIA_PORTA:-8003}"
URL="http://127.0.0.1:$PORTA"
CASA="${MEMORIA_HOME:-$HOME/.nebuloz/memoria}"
CABECALHOS="$CASA/cabecalhos.json"
TENANT=nebuloz

command -v docker >/dev/null || { echo "Docker não encontrado. Abra o Docker Desktop e rode de novo." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "O Docker não está rodando. Abra o Docker Desktop e rode de novo." >&2; exit 1; }

if [ ! -f .env ]; then
  senha() { openssl rand -hex 24; }
  umask 077
  cat > .env <<EOF
POSTGRES_PASSWORD=$(senha)
STEC_APP_DB_PASSWORD=$(senha)
NEO4J_PASSWORD=$(senha)
MINIO_ROOT_USER=memoria
MINIO_ROOT_PASSWORD=$(senha)
STEC_EMBEDDING_PROVIDER=hash
EOF
  umask 022
  echo "• .env criado com senhas aleatórias"
fi

if [ "${MEMORIA_SEM_BUILD:-}" = 1 ]; then
  docker compose up -d --no-build
else
  docker compose up -d --build
fi

printf "• esperando o serviço em %s " "$URL"
for _ in $(seq 1 90); do
  curl -fsS "$URL/health" >/dev/null 2>&1 && break
  printf "."
  sleep 2
done
echo
curl -fsS "$URL/health" >/dev/null || { echo "O serviço não respondeu. Veja: docker compose logs memoria" >&2; exit 1; }

cli() { docker compose exec -T memoria python -m app.cli "$@"; }
cli criar-tenant "$TENANT" "Nebuloz" >/dev/null

mkdir -p "$CASA" && chmod 700 "$CASA"
chave_ok() {
  [ -s "$CABECALHOS" ] || return 1
  local chave
  chave="$(sed -n 's/.*"X-API-Key": *"\([^"]*\)".*/\1/p' "$CABECALHOS")"
  [ -n "$chave" ] && curl -fsS -o /dev/null -H "X-API-Key: $chave" "$URL/api/v1/memories?limit=1"
}
if chave_ok; then
  echo "• chave do Maestri já existe e vale ($CABECALHOS)"
else
  chave="$(cli criar-chave "$TENANT" maestri escrita 2>/dev/null | head -n1)"
  (umask 077 && printf '{"X-API-Key": "%s"}\n' "$chave" > "$CABECALHOS")
  unset chave
  echo "• chave nova do Maestri em $CABECALHOS (só você lê)"
fi

echo "• importando lições do Maestri, ADRs e registro de decisões"
cli importar "$TENANT" --raiz /fontes

cat <<EOF

Memória no ar: $URL/health · API em $URL/docs · MCP em $URL/mcp

Para os agentes enxergarem, uma vez por máquina (vale para todas as pastas de papel do Maestri):
  claude mcp add-json --scope user memoria '{"type":"http","url":"$URL/mcp","headersHelper":"cat $CABECALHOS"}'
EOF
