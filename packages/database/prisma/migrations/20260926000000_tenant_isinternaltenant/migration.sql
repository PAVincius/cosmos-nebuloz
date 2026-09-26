-- Tenant.isInternalTenant — diferencia o(s) tenant(s) que veem o catálogo de
-- produtos pós-login (spec 004) dos demais, que seguem direto pro produto
-- contratado. Distinto de isSystem (tenant técnico de auditoria).
--
-- Default false: nenhum tenant existente muda de comportamento até alguém
-- marcar a flag manualmente (fora do escopo desta migration). IF NOT EXISTS
-- para reexecutar sem falhar onde a coluna já estiver.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isInternalTenant" BOOLEAN NOT NULL DEFAULT false;
