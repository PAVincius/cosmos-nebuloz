-- Fecha o drift entre a cadeia de migrations e o schema.
--
-- O job Schema Drift Check aplica todas as migrations num Postgres vazio e
-- compara o resultado com prisma/schema. Duas diferenças sobreviviam:
--
-- 1. CharterCoverage.atualizadoEm tinha DEFAULT no banco e não no schema. O
--    campo é `@updatedAt`, que o Prisma escreve em toda gravação — um DEFAULT
--    aqui só mascara o caso em que o client NÃO escreveu, e o valor fica
--    plausível sem ser verdadeiro.
-- 2. O índice de CharterPolicyLink foi renomeado no schema quando o campo
--    virou par alvoTipo/alvoId, e a migration correspondente nunca existiu.
--
-- Idempotente como as anteriores: reexecutar não pode falhar.

ALTER TABLE "CharterCoverage" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- ALTER INDEX resolve o índice como relation internamente: se ele não
-- existir, o erro é undefined_table (42P01), não undefined_object (42704).
-- O handler original só cobria undefined_object e nunca casava — a migration
-- abortava com "relation ... does not exist" em qualquer banco onde o índice
-- antigo não existisse (confirmado na prática). Cobre os dois para manter a
-- intenção original: ignorar a ausência do índice.
DO $$ BEGIN
    ALTER INDEX "CharterPolicyLink_tenantId_alvo_idx"
        RENAME TO "CharterPolicyLink_tenantId_alvoTipo_alvoId_idx";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;
