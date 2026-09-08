-- RLS nas quatro tabelas do catálogo comercial, depois de existirem.
--
-- 20260902150000_rls_tabelas_restantes lista PlanoComercial, PrecoDeModulo,
-- AddOnComercial e TermoDeContrato, mas elas só ganham migration de criação em
-- 20260902170000_catalogo_comercial_e_meeting — em produção já existiam por
-- script manual (2026-08-comercial.sql), então a 150000 passou lá e quebrava em
-- banco novo. A 150000 agora pula tabela inexistente, e esta migration fecha a
-- conta na ordem certa: cria (170000) → aplica RLS (aqui).
--
-- Em produção, onde a 150000 já aplicou a policy, tudo aqui é idempotente e
-- inerte: DROP POLICY IF EXISTS antes de CREATE, ENABLE/FORCE repetíveis.
--
-- ADR-0012: declarar é correto, mas a policy fica INERTE enquanto a aplicação
-- conectar como superuser (BYPASSRLS implícito). O isolamento real hoje é o
-- filtro por tenant em toda query.
--
-- ADR-0013, e um cuidado específico ao catálogo: estas tabelas vivem no tenant
-- de sistema e são lidas pelo back-office via platformDb, cross-tenant, sem
-- app.tenant_id na sessão. Isso continua funcionando enquanto a RLS for
-- inerte. No dia em que existir papel de aplicação sem BYPASSRLS, esta policy
-- passa a valer e vai bloquear platformDb também — o back-office vai precisar
-- de caminho próprio (papel com BYPASSRLS, ou visão fora da policy). Não
-- resolvido aqui; registrado para quem fechar o ADR-0012, junto com o mesmo
-- aviso que já vale para Engagement, Service, Proposal e IpAsset.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'PlanoComercial',
    'PrecoDeModulo',
    'AddOnComercial',
    'TermoDeContrato'
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
