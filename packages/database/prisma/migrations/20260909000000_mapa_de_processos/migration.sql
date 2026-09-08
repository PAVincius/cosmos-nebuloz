-- CreateTable
CREATE TABLE "StaffProcess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "donoNome" TEXT,
    "revisadoEm" TIMESTAMP(3),
    "tags" TEXT[],
    "diagramId" TEXT,
    "docUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProcessEdge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deId" TEXT NOT NULL,
    "paraId" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,

    CONSTRAINT "StaffProcessEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffProcess_tenantId_dominio_idx" ON "StaffProcess"("tenantId", "dominio");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProcess_tenantId_codigo_key" ON "StaffProcess"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "StaffProcessEdge_tenantId_idx" ON "StaffProcessEdge"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProcessEdge_deId_paraId_key" ON "StaffProcessEdge"("deId", "paraId");

-- AddForeignKey
ALTER TABLE "StaffProcess" ADD CONSTRAINT "StaffProcess_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "StaffDiagram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProcessEdge" ADD CONSTRAINT "StaffProcessEdge_deId_fkey" FOREIGN KEY ("deId") REFERENCES "StaffProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProcessEdge" ADD CONSTRAINT "StaffProcessEdge_paraId_fkey" FOREIGN KEY ("paraId") REFERENCES "StaffProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS nas duas tabelas novas, no mesmo ato da criação (mesmo bloco de
-- 20260907000000_conta_do_plano e mesmos avisos ADR-0012/ADR-0013).

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'StaffProcess',
    'StaffProcessEdge'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())',
      t
    );
  END LOOP;
END $$;
