-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "conta" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "contraparte" TEXT,
    "documento" TEXT,
    "nota" TEXT,
    "tituloId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Titulo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "contraparte" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "emissao" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "baixadoEm" DATE,
    "competenciaBaixa" TEXT,
    "motivoCancelamento" TEXT,
    "clienteSlug" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Titulo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lancamento_tenantId_competencia_idx" ON "Lancamento"("tenantId", "competencia");

-- CreateIndex
CREATE INDEX "Lancamento_tenantId_conta_idx" ON "Lancamento"("tenantId", "conta");

-- CreateIndex
CREATE INDEX "Titulo_tenantId_status_vencimento_idx" ON "Titulo"("tenantId", "status", "vencimento");

-- CreateIndex
CREATE INDEX "Titulo_tenantId_tipo_idx" ON "Titulo"("tenantId", "tipo");

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_tituloId_fkey" FOREIGN KEY ("tituloId") REFERENCES "Titulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Titulo" ADD CONSTRAINT "Titulo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cópia de abertura: cada valor mensal vira uma linha do livro-razão, datada
-- no dia 1 da competência. `LancamentoMensal` fica intacto e sem escritor —
-- a remoção é migration posterior, depois de o DRE bater em produção.
INSERT INTO "Lancamento" ("id","tenantId","competencia","data","conta","descricao","valorCentavos","nota","criadoEm","atualizadoEm")
SELECT 'abert_' || "id", "tenantId", "competencia", ("competencia" || '-01')::date, "conta", 'Saldo de abertura (migrado)', "valorCentavos", "nota", now(), now()
FROM "LancamentoMensal";

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Lancamento',
    'Titulo'
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
