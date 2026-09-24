# Audit log: diff array Meridian + alvo legível + filtro prefixo

**Data**: 2026-09-24
**Commit**: `ea0454dd444e52722a7ca37e1972a6b09368484e`
**Origem**: Morgana, P2 dogfood Meridian (`docs/qualidade/dogfood/meridian/atrito.md`, commit `c5e5ccef`)

## O quê

`apps/app/app/(authenticated)/settings/audit/components/audit-log-table.tsx`:

1. `formatDiff` assumia `Record<string,unknown>` e fazia `Object.entries` — quebrava
   com o diff do Meridian (`Array<[campo,antes,depois]>`, formato normativo,
   ver `(meridian)/actions/_shared.ts`). Agora lê os dois formatos.
   FR-038 (override mostra antes/depois) coberto por teste.
2. Coluna "Entidade" só mostrava `entityId` (cuid). Agora usa `metadata.target`
   quando presente, fallback pro `entityId`.
3. `listAuditLogs` aceita `entityType` terminado em "." como prefixo
   (`startsWith`); pill "Meridian" no filtro usa `entityType=meridian.`.

Sem mudança de schema Prisma (`metadata` já existia na tabela `AuditLog`,
só não estava no tipo TS `AuditLog`).

## Testes

- `__tests__/screens/settings-audit-log-table.test.tsx` (novo): formatDiff
  Record vs array, coluna de alvo, pill de prefixo.
- `__tests__/actions/audit/audit.test.ts`: filtro de prefixo em `listAuditLogs`.

## Fora do escopo

Não toquei em código do Meridian. `test.fixme` em `e2e/meridian-dogfood.spec.ts:336`
(FR-038) não foi destravado — é arquivo do dogfood, fora da minha alçada.
