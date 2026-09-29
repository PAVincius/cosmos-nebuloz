-- Revoga o acesso de anon e authenticated ao schema public.
--
-- Contexto: o projeto Supabase expõe `public` e `graphql_public` pela Data API
-- com "Automatically expose new tables" ligado, e anon/authenticated têm
-- SELECT e INSERT (e mais) em todas as tabelas, inclusive as sem RLS (Account,
-- Session, ScaffoldPhaseInstance, AiLawWatchRecord, FeatureFlag, IpAsset*...).
-- A anon key não está no repo nem no bundle, então é risco latente, não
-- vazamento ativo. Ainda assim: RLS é defesa por tabela e esquecível; revogar o
-- privilégio fecha a porta para toda tabela, presente e futura.
--
-- O app não depende desses papéis para `public`: o Prisma conecta como postgres
-- (BYPASSRLS, ADR-0012) e o supabase-js de packages/storage usa service_role e
-- só o schema `storage`. postgres e service_role não são afetados.
--
-- Só age se os papéis existirem: no Postgres local (Docker) eles não existem.
-- Idempotente: REVOKE repetido é inerte.
--
-- Não revoga de PUBLIC. Função em public segue executável por PUBLIC (default do
-- Postgres) e, portanto, por anon via /rpc; fechar isso pede REVOKE FROM PUBLIC
-- e reconceder o que extensões (vector) e políticas precisam. Fora deste escopo.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

    -- Tabelas futuras: default privileges do papel que cria as tabelas
    -- (postgres, o dono das migrations). Sem isto, a próxima tabela nasce
    -- exposta de novo.
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

    -- O Supabase também define defaults para supabase_admin (tabelas criadas
    -- pelo painel/extensões). Sem privilégio para alterá-los, segue sem falhar:
    -- o que o app cria é do postgres.
    BEGIN
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
    EXCEPTION
      WHEN insufficient_privilege OR undefined_object THEN
        RAISE NOTICE 'default privileges de supabase_admin não alterados: %', SQLERRM;
    END;
  END IF;
END $$;
