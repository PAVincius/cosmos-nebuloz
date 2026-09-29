-- Reset do domínio Meridian (todos os tenants). Runbook: docs/runbooks/meridian-reset-producao.md
--
-- Apaga: MeridianGapPromotion, MeridianPlanItem, MeridianGapDependency, MeridianGap,
--        MeridianEvidence, MeridianResponse, MeridianOverride, MeridianAxisScore,
--        MeridianRespondent, MeridianAssessment, MeridianBenchmarkContribution,
--        MeridianBenchmarkCohort, MeridianSequence.
-- Mantém: MeridianTemplate, MeridianQuestion, MeridianMembership. AuditLog não é tocado.
--
-- Nomes conferidos em packages/database/prisma/schema/meridian.prisma (sem @@map:
-- a tabela tem o nome do model). Ordem do DELETE espelha seed-meridian.ts, com
-- MeridianGap antes de MeridianAssessment (FK Restrict).
--
-- Rode os blocos na ordem. O bloco 4 é uma transação única: qualquer erro ou
-- guarda disparada desfaz tudo. Se o bloco 4 falhar, o backup do bloco 1 continua lá.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Backup no próprio banco (reversível). Falha se o schema de backup já tem a
--    tabela: é de propósito, para não sobrescrever um backup anterior.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS backup_meridian_20260929;
CREATE TABLE backup_meridian_20260929."MeridianGapPromotion"            AS SELECT * FROM "MeridianGapPromotion";
CREATE TABLE backup_meridian_20260929."MeridianPlanItem"                AS SELECT * FROM "MeridianPlanItem";
CREATE TABLE backup_meridian_20260929."MeridianGapDependency"           AS SELECT * FROM "MeridianGapDependency";
CREATE TABLE backup_meridian_20260929."MeridianGap"                     AS SELECT * FROM "MeridianGap";
CREATE TABLE backup_meridian_20260929."MeridianEvidence"                AS SELECT * FROM "MeridianEvidence";
CREATE TABLE backup_meridian_20260929."MeridianResponse"                AS SELECT * FROM "MeridianResponse";
CREATE TABLE backup_meridian_20260929."MeridianOverride"                AS SELECT * FROM "MeridianOverride";
CREATE TABLE backup_meridian_20260929."MeridianAxisScore"               AS SELECT * FROM "MeridianAxisScore";
CREATE TABLE backup_meridian_20260929."MeridianRespondent"              AS SELECT * FROM "MeridianRespondent";
CREATE TABLE backup_meridian_20260929."MeridianAssessment"              AS SELECT * FROM "MeridianAssessment";
CREATE TABLE backup_meridian_20260929."MeridianBenchmarkContribution"   AS SELECT * FROM "MeridianBenchmarkContribution";
CREATE TABLE backup_meridian_20260929."MeridianBenchmarkCohort"         AS SELECT * FROM "MeridianBenchmarkCohort";
CREATE TABLE backup_meridian_20260929."MeridianSequence"                AS SELECT * FROM "MeridianSequence";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Contagem ANTES (cole a saída no relatório). Mesma consulta do bloco 5.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'apaga'  AS grupo, 'MeridianGapPromotion'          AS tabela, count(*) AS linhas FROM "MeridianGapPromotion"
UNION ALL SELECT 'apaga',  'MeridianPlanItem',              count(*) FROM "MeridianPlanItem"
UNION ALL SELECT 'apaga',  'MeridianGapDependency',         count(*) FROM "MeridianGapDependency"
UNION ALL SELECT 'apaga',  'MeridianGap',                   count(*) FROM "MeridianGap"
UNION ALL SELECT 'apaga',  'MeridianEvidence',              count(*) FROM "MeridianEvidence"
UNION ALL SELECT 'apaga',  'MeridianResponse',              count(*) FROM "MeridianResponse"
UNION ALL SELECT 'apaga',  'MeridianOverride',              count(*) FROM "MeridianOverride"
UNION ALL SELECT 'apaga',  'MeridianAxisScore',             count(*) FROM "MeridianAxisScore"
UNION ALL SELECT 'apaga',  'MeridianRespondent',            count(*) FROM "MeridianRespondent"
UNION ALL SELECT 'apaga',  'MeridianAssessment',            count(*) FROM "MeridianAssessment"
UNION ALL SELECT 'apaga',  'MeridianBenchmarkContribution', count(*) FROM "MeridianBenchmarkContribution"
UNION ALL SELECT 'apaga',  'MeridianBenchmarkCohort',       count(*) FROM "MeridianBenchmarkCohort"
UNION ALL SELECT 'apaga',  'MeridianSequence',              count(*) FROM "MeridianSequence"
UNION ALL SELECT 'mantém', 'MeridianTemplate',              count(*) FROM "MeridianTemplate"
UNION ALL SELECT 'mantém', 'MeridianQuestion',              count(*) FROM "MeridianQuestion"
UNION ALL SELECT 'mantém', 'MeridianMembership',            count(*) FROM "MeridianMembership";

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vínculo externo: trilha do Scaffold apontando para gap ou promoção do
--    Meridian. Não há FK, então apagar deixaria a trilha órfã.
--    Resultado > 0 → PARAR e registrar; não rode o bloco 4.
--    (O bloco 4 repete esta guarda e aborta sozinho se houver vínculo.)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS trilhas_vinculadas
FROM "ScaffoldTrack"
WHERE "sourceGapId" IS NOT NULL OR "sourcePromotionId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Apagamento numa transação, na ordem que respeita as FKs.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

DO $$
DECLARE vinculadas integer;
BEGIN
  SELECT count(*) INTO vinculadas
  FROM "ScaffoldTrack"
  WHERE "sourceGapId" IS NOT NULL OR "sourcePromotionId" IS NOT NULL;
  IF vinculadas > 0 THEN
    RAISE EXCEPTION 'reset abortado: % trilha(s) do Scaffold apontam para gap/promoção do Meridian', vinculadas;
  END IF;
END $$;

DELETE FROM "MeridianGapPromotion";
DELETE FROM "MeridianPlanItem";
DELETE FROM "MeridianGapDependency";
DELETE FROM "MeridianGap";              -- antes de Assessment: FK Restrict
DELETE FROM "MeridianEvidence";
DELETE FROM "MeridianResponse";
DELETE FROM "MeridianOverride";
DELETE FROM "MeridianAxisScore";
DELETE FROM "MeridianRespondent";
DELETE FROM "MeridianAssessment";
DELETE FROM "MeridianBenchmarkContribution";
DELETE FROM "MeridianBenchmarkCohort";
-- Sequência: a coluna é "next" (default 1) e o código (upsert em _shared.ts)
-- trata linha ausente como primeiro número. Apagar as linhas zera os códigos
-- (AS-001, G-01) sem depender do valor inicial da coluna.
DELETE FROM "MeridianSequence";

-- Trava: se sobrou linha em qualquer tabela apagada, desfaz tudo.
DO $$
DECLARE restante bigint;
BEGIN
  SELECT
      (SELECT count(*) FROM "MeridianGapPromotion")
    + (SELECT count(*) FROM "MeridianPlanItem")
    + (SELECT count(*) FROM "MeridianGapDependency")
    + (SELECT count(*) FROM "MeridianGap")
    + (SELECT count(*) FROM "MeridianEvidence")
    + (SELECT count(*) FROM "MeridianResponse")
    + (SELECT count(*) FROM "MeridianOverride")
    + (SELECT count(*) FROM "MeridianAxisScore")
    + (SELECT count(*) FROM "MeridianRespondent")
    + (SELECT count(*) FROM "MeridianAssessment")
    + (SELECT count(*) FROM "MeridianBenchmarkContribution")
    + (SELECT count(*) FROM "MeridianBenchmarkCohort")
    + (SELECT count(*) FROM "MeridianSequence")
  INTO restante;
  IF restante <> 0 THEN
    RAISE EXCEPTION 'reset abortado: % linha(s) restantes após o DELETE', restante;
  END IF;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Contagem DEPOIS. Esperado: grupo 'apaga' tudo 0; grupo 'mantém' igual ao bloco 2.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'apaga'  AS grupo, 'MeridianGapPromotion'          AS tabela, count(*) AS linhas FROM "MeridianGapPromotion"
UNION ALL SELECT 'apaga',  'MeridianPlanItem',              count(*) FROM "MeridianPlanItem"
UNION ALL SELECT 'apaga',  'MeridianGapDependency',         count(*) FROM "MeridianGapDependency"
UNION ALL SELECT 'apaga',  'MeridianGap',                   count(*) FROM "MeridianGap"
UNION ALL SELECT 'apaga',  'MeridianEvidence',              count(*) FROM "MeridianEvidence"
UNION ALL SELECT 'apaga',  'MeridianResponse',              count(*) FROM "MeridianResponse"
UNION ALL SELECT 'apaga',  'MeridianOverride',              count(*) FROM "MeridianOverride"
UNION ALL SELECT 'apaga',  'MeridianAxisScore',             count(*) FROM "MeridianAxisScore"
UNION ALL SELECT 'apaga',  'MeridianRespondent',            count(*) FROM "MeridianRespondent"
UNION ALL SELECT 'apaga',  'MeridianAssessment',            count(*) FROM "MeridianAssessment"
UNION ALL SELECT 'apaga',  'MeridianBenchmarkContribution', count(*) FROM "MeridianBenchmarkContribution"
UNION ALL SELECT 'apaga',  'MeridianBenchmarkCohort',       count(*) FROM "MeridianBenchmarkCohort"
UNION ALL SELECT 'apaga',  'MeridianSequence',              count(*) FROM "MeridianSequence"
UNION ALL SELECT 'mantém', 'MeridianTemplate',              count(*) FROM "MeridianTemplate"
UNION ALL SELECT 'mantém', 'MeridianQuestion',              count(*) FROM "MeridianQuestion"
UNION ALL SELECT 'mantém', 'MeridianMembership',            count(*) FROM "MeridianMembership";
