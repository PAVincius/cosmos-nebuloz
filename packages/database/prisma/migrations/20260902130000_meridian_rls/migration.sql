-- RLS do Meridian (NFR-1.1).
--
-- O módulo nasceu sem policy nenhuma: das 167 tabelas com `tenantId` no schema,
-- 131 declaram RLS e 36 não — e 14 dessas 36 são do Meridian, o maior bloco
-- isolado que restava. O Charter fez isto na própria migration de criação
-- (20260728120000, bloco FOREACH); esta migration repete aquele padrão para o
-- Meridian, que passou direto.
--
-- O QUE ISTO MUDA HOJE: nada em tempo de execução, e é importante dizer.
-- ADR-0012 registra que `DATABASE_URL` conecta como `postgres`, que tem
-- `rolbypassrls`, então toda policy é ignorada em runtime. `FORCE ROW LEVEL
-- SECURITY` alcança o dono da tabela, não quem tem BYPASSRLS. O isolamento
-- efetivo continua vindo de `withTenantDb()` e do filtro por `tenantId` nas
-- queries — disciplina, não garantia.
--
-- POR QUE FAZER MESMO ASSIM: no dia em que o papel de aplicação sem BYPASSRLS
-- existir (a correção que a ADR-0012 descreve), o Meridian estaria isolado por
-- disciplina enquanto todo o resto estaria isolado por policy. Declarar agora é
-- o que faz aquela virada ser uma mudança de conexão, e não uma auditoria
-- tabela a tabela sob pressão.
--
-- AS DUAS TABELAS DE BENCHMARK FICAM DE FORA, de propósito. `MeridianBenchmarkCohort`
-- e `MeridianBenchmarkContribution` não têm `tenantId` por contrato: o pool é
-- global e anônimo, e é isso que permite comparar uma organização com a coorte.
-- Uma policy por tenant nelas não teria coluna para comparar.
--
-- Idempotente: CREATE OR REPLACE, DROP POLICY IF EXISTS antes de CREATE,
-- ENABLE/FORCE repetíveis.

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'MeridianMembership',
    'MeridianSequence',
    'MeridianTemplate',
    'MeridianQuestion',
    'MeridianAssessment',
    'MeridianRespondent',
    'MeridianResponse',
    'MeridianEvidence',
    'MeridianAxisScore',
    'MeridianOverride',
    'MeridianGap',
    'MeridianGapDependency',
    'MeridianPlanItem',
    'MeridianGapPromotion'
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
-- ATENÇÃO PARA A VIRADA DE PAPEL (ADR-0012)
--
-- O Meridian tem uma superfície que o Charter não tem: `/meridian-responder/
-- <token>`, onde quem responde não tem conta e o tenant sai do token. Todo o
-- `app/(meridian)/actions/respondent.ts` lê e escreve no client comum, de
-- propósito e documentado — é ele que DESCOBRE o tenant, então não tem como
-- abrir `withTenantDb()` antes.
--
-- Hoje isso funciona porque `postgres` tem BYPASSRLS. No dia em que o papel de
-- aplicação sem BYPASSRLS entrar, essa rota para de funcionar inteira: a
-- consulta por `tokenHash` volta vazia e a bateria fica inacessível.
--
-- A saída é estreitar, não afrouxar: uma função `SECURITY DEFINER` que receba o
-- hash do token e devolva SÓ o `tenantId` — nenhuma resposta, nenhum nome —, e
-- então o respondent.ts abre `withTenantDb()` com ele e passa a ser filtrado
-- por policy como todo o resto. Não está aqui porque função sem chamador é
-- código morto; está escrito aqui porque quem fizer a virada precisa saber
-- disso antes de descobrir em produção.
-- ─────────────────────────────────────────────────────────────────────────────
