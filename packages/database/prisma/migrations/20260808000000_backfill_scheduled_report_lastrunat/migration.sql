-- Antes desta migration nada escrevia `lastRunAt`: a varredura que o consome é
-- nova. Todo relatório habilitado tem NULL, e `isDue` lê NULL como "nunca rodou,
-- logo venceu" — o primeiro cron após o deploy dispararia todos de uma vez, com
-- email real, em todos os tenants.
--
-- Marcar `now()` faz cada relatório esperar seu próximo horário legítimo. Perde-se
-- no máximo uma ocorrência do primeiro ciclo, o que é preferível a uma avalanche.
UPDATE "ScheduledReport"
SET "lastRunAt" = now()
WHERE "lastRunAt" IS NULL AND "enabled" = true;
