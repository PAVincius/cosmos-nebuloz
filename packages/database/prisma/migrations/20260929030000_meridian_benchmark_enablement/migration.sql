-- Habilitação do benchmark travado por tenant (D-29 do CEO, spec #307).
--
-- Sem linha = benchmark desligado para o tenant. Tabela nova, SEM backfill: nenhum
-- tenant contribui nem lê o pool até alguém ligar explicitamente. `agreementRef`
-- aponta o aditivo ao DPA §2.1 que autoriza a contribuição; nulo só para tenant
-- interno (regra da aplicação). Quem ligou/desligou vive no AuditLog.
--
-- RLS no padrão do Meridian (20260902130000_meridian_rls): ENABLE + FORCE e
-- `tenant_isolation` por current_tenant_id(). Sem GRANT a anon/authenticated: a
-- tabela nasce sem acesso pela Data API (20260929020000_revoga_data_api_public
-- também fecha as tabelas futuras pelos default privileges). ADR-0012: com a
-- conexão atual (postgres, BYPASSRLS) a policy fica inerte; o filtro por tenantId
-- nas queries continua sendo o isolamento efetivo.

-- CreateTable
CREATE TABLE "MeridianBenchmarkEnablement" (
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "agreementRef" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeridianBenchmarkEnablement_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "MeridianBenchmarkEnablement" ADD CONSTRAINT "MeridianBenchmarkEnablement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "MeridianBenchmarkEnablement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeridianBenchmarkEnablement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "MeridianBenchmarkEnablement";
CREATE POLICY "tenant_isolation" ON "MeridianBenchmarkEnablement"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
