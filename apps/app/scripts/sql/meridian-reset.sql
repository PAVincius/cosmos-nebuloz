-- Reset do domínio Meridian (todos os tenants). Runbook: docs/runbooks/meridian-reset-producao.md
--
-- Apaga: MeridianGapPromotion, MeridianPlanItem, MeridianGapDependency, MeridianGap, MeridianEvidence, MeridianResponse, MeridianOverride, MeridianAxisScore, MeridianRespondent, MeridianAssessment, MeridianBenchmarkContribution, MeridianBenchmarkCohort, MeridianSequence.
-- Mantém: MeridianTemplate, MeridianQuestion, MeridianMembership. AuditLog não é tocado.
--
-- Nomes conferidos em packages/database/prisma/schema/meridian.prisma (sem @@map:
-- a tabela tem o nome do model). Ordem do DELETE espelha seed-meridian.ts, com
-- MeridianGap antes de MeridianAssessment (FK Restrict).
--
-- Rode como o papel dono do banco (postgres no SQL Studio): o bloco 3 recusa
-- qualquer papel que não ignore RLS, porque as guardas contam linhas e sob RLS
-- contariam zero.
--
-- Blocos 1 e 2 são leituras. O bloco 3 é UMA transação: trava as 13 tabelas,
-- faz o backup, fecha o backup para qualquer papel da API, confere as guardas,
-- apaga e confere de novo. Qualquer erro desfaz tudo, backup incluído.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Contagem ANTES (cole a saída no relatório). Mesma consulta do bloco 4.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'apaga' AS grupo, 'MeridianGapPromotion' AS tabela, count(*) AS linhas FROM "MeridianGapPromotion"
UNION ALL SELECT 'apaga', 'MeridianPlanItem', count(*) FROM "MeridianPlanItem"
UNION ALL SELECT 'apaga', 'MeridianGapDependency', count(*) FROM "MeridianGapDependency"
UNION ALL SELECT 'apaga', 'MeridianGap', count(*) FROM "MeridianGap"
UNION ALL SELECT 'apaga', 'MeridianEvidence', count(*) FROM "MeridianEvidence"
UNION ALL SELECT 'apaga', 'MeridianResponse', count(*) FROM "MeridianResponse"
UNION ALL SELECT 'apaga', 'MeridianOverride', count(*) FROM "MeridianOverride"
UNION ALL SELECT 'apaga', 'MeridianAxisScore', count(*) FROM "MeridianAxisScore"
UNION ALL SELECT 'apaga', 'MeridianRespondent', count(*) FROM "MeridianRespondent"
UNION ALL SELECT 'apaga', 'MeridianAssessment', count(*) FROM "MeridianAssessment"
UNION ALL SELECT 'apaga', 'MeridianBenchmarkContribution', count(*) FROM "MeridianBenchmarkContribution"
UNION ALL SELECT 'apaga', 'MeridianBenchmarkCohort', count(*) FROM "MeridianBenchmarkCohort"
UNION ALL SELECT 'apaga', 'MeridianSequence', count(*) FROM "MeridianSequence"
UNION ALL SELECT 'mantém', 'MeridianTemplate', count(*) FROM "MeridianTemplate"
UNION ALL SELECT 'mantém', 'MeridianQuestion', count(*) FROM "MeridianQuestion"
UNION ALL SELECT 'mantém', 'MeridianMembership', count(*) FROM "MeridianMembership";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vínculos externos, só para leitura. Resultado > 0 → PARAR e registrar.
--    O bloco 3 repete estas guardas e aborta sozinho.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS trilhas_vinculadas
FROM "ScaffoldTrack"
WHERE "sourceGapId" IS NOT NULL OR "sourcePromotionId" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trava + backup + guardas + apagamento, numa transação.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- Espera no máximo 30 s pelas travas; passou disso, desfaz e tenta de novo.
SET LOCAL lock_timeout = '30s';

-- 3.0 As guardas contam linhas: sob RLS contariam zero e o reset passaria cego.
DO $$
BEGIN
  IF NOT (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'reset abortado: o papel % não ignora RLS; rode como o dono do banco', current_user;
  END IF;
END $$;

-- 3.1 Trava de escrita nas 13 tabelas (leitura segue livre). Sem isso o
--     /meridian-responder, que é público, grava entre o backup e o DELETE e a
--     linha some sem estar no backup.
LOCK TABLE
     "MeridianGapPromotion",
     "MeridianPlanItem",
     "MeridianGapDependency",
     "MeridianGap",
     "MeridianEvidence",
     "MeridianResponse",
     "MeridianOverride",
     "MeridianAxisScore",
     "MeridianRespondent",
     "MeridianAssessment",
     "MeridianBenchmarkContribution",
     "MeridianBenchmarkCohort",
     "MeridianSequence"
  IN SHARE ROW EXCLUSIVE MODE;

-- 3.2 Backup. CREATE SCHEMA sem IF NOT EXISTS: se já houver backup com este
--     nome, falha em vez de misturar (escolha outro sufixo de data).
CREATE SCHEMA backup_meridian_20260929;
CREATE TABLE backup_meridian_20260929."MeridianGapPromotion" AS SELECT * FROM "MeridianGapPromotion";
CREATE TABLE backup_meridian_20260929."MeridianPlanItem" AS SELECT * FROM "MeridianPlanItem";
CREATE TABLE backup_meridian_20260929."MeridianGapDependency" AS SELECT * FROM "MeridianGapDependency";
CREATE TABLE backup_meridian_20260929."MeridianGap" AS SELECT * FROM "MeridianGap";
CREATE TABLE backup_meridian_20260929."MeridianEvidence" AS SELECT * FROM "MeridianEvidence";
CREATE TABLE backup_meridian_20260929."MeridianResponse" AS SELECT * FROM "MeridianResponse";
CREATE TABLE backup_meridian_20260929."MeridianOverride" AS SELECT * FROM "MeridianOverride";
CREATE TABLE backup_meridian_20260929."MeridianAxisScore" AS SELECT * FROM "MeridianAxisScore";
CREATE TABLE backup_meridian_20260929."MeridianRespondent" AS SELECT * FROM "MeridianRespondent";
CREATE TABLE backup_meridian_20260929."MeridianAssessment" AS SELECT * FROM "MeridianAssessment";
CREATE TABLE backup_meridian_20260929."MeridianBenchmarkContribution" AS SELECT * FROM "MeridianBenchmarkContribution";
CREATE TABLE backup_meridian_20260929."MeridianBenchmarkCohort" AS SELECT * FROM "MeridianBenchmarkCohort";
CREATE TABLE backup_meridian_20260929."MeridianSequence" AS SELECT * FROM "MeridianSequence";

-- 3.3 O schema novo não herda RLS nem grants e guarda respondentes de todos os
--     tenants. Fecha para qualquer papel da API; sem policy, RLS nega tudo.
REVOKE ALL ON SCHEMA backup_meridian_20260929 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_meridian_20260929 FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE backup_meridian_20260929."MeridianGapPromotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianGapPromotion" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianPlanItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianPlanItem" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianGapDependency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianGapDependency" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianGap" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianGap" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianEvidence" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianResponse" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianOverride" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianAxisScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianAxisScore" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianRespondent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianRespondent" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianAssessment" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianBenchmarkContribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianBenchmarkContribution" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianBenchmarkCohort" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianBenchmarkCohort" FORCE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_meridian_20260929."MeridianSequence" FORCE ROW LEVEL SECURITY;

DO $$
DECLARE papel text;
BEGIN
  FOREACH papel IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel)
       AND has_schema_privilege(papel, 'backup_meridian_20260929', 'USAGE') THEN
      RAISE EXCEPTION 'reset abortado: % ainda tem USAGE no schema backup_meridian_20260929', papel;
    END IF;
  END LOOP;
END $$;

-- 3.4 Vínculos externos sem FK: apagar deixaria a origem apontando para o nada.
DO $$
DECLARE vinculadas bigint;
BEGIN
  SELECT count(*) INTO vinculadas
  FROM "ScaffoldTrack"
  WHERE "sourceGapId" IS NOT NULL OR "sourcePromotionId" IS NOT NULL;
  IF vinculadas > 0 THEN
    RAISE EXCEPTION 'reset abortado: % trilha(s) do Scaffold apontam para gap/promoção do Meridian', vinculadas;
  END IF;

  -- ProcessRegistry (Alicerce) ainda não existe em produção: só confere se existir.
  IF to_regclass('"ProcessRegistry"') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = to_regclass('"ProcessRegistry"')
         AND attname = 'meridianGapId' AND NOT attisdropped
     ) THEN
    EXECUTE 'SELECT count(*) FROM "ProcessRegistry" WHERE "meridianGapId" IS NOT NULL' INTO vinculadas;
    IF vinculadas > 0 THEN
      RAISE EXCEPTION 'reset abortado: % linha(s) do ProcessRegistry apontam para gap do Meridian', vinculadas;
    END IF;
  END IF;
END $$;

-- 3.5 Apagamento, na ordem que respeita as FKs.
DELETE FROM "MeridianGapPromotion";
DELETE FROM "MeridianPlanItem";
DELETE FROM "MeridianGapDependency";
DELETE FROM "MeridianGap";  -- antes de Assessment: FK Restrict
DELETE FROM "MeridianEvidence";
DELETE FROM "MeridianResponse";
DELETE FROM "MeridianOverride";
DELETE FROM "MeridianAxisScore";
DELETE FROM "MeridianRespondent";
DELETE FROM "MeridianAssessment";
DELETE FROM "MeridianBenchmarkContribution";
DELETE FROM "MeridianBenchmarkCohort";
DELETE FROM "MeridianSequence";  -- coluna é "next"; linha ausente = primeiro número (upsert em _shared.ts)

-- 3.6 Trava: se sobrou linha em qualquer tabela apagada, desfaz tudo.
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
-- 4. Contagem DEPOIS. Esperado: grupo 'apaga' tudo 0; grupo 'mantém' igual ao bloco 1.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'apaga' AS grupo, 'MeridianGapPromotion' AS tabela, count(*) AS linhas FROM "MeridianGapPromotion"
UNION ALL SELECT 'apaga', 'MeridianPlanItem', count(*) FROM "MeridianPlanItem"
UNION ALL SELECT 'apaga', 'MeridianGapDependency', count(*) FROM "MeridianGapDependency"
UNION ALL SELECT 'apaga', 'MeridianGap', count(*) FROM "MeridianGap"
UNION ALL SELECT 'apaga', 'MeridianEvidence', count(*) FROM "MeridianEvidence"
UNION ALL SELECT 'apaga', 'MeridianResponse', count(*) FROM "MeridianResponse"
UNION ALL SELECT 'apaga', 'MeridianOverride', count(*) FROM "MeridianOverride"
UNION ALL SELECT 'apaga', 'MeridianAxisScore', count(*) FROM "MeridianAxisScore"
UNION ALL SELECT 'apaga', 'MeridianRespondent', count(*) FROM "MeridianRespondent"
UNION ALL SELECT 'apaga', 'MeridianAssessment', count(*) FROM "MeridianAssessment"
UNION ALL SELECT 'apaga', 'MeridianBenchmarkContribution', count(*) FROM "MeridianBenchmarkContribution"
UNION ALL SELECT 'apaga', 'MeridianBenchmarkCohort', count(*) FROM "MeridianBenchmarkCohort"
UNION ALL SELECT 'apaga', 'MeridianSequence', count(*) FROM "MeridianSequence"
UNION ALL SELECT 'mantém', 'MeridianTemplate', count(*) FROM "MeridianTemplate"
UNION ALL SELECT 'mantém', 'MeridianQuestion', count(*) FROM "MeridianQuestion"
UNION ALL SELECT 'mantém', 'MeridianMembership', count(*) FROM "MeridianMembership";
