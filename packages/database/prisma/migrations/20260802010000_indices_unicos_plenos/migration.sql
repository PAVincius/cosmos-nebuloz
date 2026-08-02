-- Últimos três pontos de divergência entre a cadeia de migrations e o schema.
--
-- No banco esses índices existem em versão parcial (`WHERE ... IS NOT NULL`);
-- o schema os declara plenos. Ficaram documentados como resíduo aceito na
-- migration de reconciliação, mas resíduo não serve mais: o check de drift na
-- CI compara os dois e falharia em todo PR enquanto sobrasse qualquer diferença.
--
-- Trocar é seguro. O predicado parcial excluía linhas com NULL nas colunas do
-- índice, e no Postgres NULL nunca conflita com NULL num índice único — então o
-- índice pleno não recusa nenhuma linha que o parcial aceitava.

-- DropIndex
DROP INDEX IF EXISTS "LeanBudget_artId_piPlanId_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeanBudget_artId_piPlanId_key" ON "LeanBudget"("artId", "piPlanId");

-- DropIndex
DROP INDEX IF EXISTS "PIKnowledgeVector_source_unique";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PIKnowledgeVector_source_unique" ON "PIKnowledgeVector"("tenantId", "sourceType", "sourceId", "chunkIndex");

-- DropIndex
DROP INDEX IF EXISTS "PortfolioAnalysisReport_jobId_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioAnalysisReport_jobId_key" ON "PortfolioAnalysisReport"("jobId");
