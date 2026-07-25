# Story-034 — LGPD + Audit + Tenant Isolation (Complete)

**Date:** 2026-06-10
**Branch:** feat/kanban-portfolio-ai
**WSJF:** 12

---

## Entregues

| AC | Item | Arquivo |
|----|------|---------|
| AC-002 | SOC2 JSONL export route | `apps/app/app/api/compliance/soc2-export/route.ts` (pré-existente) |
| AC-004 | LGPD portability export builder | `apps/app/lib/inngest/lgpd-dsr.ts` (pré-existente) |
| AC-005 | Erasure pipeline (Inngest) | `apps/app/lib/inngest/lgpd-dsr.ts` (pré-existente) |
| AC-007 | Monthly isolation audit cron | `apps/app/lib/inngest/isolation-audit.ts` ← **novo** |
| AC-008 | Cursor-based audit pagination | `apps/app/app/actions/audit/index.ts` + `schema.ts` ← **atualizado** |
| —   | User-facing LGPD actions | `apps/app/app/actions/settings/lgpd.ts` ← **novo** |

---

## Mudanças

### Cursor pagination (AC-008)
- `AuditFiltersSchema` ganhou campo `cursor?: string` (cuid)
- `listAuditLogs`: modo cursor usa `findMany({ cursor: { id }, skip: 1, take })` + retorna `meta.nextCursor`
- `PageMeta` em `_base.ts` ganhou campo opcional `nextCursor?: string`
- Limite máximo aumentado para 100 (era 50)

### LGPD server actions
- `submitErasureRequest()`: cria DSR, verifica request pendente existente, dispara `lgpd/erasure.requested`
- `requestPortabilityExport()`: chama `buildPortabilityExport`, loga DSR de portabilidade, retorna payload

### Monthly isolation audit (AC-007)
- Inngest fn `monthly-isolation-audit`: cron `0 0 1 * *` (1º dia do mês)
- Consulta `pg_class` para tables sem RLS (`relrowsecurity = false`)
- Grava `auditLog` com `action="compliance.isolation_audit.monthly"` e metadata
- Registrado em `apps/app/app/api/inngest/route.ts`

---

## Testes (25 total — todos passando)

| Suite | Testes |
|-------|--------|
| `compliance/lgpd.test.ts` | 13 (portability, SOC2, erasure) |
| `compliance/audit-cursor.test.ts` | 6 (cursor + offset pagination) |
| `compliance/lgpd-actions.test.ts` | 6 (submitErasure + portabilityExport) |

---

## Decisões-chave

- **`total: -1` em cursor mode**: sem COUNT() — tradeoff de performance vs exatidão. `hasNext` via `items.length === take`.
- **Dedup de DSR**: se já existe PENDING/IN_PROGRESS, retorna ID existente sem criar novo.
- **Portabilidade fire-and-forget**: log da DSR não bloqueia resposta — `.catch(() => null)`.
- **Isolation audit usa `pg_class`**: mais preciso que `pg_tables` para verificar `relrowsecurity`.
