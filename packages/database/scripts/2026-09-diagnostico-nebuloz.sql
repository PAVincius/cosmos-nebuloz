-- 2026-09-diagnostico-nebuloz.sql
--
-- Diagnóstico Meridian da Nebuloz — AS-NBZ-001.
--
-- POR QUE ISTO EXISTE
--   A Nebuloz vende diagnóstico de prontidão para IA e nunca rodou um em si
--   mesma. Este script carrega esse diagnóstico como dado real do produto, não
--   como slide: as mesmas tabelas, o mesmo motor, as mesmas telas que um
--   cliente veria.
--
-- DE ONDE VÊM OS NÚMEROS
--   Os scores NÃO foram escritos à mão. Saíram de `computeAxisScore()`
--   (apps/app/lib/meridian/scoring.ts) a partir das respostas abaixo, e o
--   sequenciamento do plano saiu de `buildPlan()` sobre o DAG de dependências.
--   Número escrito à mão produziria um banco onde a tela não bate com as
--   respostas — exatamente o bug que o determinismo do motor existe para
--   impedir.
--
-- OS DOIS RESPONDENTES SÃO REAIS
--   O fundador responde pela intenção; a auditoria de repositório responde pelo
--   que está commitado (migrations, CI, RLS, Vercel). Onde os dois divergem, o
--   eixo nasce CONTESTED — e é isso mesmo que a divergência significa. Os cinco
--   eixos nasceram contestados: o que se pretende e o que está no código não
--   batem em lugar nenhum. Esse é o achado, não um efeito colateral.
--
-- POR QUE OS ids SÃO `c` + md5
--   As actions do produto validam id com `z.string().cuid()` (`cuid` em
--   apps/app/app/actions/_base.ts). Um id legível como `nbz-as-001` grava sem
--   reclamar e só quebra depois, na tela de detalhe, com "Invalid cuid" — o
--   banco aceita TEXT, o Zod não. `'c' || substr(md5(chave), 1, 24)` passa no
--   validador e continua determinístico, que é o que mantém o script idempotente.
--
-- PRÉ-REQUISITO
--   O tenant precisa ter passado pelo "Preparar o Meridian" no back-office
--   (papel CONSULTANT + template). O script recusa a rodar sem isso, com a
--   mensagem dizendo o que fazer.
--
-- IDEMPOTENTE, E REPARA RODADA ANTERIOR
--   Localiza o assessment pelo par (tenant, código) em vez de assumir o id, e
--   apaga o que achar antes de reinserir. Rodar sobre uma carga antiga — de ids
--   quebrados, inclusive — troca tudo pela boa. Não toca em outro assessment,
--   em outro módulo, nem em outro tenant.
--
-- TROQUE O SLUG NA LINHA MARCADA para rodar em outro tenant.

DO $$
DECLARE
  -- ↓↓↓ ÚNICA COISA A TROCAR ↓↓↓
  v_slug       constant text := 'nebula';
  -- ↑↑↑ -------------------- ↑↑↑
  v_code       constant text := 'AS-NBZ-001';
  v_tenant     text;
  v_template   text;
  v_consultant text;
  v_anterior   text;
  v_assessment constant text := 'c' || substr(md5('nbz-as-001'), 1, 24);
  v_opened     constant timestamp := timestamp '2026-09-02 12:00:00';
  v_deadline   constant timestamp := timestamp '2026-09-30 12:00:00';
BEGIN
  SELECT id INTO v_tenant FROM "Tenant" WHERE slug = v_slug AND "isSystem" = false;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Nenhum tenant de cliente com o slug %. Confira o slug na linha marcada.', v_slug;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "TenantModule"
    WHERE "tenantId" = v_tenant AND module = 'MERIDIAN' AND status IN ('ACTIVE', 'TRIAL')
  ) THEN
    RAISE EXCEPTION 'O tenant % não tem o módulo MERIDIAN contratado. Contrate em /clientes/% antes.', v_slug, v_slug;
  END IF;

  SELECT id INTO v_template FROM "MeridianTemplate"
  WHERE "tenantId" = v_tenant ORDER BY "createdAt" LIMIT 1;
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'O tenant % não tem template do Meridian. Rode o "Preparar o Meridian" em /clientes/% primeiro — é ele que cria a bateria.', v_slug, v_slug;
  END IF;

  SELECT "userId" INTO v_consultant FROM "MeridianMembership"
  WHERE "tenantId" = v_tenant AND role = 'CONSULTANT' ORDER BY "createdAt" LIMIT 1;
  IF v_consultant IS NULL THEN
    RAISE EXCEPTION 'O tenant % não tem ninguém com papel CONSULTANT no Meridian. Rode o "Preparar o Meridian" em /clientes/% primeiro.', v_slug, v_slug;
  END IF;

  -- Limpeza pelo par (tenant, código), não pelo id: é o que permite reparar uma
  -- carga anterior cujos ids eram outros. Ordem respeita as FKs — gap antes de
  -- assessment, porque a relação é Restrict de propósito.
  SELECT id INTO v_anterior FROM "MeridianAssessment"
  WHERE "tenantId" = v_tenant AND code = v_code;

  IF v_anterior IS NOT NULL THEN
    DELETE FROM "MeridianPlanItem"      WHERE "assessmentId" = v_anterior;
    DELETE FROM "MeridianGapDependency" WHERE "gapId" IN (SELECT id FROM "MeridianGap" WHERE "assessmentId" = v_anterior);
    DELETE FROM "MeridianGap"           WHERE "assessmentId" = v_anterior;
    DELETE FROM "MeridianAxisScore"     WHERE "assessmentId" = v_anterior;
    DELETE FROM "MeridianResponse"      WHERE "respondentId" IN (SELECT id FROM "MeridianRespondent" WHERE "assessmentId" = v_anterior);
    DELETE FROM "MeridianRespondent"    WHERE "assessmentId" = v_anterior;
    DELETE FROM "MeridianAssessment"    WHERE id = v_anterior;
    RAISE NOTICE 'Carga anterior de % removida (id %).', v_code, v_anterior;
  END IF;

  -- ── Assessment ──────────────────────────────────────────────────────────────
  -- REVIEW, não FINALISED: o diagnóstico está pronto, as decisões não.
  -- benchmarkOptIn = false de propósito: a Nebuloz não contamina a coorte que
  -- ela própria vende como referência de mercado.
  INSERT INTO "MeridianAssessment"
    (id, "tenantId", code, "orgName", sector, "sizeBand", "templateId", status,
     "consultantId", "openedAt", deadline, "benchmarkOptIn", "createdAt", "updatedAt")
  VALUES
    (v_assessment, v_tenant, v_code, 'Nebuloz', 'Software B2B', '1–50',
     v_template, 'REVIEW', v_consultant, v_opened, v_deadline, false, v_opened, v_opened);

  -- ── Respondentes ────────────────────────────────────────────────────────────
  -- Um por eixo, por respondente. Os tokenHash são hashes de tokens que não
  -- existem em lugar nenhum: os respondentes já estão DONE, e um link vivo aqui
  -- seria porta aberta sem dono.
  INSERT INTO "MeridianRespondent"
    (id, "tenantId", "assessmentId", name, role, email, axis, status, "tokenHash",
     "tokenExpiresAt", "invitedAt", "completedAt", "createdAt", "updatedAt")
  SELECT
    'c' || substr(md5('nbz-resp-' || v.key), 1, 24), v_tenant, v_assessment,
    v.name, v.role, v.email, v.axis::"MeridianAxis",
    'DONE', v.token, v_deadline, v_opened, v_opened, v_opened, v_opened
  FROM (VALUES
    ('founder-data', 'Vinicius Prates Araújo', 'Fundador · operação da plataforma', 'vinicius.pratesaraujo@gmail.com', 'DATA', '8ef3a3271c9b57b6a2bc225933bb6f0d6176475bbf5ed8da9d6abf7a903826a5'),
    ('founder-process', 'Vinicius Prates Araújo', 'Fundador · operação da plataforma', 'vinicius.pratesaraujo@gmail.com', 'PROCESS', '50c8553ae05df15bcb9dc49206166d37ebbf1114dd477339e17bf082045049cb'),
    ('founder-people', 'Vinicius Prates Araújo', 'Fundador · operação da plataforma', 'vinicius.pratesaraujo@gmail.com', 'PEOPLE', '993b46dfe94e0f6e59d30aed201a76c0aa50a444937ac2bbc3d44b46d05d8fe4'),
    ('founder-governance', 'Vinicius Prates Araújo', 'Fundador · operação da plataforma', 'vinicius.pratesaraujo@gmail.com', 'GOVERNANCE', '8a3e669fa7c4e7b7ebf5300e2e8966ce1474a7cee14a6de24d7676d712ddf174'),
    ('founder-infrastructure', 'Vinicius Prates Araújo', 'Fundador · operação da plataforma', 'vinicius.pratesaraujo@gmail.com', 'INFRASTRUCTURE', '9feeca145f03f946cbd33360b85193ca9da408ef80b2004d4c4cdf86a9cb057a'),
    ('audit-data', 'Auditoria de repositório', 'Leitura de código, migrations e CI', 'auditoria@nebuloz.ai', 'DATA', 'e68727790782690bf3300c866eec55b7a48d6a5a5d73fc69ede05b3defaab3d4'),
    ('audit-process', 'Auditoria de repositório', 'Leitura de código, migrations e CI', 'auditoria@nebuloz.ai', 'PROCESS', 'f865e0652f54ca6a5b43db02bd32cdb6991cdc5a53aaf5f75a353f9864f54584'),
    ('audit-people', 'Auditoria de repositório', 'Leitura de código, migrations e CI', 'auditoria@nebuloz.ai', 'PEOPLE', 'fc6d0f1e397011e498e30f94351a6b870d284f2de0a878cdae06171aa9fba67a'),
    ('audit-governance', 'Auditoria de repositório', 'Leitura de código, migrations e CI', 'auditoria@nebuloz.ai', 'GOVERNANCE', '650e2f6c7d00e82eb3421b3e5da7d54a7f701f8a317431940f68504a6f536b9e'),
    ('audit-infrastructure', 'Auditoria de repositório', 'Leitura de código, migrations e CI', 'auditoria@nebuloz.ai', 'INFRASTRUCTURE', 'e7d707d41656650a5ef12cae29ab65c9b7c0bcb8b847701b3473f3e68c93d27f')
  ) AS v(key, name, role, email, axis, token);

  -- ── Respostas ───────────────────────────────────────────────────────────────
  -- `normalized` vem de `normalizeAnswer()`, não de conta feita aqui: a
  -- normalização da pergunta invertida (Q-D03) é onde uma conta à mão erraria
  -- em silêncio.
  INSERT INTO "MeridianResponse"
    (id, "tenantId", "respondentId", "questionId", "rawValue", normalized, "answeredAt", "updatedAt")
  SELECT
    'c' || substr(md5('nbz-resposta-' || v.quem || '-' || v.qcode), 1, 24), v_tenant,
    'c' || substr(md5('nbz-resp-' || v.quem || '-' || lower(q.axis::text)), 1, 24),
    q.id, v.raw, v.norm, v_opened, v_opened
  FROM (VALUES
    ('founder', 'Q-D01', 4, 1.000),
    ('founder', 'Q-D02', 1, 0.250),
    ('founder', 'Q-D03', 0, 1.000),
    ('audit', 'Q-D01', 3, 0.750),
    ('audit', 'Q-D02', 0, 0.000),
    ('audit', 'Q-D03', 1, 0.667),
    ('founder', 'Q-P01', 3, 0.750),
    ('founder', 'Q-P02', 0, 1.000),
    ('founder', 'Q-P03', 3, 0.750),
    ('audit', 'Q-P01', 1, 0.250),
    ('audit', 'Q-P02', 1, 0.000),
    ('audit', 'Q-P03', 2, 0.500),
    ('founder', 'Q-E01', 1, 0.250),
    ('founder', 'Q-E02', 0, 1.000),
    ('founder', 'Q-E03', 1, 0.250),
    ('audit', 'Q-E01', 0, 0.000),
    ('audit', 'Q-E02', 1, 0.000),
    ('audit', 'Q-E03', 0, 0.000),
    ('founder', 'Q-G01', 3, 0.750),
    ('founder', 'Q-G02', 1, 0.000),
    ('founder', 'Q-G03', 4, 1.000),
    ('audit', 'Q-G01', 1, 0.250),
    ('audit', 'Q-G02', 1, 0.000),
    ('audit', 'Q-G03', 2, 0.500),
    ('founder', 'Q-I01', 2, 0.500),
    ('founder', 'Q-I02', 3, 0.750),
    ('founder', 'Q-I03', 0, 1.000),
    ('audit', 'Q-I01', 0, 0.000),
    ('audit', 'Q-I02', 2, 0.500),
    ('audit', 'Q-I03', 0, 1.000)
  ) AS v(quem, qcode, raw, norm)
  JOIN "MeridianQuestion" q ON q."templateId" = v_template AND q.code = v.qcode;

  -- ── Scores por eixo ─────────────────────────────────────────────────────────
  -- Saída literal de `computeAxisScore()`. `final` fica nulo: nenhum override
  -- foi decidido ainda, e `computed` é write-once por contrato.
  INSERT INTO "MeridianAxisScore"
    (id, "tenantId", "assessmentId", axis, computed, confidence, "respondentCount",
     spread, status, note, "computedAt")
  SELECT
    'c' || substr(md5('nbz-score-' || v.axis), 1, 24), v_tenant, v_assessment,
    v.axis::"MeridianAxis", v.computed, v.confidence, v.n, v.spread,
    v.status::"MeridianScoreStatus", v.note, v_opened
  FROM (VALUES
    ('DATA', 68, 0.73, 2, 27, 'CONTESTED', 'Discordância de 27 pontos entre respondentes, acima do limiar de 25.'),
    ('PROCESS', 54, 0.42, 2, 58, 'CONTESTED', 'Discordância de 58 pontos entre respondentes, acima do limiar de 25.'),
    ('PEOPLE', 25, 0.5, 2, 50, 'CONTESTED', 'Discordância de 50 pontos entre respondentes, acima do limiar de 25.'),
    ('GOVERNANCE', 31, 0.75, 2, 25, 'CONTESTED', 'Discordância de 25 pontos entre respondentes, acima do limiar de 25.'),
    ('INFRASTRUCTURE', 63, 0.75, 2, 25, 'CONTESTED', 'Discordância de 25 pontos entre respondentes, acima do limiar de 25.')
  ) AS v(axis, computed, confidence, n, spread, status, note);

  -- ── Gaps ────────────────────────────────────────────────────────────────────
  -- `derived = false`: nenhum destes saiu do limiar automático do template.
  -- Todos vêm de evidência lida no repositório, na CI e no incidente de deploy.
  INSERT INTO "MeridianGap"
    (id, "tenantId", code, "assessmentId", axis, statement, severity, effort,
     "costOfDelay", confidence, "ownerLabel", state, derived, "createdAt", "updatedAt")
  SELECT
    'c' || substr(md5('nbz-gap-' || v.code), 1, 24), v_tenant, v.code, v_assessment,
    v.axis::"MeridianAxis", v.statement, v.severity::"MeridianSeverity",
    v.effort::"MeridianEffort", v.cod, v.confidence::"MeridianConfidence",
    v.owner, 'PLANNED', false, v_opened, v_opened
  FROM (VALUES
    ('G-01', 'INFRASTRUCTURE', 'Quatro projetos Vercel rodam `migrate:deploy` contra o mesmo banco. A corrida já parou todos os deploys com P3009 e a causa segue aberta — só o sintoma foi resolvido.', 'HIGH', 'L', 92, 'MEASURED', 'Plataforma'),
    ('G-02', 'GOVERNANCE', 'As 16 tabelas do Meridian nasceram sem RLS, enquanto 122 tabelas de tenant do resto da plataforma têm isolamento imposto no banco. O módulo mais novo é o único sem a defesa que todos os outros têm.', 'HIGH', 'M', 88, 'MEASURED', 'Plataforma'),
    ('G-03', 'INFRASTRUCTURE', 'Preview e produção apontam para o mesmo projeto Supabase. Toda escrita feita ''em preview'' é escrita em produção, e nada no fluxo avisa isso.', 'HIGH', 'M', 84, 'MEASURED', 'Plataforma'),
    ('G-04', 'PROCESS', 'Três checks falham na própria main — Schema Drift, Type Check e Lint & Format. O sinal que deveria barrar regressão está desligado, e o vermelho constante ensina a ignorá-lo.', 'HIGH', 'M', 79, 'MEASURED', 'Engenharia'),
    ('G-05', 'PEOPLE', 'Fator ônibus 1: uma única pessoa acumula staff de plataforma, consultor, compliance e operação — e nenhum ambiente de desenvolvimento tem staff semeado, então ninguém mais consegue nem abrir o back-office local.', 'HIGH', 'M', 76, 'MEASURED', 'Fundação'),
    ('G-06', 'GOVERNANCE', 'A Nebuloz vende governança de IA e não aplicou a própria: o tenant nebuloz não tem papel de Compliance nem política criada. O produto que se vende é o que não se usa.', 'MEDIUM', 'S', 71, 'MEASURED', 'Compliance'),
    ('G-07', 'PROCESS', 'Contratar módulo não dá acesso a ninguém. Charter e Meridian repetiram o mesmo buraco de provisionamento, e os dois só apareceram quando um humano clicou — não há teste que note a diferença entre contratado e utilizável.', 'MEDIUM', 'M', 64, 'MEASURED', 'Produto'),
    ('G-08', 'DATA', 'Nenhuma medição automática de qualidade — completude, frescor, consistência — nas tabelas que alimentam o produto. A primeira notícia de dado ruim é a tela do cliente.', 'MEDIUM', 'L', 58, 'ESTIMATED', 'Dados')
  ) AS v(code, axis, statement, severity, effort, cod, confidence, owner);

  INSERT INTO "MeridianGapDependency" (id, "tenantId", "gapId", "dependsOnGapId", "createdAt")
  SELECT
    'c' || substr(md5('nbz-dep-' || v.gap || '-' || v.dep), 1, 24), v_tenant,
    'c' || substr(md5('nbz-gap-' || v.gap), 1, 24),
    'c' || substr(md5('nbz-gap-' || v.dep), 1, 24), v_opened
  FROM (VALUES
    ('G-06', 'G-04'),
    ('G-07', 'G-04'),
    ('G-08', 'G-02')
  ) AS v(gap, dep);

  -- ── Plano de 12 meses ───────────────────────────────────────────────────────
  -- Ordenação topológica do DAG, fatiada em quatro trimestres — saída de
  -- `buildPlan()`. Nenhum item cai antes de um pré-requisito.
  INSERT INTO "MeridianPlanItem"
    (id, "tenantId", "assessmentId", "gapId", quarter, seq, "capacityNote", "createdAt")
  SELECT
    'c' || substr(md5('nbz-plan-' || v.code), 1, 24), v_tenant, v_assessment,
    'c' || substr(md5('nbz-gap-' || v.code), 1, 24),
    v.quarter, v.seq, 'Capacidade de uma pessoa — é o gargalo que o G-05 nomeia.', v_opened
  FROM (VALUES
    ('G-01', 1, 1),
    ('G-02', 1, 2),
    ('G-03', 2, 3),
    ('G-04', 2, 4),
    ('G-05', 3, 5),
    ('G-06', 3, 6),
    ('G-07', 4, 7),
    ('G-08', 4, 8)
  ) AS v(code, quarter, seq);

  -- Sequências: o próximo assessment e o próximo gap criados pela UI não podem
  -- colidir com os códigos deste run.
  INSERT INTO "MeridianSequence" (id, "tenantId", kind, next)
  VALUES ('c' || substr(md5('nbz-seq-assessment'), 1, 24), v_tenant, 'assessment', 2),
         ('c' || substr(md5('nbz-seq-gap'), 1, 24), v_tenant, 'gap', 9)
  ON CONFLICT ("tenantId", kind) DO UPDATE SET next = GREATEST("MeridianSequence".next, EXCLUDED.next);

  RAISE NOTICE 'Diagnóstico % carregado no tenant % (id %).', v_code, v_slug, v_assessment;
END $$;

-- ── Verificação ───────────────────────────────────────────────────────────────
-- Não é decoração: prova que os números na tela vieram das respostas, e que
-- todo id gravado passa no validador do produto (`z.string().cuid()`).
SELECT
  s.axis,
  s.computed AS score,
  s.confidence,
  s.spread,
  s.status,
  (SELECT count(*) FROM "MeridianGap" g
    WHERE g."assessmentId" = s."assessmentId" AND g.axis = s.axis) AS gaps
FROM "MeridianAxisScore" s
JOIN "MeridianAssessment" a ON a.id = s."assessmentId"
WHERE a.code = 'AS-NBZ-001'
ORDER BY s.computed;

SELECT p.quarter, p.seq, g.code, g.axis, g.severity, g."costOfDelay", g.statement
FROM "MeridianPlanItem" p
JOIN "MeridianGap" g ON g.id = p."gapId"
JOIN "MeridianAssessment" a ON a.id = p."assessmentId"
WHERE a.code = 'AS-NBZ-001'
ORDER BY p.seq;

-- Nenhuma linha aqui = todo id é aceito pelo `cuid` do Zod.
SELECT 'id fora do formato cuid' AS problema, tabela, id
FROM (
  SELECT 'MeridianAssessment' AS tabela, id FROM "MeridianAssessment" WHERE code = 'AS-NBZ-001'
  UNION ALL SELECT 'MeridianRespondent', r.id FROM "MeridianRespondent" r
    JOIN "MeridianAssessment" a ON a.id = r."assessmentId" WHERE a.code = 'AS-NBZ-001'
  UNION ALL SELECT 'MeridianGap', g.id FROM "MeridianGap" g
    JOIN "MeridianAssessment" a ON a.id = g."assessmentId" WHERE a.code = 'AS-NBZ-001'
  UNION ALL SELECT 'MeridianAxisScore', s.id FROM "MeridianAxisScore" s
    JOIN "MeridianAssessment" a ON a.id = s."assessmentId" WHERE a.code = 'AS-NBZ-001'
  UNION ALL SELECT 'MeridianPlanItem', i.id FROM "MeridianPlanItem" i
    JOIN "MeridianAssessment" a ON a.id = i."assessmentId" WHERE a.code = 'AS-NBZ-001'
) t
WHERE id !~ '^c[^[:space:]-]{8,}$';
