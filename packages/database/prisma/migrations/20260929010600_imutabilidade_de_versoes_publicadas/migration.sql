-- Imutabilidade de versão publicada, garantida no banco (achado do Vigia).
--
-- "IMUTÁVEL" estava só em comentário do schema: qualquer UPDATE passava. Estas
-- tabelas são o método da Nebuloz sob o qual trilhas, iniciativas e casos já
-- rodam; reescrever uma linha em silêncio muda o que eles cumprem (ST-01, ST-03).
-- INSERT segue livre (é assim que se publica). UPDATE é sempre recusado. DELETE
-- direto é recusado; o DELETE em cascata do pai passa (pg_trigger_depth() > 1),
-- para a remoção de um modelo ou perfil inteiro não travar.
--
-- ScaffoldTemplateVersion/StepTemplate/GateCriterion (Scaffold, já em produção)
-- não entram aqui: mudar tabela existente do método pede decisão própria.
CREATE OR REPLACE FUNCTION prevent_published_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is published and immutable. Operation: %, Entry ID: %. Publish a new version instead.', TG_TABLE_NAME, TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signal_measure_model_version_immutable
  BEFORE UPDATE OR DELETE ON "SignalMeasureModelVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_mutation();

CREATE TRIGGER signal_measure_model_metric_immutable
  BEFORE UPDATE OR DELETE ON "SignalMeasureModelMetric"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_mutation();

CREATE TRIGGER charter_control_profile_version_immutable
  BEFORE UPDATE OR DELETE ON "CharterControlProfileVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_mutation();

CREATE TRIGGER charter_control_profile_control_immutable
  BEFORE UPDATE OR DELETE ON "CharterControlProfileControl"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_mutation();

CREATE TRIGGER scaffold_deliverable_template_immutable
  BEFORE UPDATE OR DELETE ON "ScaffoldDeliverableTemplate"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_mutation();
