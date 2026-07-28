-- Habilita os dois triggers que 20260728020000 deixou RETIDOS.
--
-- Aquela migration reemitiu 7 das 9 funções/triggers que o baseline nunca
-- aplicou, e segurou estes dois porque o código em produção dependia de eles
-- não existirem. Os dois ajustes de código foram feitos, então a trava do banco
-- pode entrar:
--
-- (a) epic_lifecycle_guard — moveEpic em apps/app/app/(cosmos)/actions/kanban.ts
--     passou a rotear toda mudança de coluna por transitionEpicStatus (máquina
--     XState: guards, RBAC por evento elevado, StateTransitionHistory, evento
--     Inngest). Reordenar dentro da mesma coluna virou um UPDATE só de
--     lifecycleOrder, que este trigger nem observa (é BEFORE UPDATE OF
--     "lifecycleStatus"). Arrastar de volta pro Funil agora é recusado na ação
--     com mensagem de domínio, antes de chegar no banco. O trigger deixa de ser
--     a regra e passa a ser a rede de segurança: o mesmo conjunto de transições
--     que STATE_VALID_EVENTS declara em transition-status.ts.
--
-- (b) decision_log_immutable — seed-e2e.ts desabilita o trigger explicitamente
--     na sua limpeza (com ENABLE no finally) em vez de apagar por baixo de uma
--     tabela declarada append-only. Nenhum outro caminho da aplicação faz
--     UPDATE/DELETE em DecisionLogEntry.
--
-- Idempotente: CREATE OR REPLACE FUNCTION e DROP TRIGGER IF EXISTS antes de
-- CREATE TRIGGER.

-- ─── (a) Epic lifecycle state machine (de 20260609000001) ────────────────────

CREATE OR REPLACE FUNCTION check_epic_lifecycle_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- No-op when status unchanged
  IF OLD."lifecycleStatus" = NEW."lifecycleStatus" THEN
    RETURN NEW;
  END IF;

  IF (OLD."lifecycleStatus", NEW."lifecycleStatus") NOT IN (
    ('FUNNEL', 'ANALYZING'),
    ('FUNNEL', 'REJECTED'),
    ('ANALYZING', 'PORTFOLIO_BACKLOG'),
    ('ANALYZING', 'REJECTED'),
    ('PORTFOLIO_BACKLOG', 'IMPLEMENTING'),
    ('PORTFOLIO_BACKLOG', 'REJECTED'),
    ('IMPLEMENTING', 'DONE'),
    ('IMPLEMENTING', 'REJECTED')
  ) THEN
    RAISE EXCEPTION 'INVALID_EPIC_LIFECYCLE_TRANSITION: % -> %',
      OLD."lifecycleStatus", NEW."lifecycleStatus";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS epic_lifecycle_guard ON "Epic";
CREATE TRIGGER epic_lifecycle_guard
BEFORE UPDATE OF "lifecycleStatus" ON "Epic"
FOR EACH ROW EXECUTE FUNCTION check_epic_lifecycle_transition();

-- ─── (b) DecisionLogEntry imutável (de 20260609000004) ───────────────────────

CREATE OR REPLACE FUNCTION prevent_decision_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Decision log entries are immutable. Type: %, Entry ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS decision_log_immutable ON "DecisionLogEntry";
CREATE TRIGGER decision_log_immutable
  BEFORE UPDATE OR DELETE ON "DecisionLogEntry"
  FOR EACH ROW EXECUTE FUNCTION prevent_decision_log_mutation();
