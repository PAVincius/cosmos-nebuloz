-- MeetingParticipant — docs/compliance/consentimento-de-gravacao.md §7, passo 6.
--
-- Pré-requisito de DSR: sem isto não há como saber que dados de um titular
-- estão numa reunião, nem escopar consentimento a quem estava na sala.
--
-- Fail closed, e este é o ponto central da migration: "participantsKnown"
-- nasce false em toda transcrição (inclusive as que já existem no banco —
-- mesmo efeito retroativo do ADD COLUMN com DEFAULT já usado em
-- 20260901130000_meeting_consent). Só vira true quando o provedor devolveu
-- os dois campos necessários para a subtração de listas (participants menos
-- workspace_users, ver §4 e fireflies-normalize.ts). Ausência de dado —
-- plano não expõe, resposta parcial — é desconhecida, não é "sem externo".
-- É essa distinção que o passo 7 (gate de STANDING) lê antes de liberar uma
-- transcrição sozinha.

ALTER TABLE "MeetingTranscript"
  ADD COLUMN "participantsKnown" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MeetingParticipant" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "transcriptId" TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "name"         TEXT,
  "isOrganizer"  BOOLEAN NOT NULL DEFAULT false,
  "isExternal"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MeetingParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingParticipant" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "MeetingParticipant"
  USING ("tenantId" = current_tenant_id());

CREATE UNIQUE INDEX "MeetingParticipant_tenantId_transcriptId_email_key"
  ON "MeetingParticipant"("tenantId", "transcriptId", "email");
CREATE INDEX "MeetingParticipant_tenantId_idx"       ON "MeetingParticipant"("tenantId");
CREATE INDEX "MeetingParticipant_transcriptId_idx"   ON "MeetingParticipant"("transcriptId");
CREATE INDEX "MeetingParticipant_tenantId_email_idx" ON "MeetingParticipant"("tenantId", "email");

ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_transcriptId_fkey"
  FOREIGN KEY ("transcriptId") REFERENCES "MeetingTranscript"("id") ON DELETE CASCADE;
