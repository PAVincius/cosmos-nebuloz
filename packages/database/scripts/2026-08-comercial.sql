-- Catálogo comercial: planos, preço de módulo, termos de contrato e add-ons.
--
-- Valores em CENTAVOS inteiros. As sementes são as do handoff de design
-- (design_handoff_bigbang/DATA-MODEL.md §3.1) — a partir daqui, preço se muda
-- pelo back-office, sem deploy.
--
-- Idempotente: rodar de novo não duplica nem sobrescreve preço já ajustado.

BEGIN;

CREATE TABLE IF NOT EXISTS "PlanoComercial" (
  "id"                   TEXT PRIMARY KEY,
  "tenantId"             TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "slug"                 TEXT NOT NULL,
  "nome"                 TEXT NOT NULL,
  "ordem"                INTEGER NOT NULL DEFAULT 0,
  "precoAssentoCentavos" INTEGER NOT NULL,
  "minimoAssentos"       INTEGER NOT NULL DEFAULT 1,
  "limiteUsuarios"       INTEGER,
  "permiteRolesCustom"   BOOLEAN NOT NULL DEFAULT false,
  "ativo"                BOOLEAN NOT NULL DEFAULT true,
  "criadoEm"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanoComercial_tenantId_slug_key" ON "PlanoComercial" ("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "PlanoComercial_tenantId_ativo_idx" ON "PlanoComercial" ("tenantId", "ativo");

CREATE TABLE IF NOT EXISTS "PrecoDeModulo" (
  "id"                  TEXT PRIMARY KEY,
  "tenantId"            TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "modulo"              "ProductModule" NOT NULL,
  "precoMensalCentavos" INTEGER NOT NULL DEFAULT 0,
  "atualizadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PrecoDeModulo_tenantId_modulo_key" ON "PrecoDeModulo" ("tenantId", "modulo");

CREATE TABLE IF NOT EXISTS "TermoDeContrato" (
  "id"              TEXT PRIMARY KEY,
  "tenantId"        TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "slug"            TEXT NOT NULL,
  "nome"            TEXT NOT NULL,
  "meses"           INTEGER NOT NULL,
  "descontoPercent" INTEGER NOT NULL DEFAULT 0,
  "ordem"           INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "TermoDeContrato_tenantId_slug_key" ON "TermoDeContrato" ("tenantId", "slug");

CREATE TABLE IF NOT EXISTS "AddOnComercial" (
  "id"               TEXT PRIMARY KEY,
  "tenantId"         TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "slug"             TEXT NOT NULL,
  "nome"             TEXT NOT NULL,
  "nota"             TEXT,
  "precoCentavos"    INTEGER NOT NULL,
  "recorrente"       BOOLEAN NOT NULL DEFAULT true,
  "exigeRolesCustom" BOOLEAN NOT NULL DEFAULT false,
  "ativo"            BOOLEAN NOT NULL DEFAULT true,
  "ordem"            INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "AddOnComercial_tenantId_slug_key" ON "AddOnComercial" ("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "AddOnComercial_tenantId_ativo_idx" ON "AddOnComercial" ("tenantId", "ativo");

-- ── Sementes ────────────────────────────────────────────────────────────────
-- `ON CONFLICT DO NOTHING`: se o preço já foi ajustado pelo back-office, a
-- semente não o desfaz. Este script pode rodar de novo sem medo.

INSERT INTO "PlanoComercial"
  ("id", "tenantId", "slug", "nome", "ordem", "precoAssentoCentavos", "minimoAssentos", "limiteUsuarios", "permiteRolesCustom")
VALUES
  (gen_random_uuid()::text, 'system', 'starter',    'Starter',     1,  8900, 10,   25, false),
  (gen_random_uuid()::text, 'system', 'scale',      'Scale',       2, 14900, 25,  100, false),
  (gen_random_uuid()::text, 'system', 'enterprise', 'Enterprise',  3, 21900, 50, NULL, true)
ON CONFLICT ("tenantId", "slug") DO NOTHING;

-- COSMOS entra no preço do assento; os demais são adicionais mensais.
--
-- O JOIN com `pg_enum` não é preciosismo: o schema Prisma pode declarar valores
-- que o enum deste banco ainda não tem. Listar todos direto derruba a
-- transação inteira por causa dos que não existem aqui — e o preço dos que
-- existem não entra. Assim, semeia o que o banco conhece hoje; quando os
-- outros forem criados, rodar de novo completa o catálogo sem tocar no que já
-- está lá.
--
-- MERIDIAN entrou no enum com a migration 20260829120000_meridian_diagnose, e
-- é por isso que ele deixa de ser pulado agora. SCAFFOLD continua fora: o
-- produto não existe no repositório, e preço de algo que ninguém entrega é
-- promessa, não catálogo.
INSERT INTO "PrecoDeModulo" ("id", "tenantId", "modulo", "precoMensalCentavos")
SELECT gen_random_uuid()::text, 'system', e.enumlabel::"ProductModule", v.preco
FROM (
  VALUES
    ('COSMOS',        0),
    ('CHARTER',  180000),
    ('SIGNAL',   120000),
    ('MERIDIAN', 120000),
    ('SCAFFOLD',      0)
) AS v(modulo, preco)
JOIN pg_type t ON t.typname = 'ProductModule'
JOIN pg_enum e ON e.enumtypid = t.oid AND e.enumlabel = v.modulo
ON CONFLICT ("tenantId", "modulo") DO NOTHING;

INSERT INTO "TermoDeContrato" ("id", "tenantId", "slug", "nome", "meses", "descontoPercent", "ordem")
VALUES
  (gen_random_uuid()::text, 'system', 'MENSAL', 'Mensal',  1,  0, 1),
  (gen_random_uuid()::text, 'system', 'ANUAL',  'Anual',  12, 12, 2),
  (gen_random_uuid()::text, 'system', 'BIENAL', 'Bienal', 24, 20, 3)
ON CONFLICT ("tenantId", "slug") DO NOTHING;

INSERT INTO "AddOnComercial"
  ("id", "tenantId", "slug", "nome", "nota", "precoCentavos", "recorrente", "exigeRolesCustom", "ordem")
VALUES
  (gen_random_uuid()::text, 'system', 'sso',        'SSO / SAML dedicado',       'IdP próprio, múltiplos grupos',  90000, true,  true,  1),
  (gen_random_uuid()::text, 'system', 'onboarding', 'Onboarding assistido',      'one-time · 4 semanas com CS',   650000, false, false, 2),
  (gen_random_uuid()::text, 'system', 'bpmn',       'Modelagem BPMN hospedada',  'editor no tenant, versionado',   70000, true,  false, 3),
  (gen_random_uuid()::text, 'system', 'sla',        'SLA 99,9% + suporte 8×5',   'canal dedicado',                150000, true,  false, 4)
ON CONFLICT ("tenantId", "slug") DO NOTHING;

COMMIT;

-- Conferência:
--   SELECT slug, "precoAssentoCentavos", "minimoAssentos", "limiteUsuarios" FROM "PlanoComercial" ORDER BY ordem;
--   SELECT modulo, "precoMensalCentavos" FROM "PrecoDeModulo" ORDER BY modulo;
--   SELECT slug, meses, "descontoPercent" FROM "TermoDeContrato" ORDER BY ordem;
--   SELECT slug, "precoCentavos", recorrente FROM "AddOnComercial" ORDER BY ordem;
