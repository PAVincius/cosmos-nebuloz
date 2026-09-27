#!/usr/bin/env bash
# Testes de integração contra Postgres, Qdrant, Neo4j e MinIO reais (os do docker compose).
# Usam tenants temporários e os purgam no fim: a memória do tenant "nebuloz" não é tocada.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Falta o .env: rode pnpm memoria:up antes." >&2; exit 1; }
docker compose up -d postgres qdrant neo4j minio >/dev/null
until docker compose ps neo4j | grep -q healthy; do sleep 3; done
set -a && . ./.env && set +a
cd servico
[ -x .venv/bin/pytest ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements-dev.txt; }
export STEC_ADMIN_DATABASE_URL="postgresql://stec_admin:$POSTGRES_PASSWORD@127.0.0.1:5433/memoria" \
  STEC_DATABASE_URL="postgresql://stec_app:$STEC_APP_DB_PASSWORD@127.0.0.1:5433/memoria" \
  STEC_APP_DB_PASSWORD="$STEC_APP_DB_PASSWORD" \
  STEC_QDRANT_URL=http://127.0.0.1:6333 \
  STEC_NEO4J_URL=bolt://127.0.0.1:7687 STEC_NEO4J_PASSWORD="$NEO4J_PASSWORD" \
  STEC_MINIO_ENDPOINT=127.0.0.1:9000 STEC_MINIO_ACCESS_KEY="$MINIO_ROOT_USER" STEC_MINIO_SECRET_KEY="$MINIO_ROOT_PASSWORD"
exec .venv/bin/pytest "$@"
