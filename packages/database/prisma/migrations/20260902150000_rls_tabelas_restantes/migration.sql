-- RLS nas 22 tabelas de tenant que ainda não tinham (NFR-1.1).
--
-- Fecha a conta que a migration do Meridian (20260902130000) começou: das 167
-- tabelas com `tenantId` no schema, 131 declaravam RLS, 14 entraram com o
-- Meridian, e estas 22 eram o que sobrava.
--
-- Vale o mesmo aviso da anterior, e ele é o mais importante deste arquivo:
-- ADR-0012 registra que `DATABASE_URL` conecta como `postgres`, que tem
-- `rolbypassrls`. Enquanto isso for verdade, NENHUMA policy deste repositório
-- isola coisa alguma em tempo de execução. Declarar é o que permite que a
-- virada de papel seja uma troca de conexão em vez de uma auditoria tabela a
-- tabela sob pressão.
--
-- As tabelas NÃO são todas iguais, e por isso não estão todas no mesmo bloco:
-- três formas diferentes, três tratamentos.
--
-- Idempotente: DROP POLICY IF EXISTS antes de CREATE, ENABLE/FORCE repetíveis.

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- FORMA 1 — `tenantId` obrigatório, dono é o cliente (19 tabelas).
--
-- Policy padrão, idêntica à do Charter e à do Meridian.
--
-- Boa parte destas é lida pelo back-office, cross-tenant, via `platformDb`.
-- Isso está certo e é o que a ADR-0013 desenha: a porta cross-tenant é única e
-- nomeada, e na virada de papel o back-office recebe um papel que enxerga
-- outros tenants enquanto o app do cliente recebe um que não. A policy aqui
-- descreve o que o APP do cliente pode ver — não é ela que governa o
-- back-office.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- linear-sync: espelho de issue e PR, por tenant.
    -- Nomes em snake_case porque estes modelos usam `@@map` — o nome do modelo
    -- NÃO é o nome da tabela aqui, e usar o do modelo faz a migration morrer
    -- com `relation does not exist`.
    'linear_syncs',
    'linear_sync_events',
    'github_syncs',
    'github_sync_events',
    'github_deployment_events',
    'github_unlinked_prs',
    'webhook_dlq',
    -- system: histórico do copiloto, que carrega pergunta de usuário. Também
    -- com `@@map`.
    'copilot_sessions',
    'copilot_messages',
    -- comercial: plano, preço, add-on e contrato POR CLIENTE (não é catálogo
    -- global — o catálogo da plataforma vive em outra tabela)
    'PlanoComercial',
    'PrecoDeModulo',
    'AddOnComercial',
    'TermoDeContrato',
    -- platform-ops: entrega e comercial do cliente
    'Service',
    'Proposal',
    'Engagement',
    'IpAsset',
    'StaffPerson',
    'AccessLog'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())',
      t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FORMA 2 — `tenantId` obrigatório, mas o dono é SEMPRE o tenant interno.
--
-- `PlatformApproval` e `StaffDiagram` são artefatos da Nebuloz, não do cliente:
-- o schema diz, nas duas, que `tenantId` é sempre o tenant `system`. Em
-- `PlatformApproval` quem é afetado pela operação é `targetTenantId`, que é
-- outro campo e outra coisa.
--
-- A policy é a mesma, e é justamente por isso que funciona: com
-- `app.tenant_id` de um cliente, estas linhas somem — que é o comportamento
-- desejado. Quem precisa delas é o back-office, pela porta da ADR-0013.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'PlatformApproval',
    'StaffDiagram'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())',
      t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FORMA 3 — `tenantId` NULO significa global.
--
-- `CharterRequirementSet` é a única das 22 com `tenantId` opcional, e o schema
-- explica: "nulo significa conjunto global — regulação vale para todos. RFP é
-- do tenant que a importou."
--
-- A policy padrão seria um bug silencioso aqui. Em SQL, `NULL = 'algo'` não é
-- falso, é NULO — e uma policy que devolve NULO não deixa a linha passar. Toda
-- regulação publicada pela Nebuloz (LGPD, ISO, PL 2338) sumiria para todos os
-- tenants, e o mapa de conformidade ficaria vazio sem erro nenhum.
--
-- Leitura e escrita são assimétricas de propósito: o tenant LÊ o que é dele
-- mais o que é global, e ESCREVE só o que é dele. Publicar regulação global é
-- ato da Nebuloz, e vai pela porta cross-tenant — não por um INSERT do cliente
-- com `tenantId` nulo.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "CharterRequirementSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterRequirementSet" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "CharterRequirementSet";
CREATE POLICY "tenant_isolation" ON "CharterRequirementSet"
  USING ("tenantId" IS NULL OR "tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSERTO — as duas tabelas de benchmark do Meridian.
--
-- A verificação em produção depois de 20260902130000 devolveu 16 tabelas
-- `Meridian%` com `relrowsecurity`, mas só 14 forçadas e 14 com policy. As duas
-- sobrando são as de benchmark, que aquela migration deixou de fora de propósito
-- por não terem `tenantId` — mas que chegaram ao banco com RLS LIGADA e policy
-- NENHUMA.
--
-- Esse é o pior estado possível: RLS sem policy é negação total. Hoje ninguém
-- vê porque `postgres` tem BYPASSRLS; na virada de papel, o pool de benchmark
-- ficaria vazio para todo mundo, e o sintoma seria "a coorte sumiu", não um
-- erro de permissão.
--
-- O estado correto é explícito: o pool é global POR CONTRATO — é isso que
-- permite comparar uma organização com a coorte. Não há coluna de tenant para
-- comparar, então a policy é permissiva de propósito, com nome próprio para
-- ninguém a ler como esquecimento. Leitura E escrita: a contribuição entra por
-- opt-in do assessment, e uma policy só de SELECT deixaria o opt-in falhando na
-- virada de papel — trocaria um sintoma silencioso por outro.
--
-- FICA REGISTRADO, porque não é escopo desta migration consertar:
-- `MeridianBenchmarkContribution` não é tão anônima quanto o contrato promete.
-- Ela guarda `assessmentId`, e `MeridianAssessment` tem `tenantId` — quem puder
-- ler as duas reconstrói de quem é cada número do pool. O anonimato aqui é
-- convenção de quem escreve a query, não propriedade do modelo. Fechar isso é
-- mudança de schema (guardar só a coorte, sem ponteiro para o assessment), e
-- merece decisão própria.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'MeridianBenchmarkCohort',
    'MeridianBenchmarkContribution'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "benchmark_global" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "benchmark_global" ON %I USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
