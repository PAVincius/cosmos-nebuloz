-- Corrige a duplicação de termos criada por 2026-09-catalogo-nebuloz.sql.
--
-- O QUE ACONTECEU
--   O catálogo veio com os prazos identificados como `monthly` / `annual` /
--   `biennial` (os ids do JSON). O banco já tinha os mesmos três prazos, com os
--   MESMOS valores, sob os slugs `MENSAL` / `ANUAL` / `BIENAL`, vindos do
--   2026-08-comercial.sql. Como o UPSERT casa por slug, nada foi atualizado:
--   foram inseridos três novos. Resultado: seis prazos, dois de cada.
--
-- POR QUE APAGAR OS NOVOS E NÃO OS ANTIGOS
--   `Proposal.termoSlug` guarda o slug como texto, não como chave estrangeira.
--   Toda proposta já feita aponta para MENSAL/ANUAL/BIENAL. Apagar esses
--   deixaria o prazo dessas propostas sem resolver — e o histórico comercial é
--   justamente o que não pode quebrar. Os três novos não têm nenhuma proposta
--   apontando para eles, porque nasceram há minutos.
--
--   Os valores são idênticos (1/12/24 meses, 0/12/20%), então não se perde
--   nada: os antigos já dizem o que o catálogo novo diria.

BEGIN;

-- 1. Antes de apagar, mostra se alguma proposta aponta para os slugs novos.
--    Se esta consulta voltar qualquer linha, PARE e me chame: significa que
--    alguém montou proposta nos poucos minutos entre a carga e esta correção,
--    e aí apagar o prazo quebraria essa proposta.
SELECT "termoSlug", count(*) AS propostas
FROM "Proposal"
WHERE "tenantId" = 'system'
  AND "termoSlug" IN ('monthly', 'annual', 'biennial')
GROUP BY "termoSlug";

-- 2. Apaga só os três duplicados, e só se ninguém os referencia.
DELETE FROM "TermoDeContrato"
WHERE "tenantId" = 'system'
  AND slug IN ('monthly', 'annual', 'biennial')
  AND slug NOT IN (
    SELECT DISTINCT "termoSlug"
    FROM "Proposal"
    WHERE "tenantId" = 'system' AND "termoSlug" IS NOT NULL
  );

COMMIT;

-- 3. Confere: devem sobrar três, os originais.
SELECT slug, nome, meses, "descontoPercent", ordem
FROM "TermoDeContrato"
WHERE "tenantId" = 'system'
ORDER BY ordem;
