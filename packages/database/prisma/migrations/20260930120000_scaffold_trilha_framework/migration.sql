-- Mínimo de schema da trilha de framework (D-24, docs/produto/trilhas/
-- framework-no-scaffold.md §3). Sem tabela nova e sem mudança na instância.
--
--   F3  ScaffoldTemplate.archetype passa a aceitar NULL. Nulo = trilha de
--       framework (governança), que não tem forma de trabalho. Nenhum dado muda.
--   F1  ScaffoldDeliverableTemplate.requirementRefs: lista de
--       { set, versao, codigo } apontando o catálogo do Charter pelo que é
--       estável entre ambientes. Sem FK (o Scaffold não depende do Charter
--       contratado). Nula quando o entregável não cita norma; o CHECK só garante
--       que, se houver valor, é uma lista.
--
--   D-27  ScaffoldTrack.sourceAssessmentId: o diagnóstico (assessment) do
--       Meridian que originou a trilha. Sem FK, como sourceGapId.
--
-- A dispensa de entregável já existe (dispensedReason + required) e não muda.
-- F2 (perfil da organização) fica fora.

ALTER TABLE "ScaffoldTemplate" ALTER COLUMN "archetype" DROP NOT NULL;

ALTER TABLE "ScaffoldDeliverableTemplate" ADD COLUMN "requirementRefs" JSONB;
ALTER TABLE "ScaffoldDeliverableTemplate" ADD CONSTRAINT "ScaffoldDeliverableTemplate_requirementRefs_lista"
  CHECK ("requirementRefs" IS NULL OR jsonb_typeof("requirementRefs") = 'array');

ALTER TABLE "ScaffoldTrack" ADD COLUMN "sourceAssessmentId" TEXT;
CREATE INDEX "ScaffoldTrack_tenantId_sourceAssessmentId_idx" ON "ScaffoldTrack"("tenantId", "sourceAssessmentId");
