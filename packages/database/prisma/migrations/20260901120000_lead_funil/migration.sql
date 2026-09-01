-- Metade inicial do funil comercial: Lead (LEAD | DISCOVERY | EVALUATION).
--
-- Separado de Proposal por decisão, não por falta de campo em comum:
-- `Proposal.numero` aparece em contrato, e gastar um número em lead que ainda
-- pode não virar nada corromperia um identificador que precisa ser exato. Um
-- Lead converte numa Proposal via `propostaId` — ele não se torna uma.
--
-- Puramente aditiva: uma tabela nova, nenhuma coluna existente tocada.

-- CreateTable
CREATE TABLE "Lead" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "nome"          TEXT NOT NULL,
    "contatoNome"   TEXT,
    "contatoEmail"  TEXT,
    "estagio"       TEXT NOT NULL DEFAULT 'LEAD',
    "origem"        TEXT,
    "donoId"        TEXT NOT NULL,
    "donoNome"      TEXT,
    "proximaAcao"   TEXT,
    "proximaAcaoEm" TIMESTAMP(3),
    "propostaId"    TEXT,
    "perdidoEm"     TIMESTAMP(3),
    "motivoPerda"   TEXT,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Único: uma proposta nasce de no máximo um lead — duas linhas do funil
-- apontando para o mesmo documento comercial seria a mesma venda contada
-- duas vezes.
CREATE UNIQUE INDEX "Lead_propostaId_key" ON "Lead"("propostaId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_estagio_idx" ON "Lead"("tenantId", "estagio");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull, não Cascade: o lead é histórico do funil e não deve desaparecer
-- se a proposta um dia sumir.
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS — mesma convenção de 20260728010000_rls_remaining_tenant_tables:
-- `current_tenant_id()` já existe desde aquela migration; aqui só se declara
-- a política de isolamento para a tabela nova. Idempotente (DROP POLICY IF
-- EXISTS antes do CREATE, ENABLE/FORCE seguros de repetir).
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "Lead";
CREATE POLICY "tenant_isolation" ON "Lead"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
