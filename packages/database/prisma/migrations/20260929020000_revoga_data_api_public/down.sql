-- Reverte 20260929020000_revoga_data_api_public: devolve o estado padrão do
-- Supabase (anon e authenticated com tudo em public). Reabre a Data API para
-- as tabelas sem RLS; use só para desfazer um incidente causado pela revogação.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;

    BEGIN
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
    EXCEPTION
      WHEN insufficient_privilege OR undefined_object THEN
        RAISE NOTICE 'default privileges de supabase_admin não alterados: %', SQLERRM;
    END;
  END IF;
END $$;
