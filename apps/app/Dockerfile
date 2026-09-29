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
# O `next build` estoura o heap padrão (~2 GB) no type check do apps/app — o
# mesmo motivo do NODE_OPTIONS no job Build do ci.yml.
ENV NODE_OPTIONS=--max-old-space-size=6144

# Placeholders de build, não segredos — mesma política do job Build do ci.yml.
# `prisma generate` valida DATABASE_URL sem conectar; `packages/auth/server.ts`
# valida o segredo no import, e o "Collecting page data" importa a rota de
# auth. Nada disso vai para o estágio `runner`: os valores reais entram em
# runtime, por variável de ambiente do container.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ARG BETTER_AUTH_SECRET=docker-build-placeholder-nao-e-segredo-0123456789
# As `NEXT_PUBLIC_*` são inlinadas no bundle pelo Next — é a exceção conhecida
# ao "mesmo artefato em todo ambiente". O pipeline passa as URLs reais por
# --build-arg; sem elas, `.invalid` (RFC 2606) garante que nada saia para a
# rede de ninguém.
ARG NEXT_PUBLIC_APP_URL=https://app.placeholder.invalid
ARG NEXT_PUBLIC_WEB_URL=https://web.placeholder.invalid
ARG NEXT_PUBLIC_POSTHOG_KEY=phc_docker_build_placeholder
ARG NEXT_PUBLIC_POSTHOG_HOST=https://posthog.placeholder.invalid
ENV DATABASE_URL=${DATABASE_URL} \
    BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL} \
    NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY} \
    NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}

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

# Client do Prisma gerado. As migrations NÃO rodam aqui: a imagem não leva o
# CLI do Prisma, e o Prisma 7 exige o prisma.config.ts com a datasource. Quem
# migra é o pipeline, antes de subir o container (job `staging` do
# pipeline.yml). Os COPY de `node_modules/.prisma` que ficavam aqui apontavam
# para caminhos que o Prisma 7 não gera mais e quebravam o build da imagem.
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/generated ./packages/database/generated

# Startup script
COPY --chown=nextjs:nodejs apps/app/scripts/docker-start.sh /app/docker-start.sh
RUN chmod +x /app/docker-start.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["/app/docker-start.sh"]
