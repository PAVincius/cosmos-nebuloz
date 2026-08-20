-- Alinha a tabela TwoFactor com o schema que o plugin do better-auth grava.
--
-- Sintoma: 500 em POST /api/auth/two-factor/enable, com
--
--   Invalid `prisma.twoFactor.create()` invocation
--   Unknown argument `verified`
--
-- A migration 20260518012140_add_two_factor criou a tabela contra uma versão
-- anterior do plugin. Desde então ele passou a gravar `verified`,
-- `failedVerificationCount` e `lockedUntil` — e o adapter do Prisma recusa a
-- escrita inteira quando uma dessas colunas não existe. Nada disso aparece em
-- build nem em teste: a lib monta o `create` em tempo de execução.
--
-- `verified` entra com DEFAULT true seguindo a própria lib: linha que já
-- existia é anterior ao conceito de verificação e deve continuar valendo como
-- método de login. O `enable` grava `false` explicitamente ao criar, e só o
-- `verifyTotp` promove para true.
--
-- O UNIQUE de userId também sai. A lib declara índice, não unicidade, e o
-- `enable` faz `create` puro: com o UNIQUE, o segundo cadastro do mesmo usuário
-- — depois de abandonar um, ou ao trocar de método — violaria P2002 e devolveria
-- outro 500, com uma mensagem tão pouco informativa quanto a primeira.
--
-- Idempotente: reexecutar não pode falhar.

ALTER TABLE "TwoFactor"
    ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

DROP INDEX IF EXISTS "TwoFactor_userId_key";

CREATE INDEX IF NOT EXISTS "TwoFactor_userId_idx" ON "TwoFactor"("userId");
