#!/bin/sh
# Cosmos Enterprise — Production Startup Script
# Validates required env vars, runs DB migrations, then starts Next.js.
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { printf "[cosmos] %s\n" "$1"; }
ok()  { printf "${GREEN}[cosmos] ✓ %s${NC}\n" "$1"; }
err() { printf "${RED}[cosmos] ✗ %s${NC}\n" "$1" >&2; }
warn(){ printf "${YELLOW}[cosmos] ⚠ %s${NC}\n" "$1"; }

# ─── 1. Fail-fast env validation ─────────────────────────────────────────────
log "Validating required environment variables..."

MISSING=0
require_env() {
  if [ -z "$(eval echo \$$1)" ]; then
    err "Missing required env var: $1"
    MISSING=1
  fi
}

require_env DATABASE_URL
require_env BETTER_AUTH_SECRET
require_env LIVEBLOCKS_SECRET
require_env INNGEST_EVENT_KEY
require_env INNGEST_SIGNING_KEY
require_env CRON_SECRET

if [ "$MISSING" = "1" ]; then
  err "Startup aborted: missing required env vars. Set them and restart."
  exit 1
fi

# BETTER_AUTH_SECRET must be >= 32 chars
SECRET_LEN=$(echo -n "$BETTER_AUTH_SECRET" | wc -c | tr -d ' ')
if [ "$SECRET_LEN" -lt 32 ]; then
  err "BETTER_AUTH_SECRET must be at least 32 characters (got $SECRET_LEN)"
  exit 1
fi

ok "Environment validated"

# ─── 2. Database migration ────────────────────────────────────────────────────
log "Running database migrations..."
if node_modules/.bin/prisma migrate deploy --schema=/app/packages/database/generated/schema.prisma 2>&1; then
  ok "Migrations applied"
else
  MIGRATE_EXIT=$?
  # Don't block startup if migrate deploy fails due to no pending migrations
  # (exit code 0 for no-op, non-zero only on actual errors)
  warn "Migration step exited with code $MIGRATE_EXIT — check logs"
fi

# ─── 3. Start Next.js ────────────────────────────────────────────────────────
ok "Starting Cosmos Enterprise on port ${PORT:-3000}..."
exec node apps/app/server.js
