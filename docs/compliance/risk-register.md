# Risk Register — Cosmos Nebuloz

- **Criado em:** 2026-06-03
- **Próxima revisão:** 2026-07-01
- **Fonte:** Enterprise Validation Report (NEB-140)

## Riscos Identificados

| ID | Risco | Probabilidade | Impacto | Owner | Mitigação | Linear | Revisão |
|----|-------|---------------|---------|-------|-----------|--------|---------|
| R-001 | Cross-tenant data leak — RLS inexistente | Alta | Crítico | Backend Lead | Implementar RLS Postgres | NEB-112 | 2026-07-01 |
| R-002 | Exposição de secrets — sem vault/rotação | Alta | Crítico | DevOps | Vault migration + rotação imediata | NEB-113 | 2026-07-01 |
| R-003 | Vulnerabilidades SCA (5 críticas, 115 high) | Alta | Alto | Eng Lead | pnpm audit fix + CI gate | NEB-114 | 2026-07-01 |
| R-004 | Audit trail adulterável — sem trigger append-only | Média | Crítico | Backend Lead | Trigger Postgres + Prisma extension | NEB-115 | 2026-07-01 |
| R-005 | Gap SOC2 — eventos de segurança não gravados | Alta | Alto | Backend Lead | Instrumentar packages/audit | NEB-116 | 2026-07-01 |
| R-006 | Migrations sem histórico (prisma db push) | Média | Alto | DevOps | Migrar para prisma migrate deploy | NEB-117 | 2026-07-01 |
| R-007 | Import sem transação — orfãos em falha parcial | Média | Alto | Backend Lead | Wrap em $transaction | NEB-118 | 2026-07-01 |
| R-008 | LGPD — sem DSAR (erasure/export) | Alta | Crítico | CTO + Jurídico | Implementar endpoints DSAR | NEB-119 | 2026-07-15 |
| R-009 | LGPD — sem DPA, ROPA, DPIA | Alta | Crítico | CTO + Jurídico | Contratar DPO, assinar DPAs | NEB-120 | 2026-07-15 |
| R-010 | Backup sem restore testado | Alta | Alto | DevOps | DR drill em staging | NEB-121 | 2026-07-01 |
| R-011 | Sem circuit breaker em integrações externas | Média | Médio | Backend Lead | cockatiel + async queue | NEB-123 | 2026-08-01 |
| R-012 | Sem rate limiting em auth/copilot | Alta | Médio | Backend Lead | @upstash/ratelimit | NEB-133 | 2026-07-15 |
