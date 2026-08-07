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

DO $$ BEGIN
    ALTER INDEX "CharterPolicyLink_tenantId_alvo_idx"
        RENAME TO "CharterPolicyLink_tenantId_alvoTipo_alvoId_idx";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
