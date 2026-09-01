-- Consentimento de gravação — passos 1-4 de
-- docs/compliance/consentimento-de-gravacao.md §7.
--
-- Aplica ao pipeline de reunião os três princípios que o Meridian já usa
-- (MeridianAssessment.benchmarkOptIn, ver actions/(meridian)/benchmark.ts):
-- default deny no schema, portão antes do processamento, revogação com
-- efeito material. O portão em si (fireflies-transcript.ts / fathom-transcript.ts /
-- fireflies-insights.ts) e as actions de liberar/negar/revogar não moram
-- aqui — só o schema.
--
-- Puramente aditiva: nenhuma coluna existente é alterada além do ADD COLUMN.

-- AlterTable: MeetingIntegration — nível 1 (modo de consentimento da integração)
ALTER TABLE "MeetingIntegration"
  ADD COLUMN "consentMode" TEXT NOT NULL DEFAULT 'PER_MEETING',
  ADD COLUMN "standingConsentRef" TEXT;

-- STANDING não é uma caixa de seleção: habilitá-lo exige apontar para a
-- declaração escrita que sustenta a base legal (ver §4 do desenho). Isso é
-- garantido no schema, não só na aplicação — mesmo um caminho de código que
-- esqueça de validar não consegue persistir STANDING sem a referência.
ALTER TABLE "MeetingIntegration"
  ADD CONSTRAINT "MeetingIntegration_standing_requires_ref"
  CHECK ("consentMode" <> 'STANDING' OR "standingConsentRef" IS NOT NULL);

-- AlterTable: MeetingTranscript — nível 2 (estado de consentimento por transcrição)
--
-- Default deny: toda linha nasce PENDING — inclusive as que já existem no
-- banco antes desta migration, porque um ADD COLUMN com DEFAULT aplica o
-- valor a elas também. Isso é default deny aplicado retroativamente, e é o
-- comportamento correto: nenhuma transcrição histórica tinha consentimento
-- registrado, então nenhuma pode virar GRANTED por omissão. Não é descuido a
-- "consertar" depois migrando essas linhas para GRANTED.
ALTER TABLE "MeetingTranscript"
  ADD COLUMN "consentState" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "consentGrantedBy" TEXT,
  ADD COLUMN "consentGrantedRef" TEXT,
  ADD COLUMN "consentGrantedAt" TIMESTAMP(3);

-- RLS já cobre as duas tabelas desde 20260728010000_rls_remaining_tenant_tables
-- (policy "tenant_isolation" por "tenantId") — colunas novas não precisam de
-- policy própria, e nenhuma tabela nova foi criada aqui.
