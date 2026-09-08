-- Growth · diagnóstico de maturidade de IA.
--
-- `rubricaVersao` é o que permite reler uma avaliação antiga com a rubrica que
-- a pontuou: a rubrica vive em código (lib/growth/maturidade.ts) e vai evoluir,
-- e sem o carimbo mudar um peso reescreveria em silêncio o score já entregue.
--
-- `RespostaDeMaturidade` carrega "tenantId" mesmo sendo filha da avaliação,
-- pelo mesmo motivo de "HistoricoDeEstagio": a policy desta casa é
-- `"tenantId" = current_tenant_id()`, e tabela sem a coluna fica fora do
-- isolamento por não caber na regra.

-- CreateTable
CREATE TABLE "AvaliacaoDeMaturidade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizacao" TEXT NOT NULL,
    "leadId" TEXT,
    "rubricaVersao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "scoreGeral" INTEGER,
    "nivelGeral" TEXT,
    "concluidaEm" TIMESTAMP(3),
    "autorId" TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoDeMaturidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaDeMaturidade" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "criterioId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "nota" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RespostaDeMaturidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliacaoDeMaturidade_tenantId_status_idx" ON "AvaliacaoDeMaturidade"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AvaliacaoDeMaturidade_tenantId_criadoEm_idx" ON "AvaliacaoDeMaturidade"("tenantId", "criadoEm");

-- CreateIndex
CREATE INDEX "RespostaDeMaturidade_tenantId_idx" ON "RespostaDeMaturidade"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "RespostaDeMaturidade_avaliacaoId_criterioId_key" ON "RespostaDeMaturidade"("avaliacaoId", "criterioId");

-- AddForeignKey
ALTER TABLE "AvaliacaoDeMaturidade" ADD CONSTRAINT "AvaliacaoDeMaturidade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoDeMaturidade" ADD CONSTRAINT "AvaliacaoDeMaturidade_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaDeMaturidade" ADD CONSTRAINT "RespostaDeMaturidade_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "AvaliacaoDeMaturidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaDeMaturidade" ADD CONSTRAINT "RespostaDeMaturidade_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS nas duas tabelas novas, no mesmo ato da criação (mesmo bloco de
-- 20260908000000_funil_v2 e mesmos avisos ADR-0012/ADR-0013: a policy fica
-- inerte enquanto a aplicação conectar como superuser, e o isolamento real
-- hoje é o filtro por tenant em toda query).

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'AvaliacaoDeMaturidade','RespostaDeMaturidade'
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
