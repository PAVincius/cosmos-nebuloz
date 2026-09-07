-- CreateTable
CREATE TABLE "OrcamentoDaConta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "nota" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrcamentoDaConta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssinaturaDoTenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteSlug" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "planoSlug" TEXT NOT NULL,
    "valorMensalCentavos" INTEGER NOT NULL,
    "creditosMesIncluidos" INTEGER NOT NULL DEFAULT 0,
    "precoCreditoExtraCentavos" INTEGER NOT NULL,
    "tetoExcedenteCentavos" INTEGER,
    "iniciouEm" DATE NOT NULL,
    "encerradaEm" DATE,
    "motivoEncerramento" TEXT,
    "propostaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssinaturaDoTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MudancaDeAssinatura" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assinaturaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "deCentavos" INTEGER NOT NULL,
    "paraCentavos" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MudancaDeAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditoDoMes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteSlug" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "franquia" INTEGER NOT NULL,
    "consumidos" INTEGER NOT NULL DEFAULT 0,
    "precoCreditoExtraCentavos" INTEGER NOT NULL,
    "excedenteCentavos" INTEGER NOT NULL DEFAULT 0,
    "excedenteReprimidoCentavos" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditoDoMes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrcamentoDaConta_tenantId_competencia_idx" ON "OrcamentoDaConta"("tenantId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "OrcamentoDaConta_tenantId_competencia_conta_key" ON "OrcamentoDaConta"("tenantId", "competencia", "conta");

-- CreateIndex
CREATE INDEX "AssinaturaDoTenant_tenantId_encerradaEm_idx" ON "AssinaturaDoTenant"("tenantId", "encerradaEm");

-- CreateIndex
CREATE INDEX "AssinaturaDoTenant_tenantId_clienteSlug_idx" ON "AssinaturaDoTenant"("tenantId", "clienteSlug");

-- CreateIndex
-- Índice único parcial: no máximo uma assinatura ativa (encerradaEm IS NULL)
-- por cliente. Não cabe no schema Prisma (`@@unique` não aceita `WHERE`) —
-- comentário apontando para cá mora perto do model AssinaturaDoTenant.
CREATE UNIQUE INDEX "AssinaturaDoTenant_ativa_por_cliente"
  ON "AssinaturaDoTenant" ("tenantId", "clienteSlug")
  WHERE "encerradaEm" IS NULL;

-- CreateIndex
CREATE INDEX "MudancaDeAssinatura_tenantId_competencia_idx" ON "MudancaDeAssinatura"("tenantId", "competencia");

-- CreateIndex
CREATE INDEX "CreditoDoMes_tenantId_competencia_idx" ON "CreditoDoMes"("tenantId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "CreditoDoMes_tenantId_clienteSlug_competencia_key" ON "CreditoDoMes"("tenantId", "clienteSlug", "competencia");

-- AddForeignKey
ALTER TABLE "OrcamentoDaConta" ADD CONSTRAINT "OrcamentoDaConta_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssinaturaDoTenant" ADD CONSTRAINT "AssinaturaDoTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MudancaDeAssinatura" ADD CONSTRAINT "MudancaDeAssinatura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MudancaDeAssinatura" ADD CONSTRAINT "MudancaDeAssinatura_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "AssinaturaDoTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditoDoMes" ADD CONSTRAINT "CreditoDoMes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'OrcamentoDaConta',
    'AssinaturaDoTenant',
    'MudancaDeAssinatura',
    'CreditoDoMes'
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
