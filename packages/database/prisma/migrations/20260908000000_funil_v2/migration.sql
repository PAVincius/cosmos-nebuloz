-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "acvEstimadoCentavos" INTEGER,
ADD COLUMN     "canalId" TEXT,
ADD COLUMN     "entrada" "ProductModule",
ADD COLUMN     "estagioDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notaPerda" TEXT,
ADD COLUMN     "perdidoNoEstagio" TEXT;

-- CreateTable
CREATE TABLE "EstagioDoFunil" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "pesoPercent" INTEGER NOT NULL,
    "tetoDias" INTEGER NOT NULL,
    "criterios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstagioDoFunil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MudancaDeEstagio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MudancaDeEstagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanalDeLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cacMedioCentavos" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CanalDeLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoDeEstagio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoDeEstagio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstagioDoFunil_tenantId_codigo_key" ON "EstagioDoFunil"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "MudancaDeEstagio_tenantId_codigo_criadoEm_idx" ON "MudancaDeEstagio"("tenantId", "codigo", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CanalDeLead_tenantId_slug_key" ON "CanalDeLead"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "HistoricoDeEstagio_tenantId_para_em_idx" ON "HistoricoDeEstagio"("tenantId", "para", "em");

-- CreateIndex
CREATE INDEX "HistoricoDeEstagio_leadId_idx" ON "HistoricoDeEstagio"("leadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "CanalDeLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstagioDoFunil" ADD CONSTRAINT "EstagioDoFunil_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MudancaDeEstagio" ADD CONSTRAINT "MudancaDeEstagio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanalDeLead" ADD CONSTRAINT "CanalDeLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoDeEstagio" ADD CONSTRAINT "HistoricoDeEstagio_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoDeEstagio" ADD CONSTRAINT "HistoricoDeEstagio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: "estagioDesde" nasce igual a "criadoEm" nas linhas existentes —
-- sem isto todo lead antigo apareceria com zero dias no estágio atual.
UPDATE "Lead" SET "estagioDesde" = "criadoEm";

-- Backfill: "motivoPerda" passa a guardar código, não texto livre. Linha
-- antiga cujo valor não é um dos códigos válidos vira OUTRO, com o texto
-- original preservado em "notaPerda".
UPDATE "Lead" SET "notaPerda" = "motivoPerda", "motivoPerda" = 'OUTRO' WHERE "motivoPerda" IS NOT NULL AND "motivoPerda" NOT IN ('PRECO','TIMING','SEM_SPONSOR','CONCORRENTE','SEM_FIT','OUTRO');

-- Backfill: uma linha de histórico por lead existente, `null → <estagio
-- atual>` em "criadoEm" — sem isto o painel de permanência/conversão nasceria
-- cego para tudo que aconteceu antes desta migration.
INSERT INTO "HistoricoDeEstagio" ("id","tenantId","leadId","de","para","em") SELECT 'hist_' || "id", "tenantId", "id", NULL, "estagio", "criadoEm" FROM "Lead";

-- RLS nas quatro tabelas novas, no mesmo ato da criação (mesmo bloco de
-- 20260907000000_conta_do_plano e mesmos avisos ADR-0012/ADR-0013).

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'EstagioDoFunil','MudancaDeEstagio','CanalDeLead','HistoricoDeEstagio'
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
