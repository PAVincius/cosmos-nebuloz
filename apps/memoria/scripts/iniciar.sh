#!/usr/bin/env bash
# Sobe a memória dos agentes. Idempotente: pode rodar de novo.
#   1. gera o .env com senhas aleatórias, na primeira vez;
#   2. sobe Postgres, Qdrant, Neo4j, MinIO e o serviço;
#   3. cria o tenant "nebuloz", uma chave por papel do Maestri e a chave geral (em ~/.nebuloz/memoria, fora do repo);
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
# Projeções opcionais: vetor (Qdrant), grafo (Neo4j), arquivo (MinIO). Vazio = só Postgres.
COMPOSE_PROFILES=
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

cli() { docker compose exec -T memoria python -m app.cli "$@" </dev/null; }
cli criar-tenant "$TENANT" "Nebuloz" >/dev/null

mkdir -p "$CASA/chaves" && chmod 700 "$CASA" "$CASA/chaves"
chave_ok() { # $1=arquivo
  [ -s "$1" ] || return 1
  local chave
  chave="$(sed -n 's/.*"X-API-Key": *"\([^"]*\)".*/\1/p' "$1")"
  [ -n "$chave" ] && curl -fsS -o /dev/null -H "X-API-Key: $chave" "$URL/api/v1/memories?limit=1"
}
garantir_chave() { # $1=arquivo $2=rótulo (vira o agente de toda memória gravada com a chave)
  chave_ok "$1" && return 1
  local chave
  chave="$(cli criar-chave "$TENANT" "$2" escrita 2>/dev/null | head -n1)"
  (umask 077 && printf '{"X-API-Key": "%s"}\n' "$chave" > "$1")
}
# Chave geral: sessões fora de uma pasta de papel (o terminal Maestro, uma sessão avulsa no repo).
garantir_chave "$CABECALHOS" maestri && echo "• chave geral nova em $CABECALHOS"

# Uma chave por papel do Maestri, lida do setup do canvas: `hire "Crivo" "QA"` → chaves/qa.json, rótulo Crivo.
novas=0
while read -r agente papel; do
  slug=$(printf '%s' "$papel" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  garantir_chave "$CASA/chaves/$slug.json" "$agente" && novas=$((novas + 1))
done < <(grep -oE '(hire|recruit) "[A-Za-z]+" +(--role +)?"[^"]+"' ../../.maestri/setup-canvas.sh \
  | sed -E 's/^(hire|recruit) "([A-Za-z]+)" +(--role +)?"([^"]+)"$/\2 \4/' | sort -u)
echo "• chaves por papel em $CASA/chaves: $(ls "$CASA/chaves" | wc -l | tr -d ' ') ($novas nova(s))"

# O Claude Code chama este script a cada conexão; ele escolhe a chave pela pasta do papel.
install -m 700 scripts/cabecalho.sh "$CASA/cabecalho.sh"

echo "• importando lições do Maestri, ADRs e registro de decisões"
cli importar "$TENANT" --raiz /fontes

# Projeção ligada depois de haver memória nasce vazia: refaz a partir do Postgres (idempotente).
perfis="$(sed -n 's/^COMPOSE_PROFILES=//p' .env | tail -n1)"
perfis="${COMPOSE_PROFILES:-$perfis}"
if [ -n "$perfis" ]; then
  echo "• refazendo projeções ligadas ($perfis)"
  cli reconstruir "$TENANT"
fi

cat <<EOF

Memória no ar: $URL/health · API em $URL/docs · MCP em $URL/mcp

Para os agentes enxergarem: rode o setup do Maestri de novo (.maestri/setup-canvas.sh), que registra o MCP. Ou, à mão:
  claude mcp add-json --scope user memoria '{"type":"http","url":"$URL/mcp","headersHelper":"sh $CASA/cabecalho.sh"}'
EOF
