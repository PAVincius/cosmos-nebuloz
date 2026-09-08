-- Catálogo de serviços: trilha, unidade de cobrança, duração, entregáveis,
-- papéis, pré-requisitos, vínculo com módulo e dependência de LAB.
--
-- `modalidade` continua existindo por ora. A coluna sai num script separado,
-- depois de conferir que `unidadeDeCobranca` está povoada — derrubar coluna e
-- migrar dado no mesmo passo não deixa como voltar atrás.

BEGIN;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "trilha"            TEXT NOT NULL DEFAULT 'readiness',
  ADD COLUMN IF NOT EXISTS "unidadeDeCobranca" TEXT NOT NULL DEFAULT 'PROJETO',
  ADD COLUMN IF NOT EXISTS "duracao"           TEXT,
  ADD COLUMN IF NOT EXISTS "entregaveis"       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "papeis"            TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "preRequisitos"     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "moduloVinculado"   "ProductModule",
  ADD COLUMN IF NOT EXISTS "exigeLab"          BOOLEAN NOT NULL DEFAULT false;

-- Migra o que `modalidade` já sabia. RETAINER é a única que recorre, e é a
-- única cuja tradução importa para a fórmula: PROJETO e LICENCA caem os dois
-- no setup, então viram PROJETO.
UPDATE "Service"
SET "unidadeDeCobranca" = CASE
      WHEN "modalidade" = 'RETAINER' THEN 'RETAINER'
      ELSE 'PROJETO'
    END
WHERE "unidadeDeCobranca" = 'PROJETO';

COMMIT;

-- Conferência — nenhuma linha deve sair com unidade divergente da modalidade:
--   SELECT codigo, modalidade, "unidadeDeCobranca" FROM "Service" ORDER BY codigo;
