-- RLS no catálogo GLOBAL do Scaffold (método da Nebuloz, sem tenantId).
--
-- Achado do Vigia: sem RLS, a Data API do Supabase com a anon key lê E escreve
-- nestas tabelas, e todo tenant herda o catálogo. ENABLE + FORCE sem nenhuma
-- policy nega tudo a qualquer papel sujeito a RLS. O app conecta como postgres
-- (BYPASSRLS implícito, ADR-0012) e continua lendo e escrevendo como antes; o
-- seed do método e a publicação de versão também rodam por essa conexão.
--
-- Cuidado para quem fechar o ADR-0012: no dia em que existir papel de aplicação
-- sem BYPASSRLS, estas tabelas passam a ser ilegíveis para ele e vão precisar de
-- policy de SELECT (USING (true)) para o cliente e de escrita só para o papel do
-- back-office. Não resolvido aqui.
--
-- Idempotente: ENABLE/FORCE são repetíveis.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ScaffoldTemplate',
    'ScaffoldTemplateVersion',
    'ScaffoldStepTemplate',
    'ScaffoldGateCriterion',
    'ScaffoldDeliverableTemplate'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
