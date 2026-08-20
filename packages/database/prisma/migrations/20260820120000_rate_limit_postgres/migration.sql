-- Teto de requisição no Postgres, no lugar do Upstash.
--
-- O Upstash nunca foi provisionado nesta conta (NEB-143/NEB-144): o teto do
-- back-office nunca valeu, e o portão do copiloto — que falha fechado por
-- desenho — recusaria toda requisição de produção no dia em que o app ganhasse
-- domínio público. A escolha aqui é deliberada: em vez de criar a infra que
-- faltava, o contador passa a viver no banco que já existe.
--
-- O custo aceito: uma escrita por requisição limitada, no mesmo banco que o
-- teto protege. Ao tráfego atual — dezenas de operadores, webhooks de baixo
-- volume — isso é ruído. Se um dia o limite virar gargalo de banco, o sinal
-- será visível em métrica de conexão, e aí Redis volta a ser conversa.
--
-- Janela fixa por (key, bucket). Idempotente como as anteriores.

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "bucket" BIGINT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key", "bucket")
);

CREATE INDEX IF NOT EXISTS "RateLimitBucket_expiresAt_idx"
    ON "RateLimitBucket"("expiresAt");
