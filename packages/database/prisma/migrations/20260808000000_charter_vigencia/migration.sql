-- Vigência de norma no mapa de conformidade.
--
-- Até aqui, um conjunto de exigências carregava jurisdição, origem e licença —
-- e nenhuma noção de QUANDO obriga. Duas consequências, ambas visíveis para
-- quem compra:
--
-- 1. LGPD (lei) e PL 2338/2023 (projeto aprovado no Senado, em tramitação na
--    Câmara) chegavam ao mapa com o mesmo peso. Responder a um comprador que
--    se "atende" um projeto de lei é afirmação sobre obrigação que não existe.
-- 2. O AI Act quebra DENTRO do próprio conjunto: o Art. 50 obriga desde
--    2 ago 2026, a marcação do Art. 50(2) recebeu carência até 2 dez 2026, e o
--    alto risco do Anexo III está proposto para 2 dez 2027 por alteração ainda
--    em trílogo. Um único status por conjunto não expressa isso.
--
-- Daí os dois pares de datas: `vigenciaEm` é o texto em vigor,
-- `vigenciaPropostaEm` é a alteração em trâmite. Guardar as duas é recusa
-- deliberada de apostar em qual prevalece — a tela mostra os dois cenários e
-- quem lê escolhe.
--
-- No requisito os campos são anuláveis e sobrepõem o conjunto quando
-- presentes; nulos herdam. Idempotente como as anteriores: reexecutar não pode
-- falhar.

DO $$ BEGIN
    CREATE TYPE "CharterNormaStatus" AS ENUM ('VIGENTE', 'PROPOSTO', 'ADIADO', 'REVOGADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CharterRequirementSet"
    ADD COLUMN IF NOT EXISTS "normaStatus" "CharterNormaStatus" NOT NULL DEFAULT 'VIGENTE',
    ADD COLUMN IF NOT EXISTS "vigenciaEm" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "vigenciaPropostaEm" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "notaVigencia" TEXT;

-- Sem DEFAULT aqui, e a ausência é a especificação: nulo significa "herda do
-- conjunto". Um DEFAULT 'VIGENTE' tornaria toda exigência uma afirmação
-- própria de vigência, e a herança — que é o caso comum — deixaria de existir.
ALTER TABLE "CharterRequirement"
    ADD COLUMN IF NOT EXISTS "normaStatus" "CharterNormaStatus",
    ADD COLUMN IF NOT EXISTS "vigenciaEm" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "vigenciaPropostaEm" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "notaVigencia" TEXT;

CREATE INDEX IF NOT EXISTS "CharterRequirementSet_normaStatus_idx"
    ON "CharterRequirementSet"("normaStatus");
