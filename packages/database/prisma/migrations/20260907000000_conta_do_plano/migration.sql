-- CreateTable
CREATE TABLE "ContaDoPlano" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupo" INTEGER NOT NULL,
    "centroDeCusto" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaDoPlano_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaDoPlano_tenantId_grupo_idx" ON "ContaDoPlano"("tenantId", "grupo");

-- CreateIndex
CREATE UNIQUE INDEX "ContaDoPlano_tenantId_conta_key" ON "ContaDoPlano"("tenantId", "conta");

-- AddForeignKey
ALTER TABLE "ContaDoPlano" ADD CONSTRAINT "ContaDoPlano_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS na tabela ContaDoPlano, no mesmo ato da criação (mesmo bloco de
-- 20260906000000_empresa e mesmos avisos ADR-0012/ADR-0013).

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ContaDoPlano'
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
