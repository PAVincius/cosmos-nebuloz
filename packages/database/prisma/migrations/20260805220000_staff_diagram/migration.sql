-- StaffDiagram — diagramas do back-office (BPMN e diagrama-como-código).
--
-- Uma tabela para os dois tipos porque são a mesma coisa: texto versionado que
-- renderiza como diagrama. A única diferença real é qual renderizador monta o
-- canvas, e isso é a coluna `kind`.
--
-- IF NOT EXISTS em tudo, e a FK embrulhada em EXCEPTION: reexecutar não pode
-- falhar por objeto que já está lá.

CREATE TABLE IF NOT EXISTS "StaffDiagram" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "kind"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "slug"          TEXT NOT NULL,
    "descricao"     TEXT,
    "source"        TEXT NOT NULL,
    "sobreTenantId" TEXT,
    "criadoPorId"   TEXT NOT NULL,
    "criadoPorNome" TEXT,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDiagram_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffDiagram_tenantId_slug_key" ON "StaffDiagram"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "StaffDiagram_tenantId_idx"             ON "StaffDiagram"("tenantId");
CREATE INDEX IF NOT EXISTS "StaffDiagram_tenantId_kind_idx"        ON "StaffDiagram"("tenantId", "kind");
CREATE INDEX IF NOT EXISTS "StaffDiagram_sobreTenantId_idx"        ON "StaffDiagram"("sobreTenantId");

CREATE TABLE IF NOT EXISTS "StaffDiagramVersion" (
    "id"        TEXT NOT NULL,
    "diagramId" TEXT NOT NULL,
    "versao"    INTEGER NOT NULL,
    "source"    TEXT NOT NULL,
    "nota"      TEXT,
    "autorId"   TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDiagramVersion_pkey" PRIMARY KEY ("id")
);

-- Unique de verdade, não só índice: é ele que impede duas revisões com o mesmo
-- número quando duas gravações concorrem. Sem isto o histórico ganha dois "v4"
-- e o diff entre versões deixa de ter resposta única.
CREATE UNIQUE INDEX IF NOT EXISTS "StaffDiagramVersion_diagramId_versao_key" ON "StaffDiagramVersion"("diagramId", "versao");
CREATE INDEX IF NOT EXISTS "StaffDiagramVersion_diagramId_idx" ON "StaffDiagramVersion"("diagramId");

DO $$
BEGIN
  ALTER TABLE "StaffDiagram"
    ADD CONSTRAINT "StaffDiagram_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "StaffDiagramVersion"
    ADD CONSTRAINT "StaffDiagramVersion_diagramId_fkey"
    FOREIGN KEY ("diagramId") REFERENCES "StaffDiagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
