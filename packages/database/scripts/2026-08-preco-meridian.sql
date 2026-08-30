-- Preço do Meridian no catálogo comercial.
--
-- `2026-08-comercial.sql` já semeia os cinco módulos, mas pula os que o enum
-- do banco não conhece (o `JOIN pg_enum` lá). Em ambiente que rodou aquele
-- script antes da migration `20260829120000_meridian_diagnose`, o Meridian
-- ficou de fora e não volta sozinho: o `ON CONFLICT DO NOTHING` de lá não
-- reinsere o que faltou. Este script completa esse caso sem exigir rodar o
-- outro inteiro de novo.
--
-- Por que isso importa: `proposta-escopo` valida os módulos contra
-- `PrecoDeModulo`, e não contra o enum — que é o acerto do 92feae03. Sem a
-- linha aqui, proposta que inclua o Meridian é recusada em runtime com
-- "Módulo fora do catálogo", mesmo com o módulo existindo no schema.
--
-- Idempotente. Rodar duas vezes não duplica nem sobrescreve preço ajustado à
-- mão.

BEGIN;

-- A guarda não é preciosismo. Sem ela, num banco onde a migration ainda não
-- rodou, o INSERT abaixo encontraria o enum sem 'MERIDIAN', o cast falharia e
-- — pior — numa versão sem cast o script terminaria com sucesso sem inserir
-- nada. Sucesso silencioso é o resultado mais caro possível aqui: o operador
-- vai embora achando que resolveu, e a recusa só aparece na primeira proposta.
--
-- Deliberadamente NÃO fazemos `ALTER TYPE ... ADD VALUE` aqui. A migration
-- 20260829120000_meridian_diagnose adiciona o valor sem `IF NOT EXISTS`;
-- adicioná-lo à mão antes faz aquele passo quebrar no `migrate deploy`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ProductModule' AND e.enumlabel = 'MERIDIAN'
  ) THEN
    RAISE EXCEPTION
      'ProductModule nao tem MERIDIAN. Rode antes: prisma migrate deploy (20260829120000_meridian_diagnose)';
  END IF;
END $$;

-- R$ 1.200/mês, mesma faixa do Signal. `tenantId = 'system'` é onde vive o
-- catálogo da plataforma, como nas demais linhas de PrecoDeModulo.
INSERT INTO "PrecoDeModulo" ("id", "tenantId", "modulo", "precoMensalCentavos")
VALUES (gen_random_uuid()::text, 'system', 'MERIDIAN', 120000)
ON CONFLICT ("tenantId", "modulo") DO NOTHING;

COMMIT;

-- Conferência dentro do próprio script, e não como comentário: o modo de falha
-- que este arquivo existe para evitar é justamente o de terminar sem erro e
-- sem efeito. Esperado: COSMOS 0, CHARTER 180000, SIGNAL 120000,
-- MERIDIAN 120000. SCAFFOLD ausente enquanto o produto não existir.
SELECT modulo, "precoMensalCentavos"
FROM "PrecoDeModulo"
WHERE "tenantId" = 'system'
ORDER BY modulo;
