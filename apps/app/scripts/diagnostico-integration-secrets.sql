-- Quais integrações ainda têm segredo em texto plano.
--
-- SOMENTE LEITURA, e não imprime nenhum valor de credencial — só o nome do
-- campo. Serve para conferir o alcance antes de rodar o backfill e para provar
-- depois que ele fechou tudo (a segunda execução tem de voltar vazia).
--
-- Par do `scripts/backfill-integration-secrets.ts`. A cifragem em si não cabe
-- aqui: é AES-256-GCM com IV aleatório por valor e tag de autenticação, e o
-- pgcrypto do Postgres só faz CBC/ECB — não tem GCM nem produz tag. Um UPDATE
-- em SQL geraria valor que o decryptSecret não consegue ler.
--
-- Uso:
--   psql "$DATABASE_URL" -f scripts/diagnostico-integration-secrets.sql
--
-- Um valor já cifrado é o envelope que encryptSecret produz:
--   {"iv":"<base64>","tag":"<base64>","data":"<base64>"}
-- Qualquer string que não comece com {"iv": está em claro.

WITH campos AS (
  -- Espelha SECRET_FIELDS de packages/security/encrypt.ts.
  SELECT unnest(ARRAY[
    'apiToken', 'pat', 'apiKey', 'token', 'password', 'secret', 'webhookUrl'
  ]) AS campo
)
SELECT
  i."tenantId",
  i.source,
  i.name,
  i."createdAt"::date AS criada_em,
  string_agg(c.campo, ', ' ORDER BY c.campo) AS campos_em_claro
FROM "Integration" i
CROSS JOIN campos c
WHERE
  -- Só campo secreto que existe e é string.
  jsonb_typeof(i.config -> c.campo) = 'string'
  -- Que não é envelope cifrado.
  AND (i.config ->> c.campo) !~ '^\{"iv":'
  -- String vazia não é credencial.
  AND length(i.config ->> c.campo) > 0
GROUP BY i.id, i."tenantId", i.source, i.name, i."createdAt"
ORDER BY i."createdAt";
