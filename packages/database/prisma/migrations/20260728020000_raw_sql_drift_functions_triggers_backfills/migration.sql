-- Task 6 (isolamento-tenant): reemitir o SQL bruto que nunca executou.
--
-- Mesma causa-raiz da 20260728010000 (RLS): 73 das 77 linhas de
-- _prisma_migrations têm applied_steps_count = 0 — o histórico foi baselinado
-- com `prisma migrate resolve --applied` contra um banco construído por
-- `db push`. `db push` materializa apenas schema.prisma (tabelas, colunas,
-- índices, enums); nunca executa o SQL bruto dentro de migration.sql. E o
-- portão que autorizou o baseline, `prisma migrate diff`, compara só estrutura
-- de schema — é estruturalmente cego a funções, triggers, policies, grants,
-- CHECKs e backfills de dados.
--
-- Auditoria completa em apps/app/scripts/audit-raw-sql-drift.ts (read-only:
-- lê as 71 migrations do disco, extrai os objetos esperados e confronta com
-- pg_proc / pg_trigger / pg_constraint / pg_extension / role_table_grants).
-- Resultado antes desta migration:
--   • 9 funções ausentes  • 9 triggers ausentes
--   • 0 GRANT/REVOKE e 0 CHECK constraints em todo o histórico (nada a perder)
--   • extensão "vector" presente  • AuditLog_tenantId_fkey já é RESTRICT
--     (schema.prisma declara onDelete: Restrict, então db push o aplicou)
--   • 3 backfills de dados não aplicados
--
-- Esta migration reemite 7 das 9 funções e 7 dos 9 triggers. Os dois restantes
-- (epic_lifecycle_guard e decision_log_immutable) estão RETIDOS por conflitarem
-- com código em produção — ver a seção "RETIDOS" no fim deste arquivo.
--
-- Tudo idempotente: CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS antes de
-- CREATE TRIGGER, backfills com WHERE que os torna no-op na segunda execução.

-- ─── 1. PIKnowledgeVector.updatedAt (de 20260523000000) ──────────────────────

CREATE OR REPLACE FUNCTION "update_PIKnowledgeVector_updatedAt"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PIKnowledgeVector_updatedAt_trigger" ON "PIKnowledgeVector";
CREATE TRIGGER "PIKnowledgeVector_updatedAt_trigger"
  BEFORE UPDATE ON "PIKnowledgeVector"
  FOR EACH ROW EXECUTE FUNCTION "update_PIKnowledgeVector_updatedAt"();

-- ─── 2. AuditLog append-only (de 20260603000002 e 20260609000019) ────────────
--
-- Esta é a garantia de compliance que o time acredita estar ativa (SOC2 CC7.2)
-- e que na prática nunca existiu no banco. As duas migrations declaram triggers
-- redundantes com semântica idêntica; ambas são reemitidas para que o histórico
-- no disco e o catálogo vivo passem a coincidir statement a statement.
--
-- Nenhum caminho de escrita da aplicação faz UPDATE/DELETE em AuditLog — o
-- TODO(NEB-115) em packages/database/index.ts pede exatamente esta trava, só que
-- na camada do Prisma. Aqui ela passa a existir também na camada do banco.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. Mutations are not permitted. Use soft-delete patterns instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable ON "AuditLog";
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog entries are immutable. Operation: %, Entry ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON "AuditLog";
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- ─── 3. ScoringEvent append-only (de 20260609000003) ─────────────────────────
-- Nenhum caminho de escrita faz update/delete; tabela com 0 linhas hoje.

CREATE OR REPLACE FUNCTION prevent_scoring_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ScoringEvent is append-only and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_scoring_event_update ON "ScoringEvent";
CREATE TRIGGER trg_prevent_scoring_event_update
  BEFORE UPDATE OR DELETE ON "ScoringEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_scoring_event_mutation();

-- ─── 4. LeanBudgetReallocation imutável (de 20260609000013) ──────────────────
-- Nenhum caminho de escrita faz update/delete; tabela com 0 linhas hoje.

CREATE OR REPLACE FUNCTION prevent_reallocation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LeanBudgetReallocation entries are immutable.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reallocation_immutable ON "LeanBudgetReallocation";
CREATE TRIGGER reallocation_immutable
  BEFORE UPDATE OR DELETE ON "LeanBudgetReallocation"
  FOR EACH ROW EXECUTE FUNCTION prevent_reallocation_mutation();

-- ─── 5. searchVector de Epic e Feature (de 20260609000020) ───────────────────
--
-- Sem estas funções/triggers a coluna tsvector nunca é preenchida, e a busca
-- full-text que depende delas retorna vazio silenciosamente para toda linha
-- criada desde 2026-06-09.

CREATE OR REPLACE FUNCTION update_epic_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" = to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW."descriptionMd", '') || ' ' ||
    coalesce(NEW.hypothesis, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS epic_search_vector_update ON "Epic";
CREATE TRIGGER epic_search_vector_update
  BEFORE INSERT OR UPDATE ON "Epic"
  FOR EACH ROW EXECUTE FUNCTION update_epic_search_vector();

CREATE OR REPLACE FUNCTION update_feature_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" = to_tsvector('english', coalesce(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_search_vector_update ON "Feature";
CREATE TRIGGER feature_search_vector_update
  BEFORE INSERT OR UPDATE ON "Feature"
  FOR EACH ROW EXECUTE FUNCTION update_feature_search_vector();

-- ─── 6. Backfills de dados ───────────────────────────────────────────────────
--
-- Os triggers acima só disparam em INSERT/UPDATE: as linhas que já existem
-- continuariam com searchVector NULL. Estes UPDATEs são os mesmos backfills das
-- migrations originais, com WHERE que os torna no-op quando já aplicados.

-- de 20260609000020 — 13 Epics e 25 Features estavam com searchVector NULL
UPDATE "Epic" SET "searchVector" = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce("descriptionMd", '') || ' ' || coalesce(hypothesis, '')
) WHERE "searchVector" IS NULL;

UPDATE "Feature" SET "searchVector" = to_tsvector('english', coalesce(title, ''))
WHERE "searchVector" IS NULL;

-- de 20260724000031 — 11 Epics com lifecycleOrder divergente de "order"
UPDATE "Epic" SET "lifecycleOrder" = "order"
WHERE "lifecycleOrder" IS DISTINCT FROM "order";

-- ─── RETIDOS: dois triggers que quebrariam código em produção ────────────────
--
-- Não foram reemitidos aqui porque, ao contrário dos acima, o código atual
-- depende de eles NÃO existirem. Ativá-los é uma decisão de produto, não de
-- remediação, e cada um exige um ajuste de código antes.
--
-- (a) epic_lifecycle_guard ON "Epic" (de 20260609000001)
--     A função check_epic_lifecycle_transition só permite o caminho canônico
--     FUNNEL→ANALYZING→PORTFOLIO_BACKLOG→IMPLEMENTING→DONE (+ →REJECTED). Mas
--     moveEpic em apps/app/app/(cosmos)/actions/kanban.ts grava
--     COLUMN_TO_LIFECYCLE[column] direto, sem validar transição: arrastar um
--     card para trás no Kanban viraria uma exceção crua do Postgres. O seed
--     também gravaria FUNNEL→IMPLEMENTING num reseed (seed-e2e.ts:1998).
--     Já existe validação equivalente em app/actions/epics/transition-status.ts
--     (máquina XState). Habilitar o trigger exige antes rotear moveEpic por essa
--     máquina — ou aceitar transições livres e remover o trigger do disco.
--
-- (b) decision_log_immutable ON "DecisionLogEntry" (de 20260609000004)
--     Bloqueia UPDATE/DELETE, mas seed-e2e.ts:1403 faz
--     `db.decisionLogEntry.deleteMany({ where: { tenantId } })` na limpeza — o
--     seed passaria a falhar, e 6 tasks dependem dele. Habilitar exige antes
--     trocar essa limpeza por um caminho privilegiado (ALTER TABLE ... DISABLE
--     TRIGGER dentro do seed, ou um role com bypass).
