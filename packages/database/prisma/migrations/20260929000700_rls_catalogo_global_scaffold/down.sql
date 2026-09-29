-- Reverte 20260929000700_rls_catalogo_global_scaffold.
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
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
