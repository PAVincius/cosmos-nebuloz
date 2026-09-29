-- Habilitação do benchmark travado por tenant (D-29 do CEO, spec #307).
--
-- Sem linha = benchmark desligado para o tenant. Tabela nova, SEM backfill: nenhum
-- tenant contribui nem lê o pool até alguém ligar explicitamente. `agreementRef`
-- aponta o aditivo ao DPA §2.1 que autoriza a contribuição; nulo só para tenant
-- interno (regra da aplicação). Quem ligou/desligou vive no AuditLog.
--
-- RLS no padrão do Meridian (20260902130000_meridian_rls): ENABLE + FORCE e
-- `tenant_isolation` por current_tenant_id().
--
-- PRIVILÉGIOS (requisito do Vigia): quem liga o benchmark é a plataforma
-- (back-office, ADR-0013), nunca o app do cliente. Então o papel do app
-- (`cosmos_app`, docs/runbooks/app-db-role.md) fica só com SELECT do próprio
-- tenant (a policy filtra); INSERT/UPDATE/DELETE ficam com o dono da tabela e
-- com o papel de plataforma. Nada para PUBLIC, anon ou authenticated.
--
-- O QUE O MODELO DE PAPÉIS AINDA NÃO PERMITE: o papel de plataforma não existe.
-- Hoje `platformDb` é o mesmo client `database` (packages/provisioning/src/
-- platform-db.ts) e conecta como `postgres`; `cosmos_app` também só existe
-- depois do runbook. Por isso os REVOKE/GRANT abaixo são guardados pela
-- existência do papel (no Postgres local e onde o runbook ainda não rodou eles
-- não fazem nada), e o GRANT de escrita ao papel de plataforma fica para quando
-- ele for criado (runbook, passo 2). Enquanto a conexão for `postgres`
-- (BYPASSRLS, ADR-0012), policy e privilégios ficam inertes: o isolamento
-- efetivo é o filtro por tenantId e a escrita só pelo back-office na aplicação.

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

-- PRIVILÉGIOS
-- O runbook do papel do app concede CRUD em todas as tabelas (inclusive as
-- futuras, por default privileges): aqui a escrita é retirada desta tabela.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "MeridianBenchmarkEnablement" FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cosmos_app') THEN
    REVOKE ALL ON "MeridianBenchmarkEnablement" FROM cosmos_app;
    GRANT SELECT ON "MeridianBenchmarkEnablement" TO cosmos_app;
  END IF;
END $$;
