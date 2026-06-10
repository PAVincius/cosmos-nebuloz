# Cosmos Enterprise App — Production Dockerfile
#
# Multi-stage build: deps → builder → runner
# Build from monorepo root:
#   DOCKER_BUILDKIT=1 docker build \
#     --build-arg DOCKER_BUILD=true \
#     -f apps/app/Dockerfile \
#     -t cosmos-app:latest .

FROM node:22-slim AS base

RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

WORKDIR /app

# ─── Stage 1: install dependencies ───────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/app/package.json ./apps/app/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile --ignore-scripts

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM base AS builder

ARG SKIP_ENV_VALIDATION=true
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}
ENV DOCKER_BUILD=true
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/app/node_modules ./apps/app/node_modules

# Copy source
COPY . .
# Restore packages/node_modules after COPY . .
COPY --from=deps /app/packages ./packages

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build the app (standalone output)
WORKDIR /app/apps/app
RUN pnpm build

# ─── Stage 3: production runner ───────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/static ./apps/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/public ./apps/app/public

# Copy Prisma schema + client + migrations for runtime migration
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/generated ./packages/database/generated
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/prisma.config.ts ./packages/database/
COPY --from=builder /app/packages/database/node_modules/.prisma ./packages/database/node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Startup script
COPY --chown=nextjs:nodejs apps/app/scripts/docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["/app/docker-start.sh"]
