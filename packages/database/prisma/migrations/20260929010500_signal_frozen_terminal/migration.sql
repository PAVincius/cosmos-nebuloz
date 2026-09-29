-- FROZEN é terminal (achado do Vigia em 20260929010100).
--
-- A função original só olhava meta e baseline. Nada impedia FROZEN → PAUSED,
-- e uma métrica PAUSED edita a meta: o trigger era contornável em dois passos.
-- Agora, se a linha VELHA está FROZEN, recusa qualquer mudança de estado, de
-- meta ou de baseline. Renomear e trocar responsável continuam livres.
--
-- Migration nova (CREATE OR REPLACE), sem editar a 010100, que pode já ter sido
-- aplicada.
CREATE OR REPLACE FUNCTION prevent_signal_frozen_target_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."state" = 'FROZEN' AND (
    NEW."state" IS DISTINCT FROM OLD."state" OR
    NEW."targetValue" IS DISTINCT FROM OLD."targetValue" OR
    NEW."baselineValue" IS DISTINCT FROM OLD."baselineValue"
  ) THEN
    RAISE EXCEPTION 'SignalPlanMetric % is FROZEN: state, target and baseline cannot change. Request a target review from Scaffold.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
