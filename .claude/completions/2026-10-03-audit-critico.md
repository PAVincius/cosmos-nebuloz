# Auditoria de dependências no main

**Branch:** `fix/pnpm-audit-critico` · **Data:** 2026-10-03

## O que foi pedido vs. o que o CI mostra
`pnpm audit --audit-level=critical` **passa** (0 críticas; 42 low · 213 moderate · 149 high; exit 0), no CI de `fc269701` e hoje. O job "Security Vulnerability Scan" fica vermelho no passo seguinte, `pnpm audit:runtime` (ci.yml, "no new highs"): `altas em runtime: 14 · baseline: 13`, a nova era `@grpc/grpc-js` via `apps/app>inngest`.

## Corrigido (patch seguro)
- `@grpc/grpc-js` 1.14.4 → 1.14.5 (GHSA-m9gg-hp2v-232j, alta; GHSA-f596-whhp-79r4, baixa). Caminho: `apps/app>inngest>@opentelemetry/auto-instrumentations-node>@opentelemetry/sdk-node>@opentelemetry/exporter-*-otlp-grpc>@grpc/grpc-js`. Os exporters fixam a versão no lock, não no `package.json`; entrou `pnpm.overrides."@grpc/grpc-js": "^1.14.5"` (um `pnpm update --depth Infinity` mexeu em 1,8 mil linhas do lock, por isso não).

## Pendente de decisão
`@fastify/busboy` 2.1.1 — GHSA-x8mw-p69m-v3mx / CVE-2026-19481, alta (DoS por cabeçalho de parte multipart com nome de protótipo), publicada em 02/10 23:16Z, depois do último CI. Corrigida em ≥ 3.2.1.
Caminho: `apps/web>@arcjet/next>@arcjet/transport>@connectrpc/connect-node>undici>@fastify/busboy` (undici 5 exige `@fastify/busboy@^2`). Sai com `@arcjet/next` 1.0.0-beta.15 → 1.14.0 (`apps/web` e `packages/security`, ambos fixos em beta.15): salto de beta para estável, não é patch/minor, e é o middleware de segurança. Enquanto isso `pnpm audit:runtime` continua falhando com 1 alta nova.

## Verificação
`pnpm audit --audit-level=critical` → exit 0. `pnpm audit:runtime` → a única alta nova é o `@fastify/busboy`; `@grpc/grpc-js` saiu da lista. Lockfile gerado com `pnpm install --lockfile-only`; sem `pnpm install` real (disco), o CI do PR confirma.
