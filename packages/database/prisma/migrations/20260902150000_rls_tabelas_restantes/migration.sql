-- RLS nas 22 tabelas de tenant que ainda não tinham (NFR-1.1).
--
-- Fecha a conta que 20260902130000 (Meridian) começou: das 167 tabelas com
-- `tenantId` no schema, 131 já declaravam RLS, 14 entraram com o Meridian, e
-- estas 22 eram o que sobrava.
--
-- Vale o aviso da anterior, e é o mais importante daqui: ADR-0012 registra que
-- `DATABASE_URL` conecta como `postgres`, que tem `rolbypassrls`. Enquanto isso
-- for verdade, NENHUMA policy deste repositório isola nada em runtime.
-- Declarar é o que permite que a virada de papel seja uma troca de conexão em
-- vez de uma auditoria tabela a tabela sob pressão.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE NÃO TEM BLOCO `DO` AQUI
--
-- A primeira versão agrupava tudo em `DO $$ ... $$`. Um bloco DO é UMA
-- instrução, logo UMA transação: ele ia acumulando `AccessExclusiveLock` em
-- cada tabela e só soltava tudo no fim. Contra um banco com tráfego, isso
-- deadlockou de verdade, em produção:
--
--     ERROR: 40P01: deadlock detected
--     Process A waits for AccessExclusiveLock on linear_syncs; blocked by B.
--     Process B waits for AccessShareLock on <outra tabela já travada por A>.
--     CONTEXT: SQL statement "DROP POLICY IF EXISTS ... ON linear_syncs"
--
-- Um SELECT comum do webhook de sync pedia `AccessShareLock` numa tabela que
-- esta migration já tinha travado, enquanto esta migration esperava o lock de
-- `linear_syncs` que aquele processo segurava. Ciclo fechado.
--
-- Instruções soltas resolvem a CLASSE do problema, não só o sintoma: cada
-- statement pega um lock, faz o seu e solta. Como nunca se segura dois ao mesmo
-- tempo, não existe ciclo possível — no pior caso um statement espera e estoura
-- o `lock_timeout` abaixo, o que é uma falha limpa e re-executável.
--
-- RODE FORA DE TRANSAÇÃO EXPLÍCITA. Nada de `BEGIN` em volta, nada de `psql -1`.
-- Envolver isto numa transação reconstrói exatamente o deadlock que ele evita.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A ORDEM DENTRO DE CADA TABELA TAMBÉM MUDOU
--
-- Agora é policy primeiro, `ENABLE`/`FORCE` depois. Sem transação, a ordem
-- antiga (`ENABLE` → `DROP POLICY` → `CREATE POLICY`) deixaria uma janela de
-- alguns milissegundos com RLS ligada e policy nenhuma — que é negação total.
-- É exatamente o estado em que as duas tabelas de benchmark do Meridian foram
-- encontradas, e não vale a pena reproduzi-lo de propósito.
--
-- Idempotente: `DROP POLICY IF EXISTS` antes de criar, `ENABLE`/`FORCE`
-- repetíveis. Se um statement estourar o lock_timeout, rode o arquivo de novo.
-- ─────────────────────────────────────────────────────────────────────────────

-- Falha rápido em vez de entrar na fila atrás do tráfego de produção.
SET lock_timeout = '3s';

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- FORMA 1 — `tenantId` obrigatório, dono é o cliente (19 tabelas).
--
-- Boa parte destas é lida pelo back-office, cross-tenant, via `platformDb`.
-- Isso está certo e é o que a ADR-0013 desenha: a policy aqui descreve o que o
-- APP do cliente pode ver — não é ela que governa o back-office, que na virada
-- de papel recebe um papel que enxerga outros tenants.
--
-- As nove primeiras usam `@@map`: o nome da tabela NÃO é o nome do modelo
-- (`LinearSync` é `linear_syncs`). Usar o nome do modelo mata a migration com
-- `relation does not exist`.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation" ON linear_syncs;
CREATE POLICY "tenant_isolation" ON linear_syncs
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE linear_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE linear_syncs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON linear_sync_events;
CREATE POLICY "tenant_isolation" ON linear_sync_events
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE linear_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE linear_sync_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON github_syncs;
CREATE POLICY "tenant_isolation" ON github_syncs
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE github_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_syncs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON github_sync_events;
CREATE POLICY "tenant_isolation" ON github_sync_events
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE github_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON github_deployment_events;
CREATE POLICY "tenant_isolation" ON github_deployment_events
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE github_deployment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_deployment_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON github_unlinked_prs;
CREATE POLICY "tenant_isolation" ON github_unlinked_prs
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE github_unlinked_prs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_unlinked_prs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON webhook_dlq;
CREATE POLICY "tenant_isolation" ON webhook_dlq
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE webhook_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_dlq FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON copilot_sessions;
CREATE POLICY "tenant_isolation" ON copilot_sessions
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE copilot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON copilot_messages;
CREATE POLICY "tenant_isolation" ON copilot_messages
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "PlanoComercial";
CREATE POLICY "tenant_isolation" ON "PlanoComercial"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "PlanoComercial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanoComercial" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "PrecoDeModulo";
CREATE POLICY "tenant_isolation" ON "PrecoDeModulo"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "PrecoDeModulo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrecoDeModulo" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "AddOnComercial";
CREATE POLICY "tenant_isolation" ON "AddOnComercial"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "AddOnComercial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AddOnComercial" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "TermoDeContrato";
CREATE POLICY "tenant_isolation" ON "TermoDeContrato"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "TermoDeContrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TermoDeContrato" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "Service";
CREATE POLICY "tenant_isolation" ON "Service"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "Proposal";
CREATE POLICY "tenant_isolation" ON "Proposal"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "Proposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proposal" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "Engagement";
CREATE POLICY "tenant_isolation" ON "Engagement"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "Engagement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Engagement" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "IpAsset";
CREATE POLICY "tenant_isolation" ON "IpAsset"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "IpAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IpAsset" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "StaffPerson";
CREATE POLICY "tenant_isolation" ON "StaffPerson"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "StaffPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffPerson" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "AccessLog";
CREATE POLICY "tenant_isolation" ON "AccessLog"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "AccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessLog" FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- FORMA 2 — `tenantId` obrigatório, mas o dono é SEMPRE o tenant interno.
--
-- `PlatformApproval` e `StaffDiagram` são artefatos da Nebuloz, não do cliente:
-- o schema diz, nas duas, que `tenantId` é sempre o tenant `system`. Em
-- `PlatformApproval`, quem é afetado pela operação é `targetTenantId`, que é
-- outro campo e outra coisa.
--
-- A policy é a mesma, e é por isso que funciona: com `app.tenant_id` de um
-- cliente, estas linhas somem — que é o comportamento desejado.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation" ON "PlatformApproval";
CREATE POLICY "tenant_isolation" ON "PlatformApproval"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "PlatformApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformApproval" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "StaffDiagram";
CREATE POLICY "tenant_isolation" ON "StaffDiagram"
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "StaffDiagram" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffDiagram" FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- FORMA 3 — `tenantId` NULO significa global.
--
-- `CharterRequirementSet` é a única das 22 com `tenantId` opcional, e o schema
-- explica: "nulo significa conjunto global — regulação vale para todos. RFP é
-- do tenant que a importou."
--
-- A policy padrão seria bug silencioso. Em SQL, `NULL = 'algo'` não é falso, é
-- NULO — e policy que devolve NULO não deixa a linha passar. Toda regulação
-- publicada pela Nebuloz (LGPD, ISO, PL 2338) sumiria para todos os tenants, e
-- o mapa de conformidade ficaria vazio sem erro nenhum.
--
-- Leitura e escrita são assimétricas de propósito: o tenant LÊ o que é dele
-- mais o que é global, e ESCREVE só o que é dele. Publicar regulação global é
-- ato da Nebuloz e vai pela porta cross-tenant, não por um INSERT do cliente
-- com `tenantId` nulo.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation" ON "CharterRequirementSet";
CREATE POLICY "tenant_isolation" ON "CharterRequirementSet"
  USING ("tenantId" IS NULL OR "tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());
ALTER TABLE "CharterRequirementSet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CharterRequirementSet" FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSERTO — as duas tabelas de benchmark do Meridian.
--
-- A verificação em produção depois de 20260902130000 devolveu 16 tabelas
-- `Meridian%` com `relrowsecurity`, mas só 14 forçadas e 14 com policy. As duas
-- sobrando são as de benchmark, que aquela migration deixou de fora de propósito
-- por não terem `tenantId` — mas que estavam no banco com RLS LIGADA e policy
-- NENHUMA, que é negação total.
--
-- Hoje ninguém vê porque `postgres` tem BYPASSRLS. Na virada de papel o pool
-- ficaria vazio para todo mundo, e o sintoma seria "a coorte sumiu", não erro de
-- permissão.
--
-- O pool é global POR CONTRATO — é isso que permite comparar uma organização
-- com a coorte. Não há coluna de tenant para comparar, então a policy é
-- permissiva de propósito, com nome próprio para ninguém a ler como
-- esquecimento. Leitura E escrita: a contribuição entra por opt-in, e uma policy
-- só de SELECT deixaria o opt-in falhando na virada.
--
-- FICA REGISTRADO, porque não é escopo desta migration consertar:
-- `MeridianBenchmarkContribution` guarda `assessmentId`, e `MeridianAssessment`
-- tem `tenantId` — quem puder ler as duas reconstrói de quem é cada número do
-- pool. O anonimato aqui é convenção de quem escreve a query, não propriedade do
-- modelo. Fechar isso é mudança de schema e merece decisão própria.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation" ON "MeridianBenchmarkCohort";
DROP POLICY IF EXISTS "benchmark_global" ON "MeridianBenchmarkCohort";
CREATE POLICY "benchmark_global" ON "MeridianBenchmarkCohort"
  USING (true)
  WITH CHECK (true);
ALTER TABLE "MeridianBenchmarkCohort" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeridianBenchmarkCohort" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "MeridianBenchmarkContribution";
DROP POLICY IF EXISTS "benchmark_global" ON "MeridianBenchmarkContribution";
CREATE POLICY "benchmark_global" ON "MeridianBenchmarkContribution"
  USING (true)
  WITH CHECK (true);
ALTER TABLE "MeridianBenchmarkContribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeridianBenchmarkContribution" FORCE ROW LEVEL SECURITY;

