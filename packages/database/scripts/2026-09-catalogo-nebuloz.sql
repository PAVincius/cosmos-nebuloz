-- Catálogo Nebuloz — serviços de consultoria e preços de plataforma.
--
-- Gerado de nebuloz-catalogo.json (2026-09-01) por script, não à mão.
-- Moeda: BRL. Os preços do JSON estão em reais; aqui viram centavos inteiros,
-- porque ponto flutuante em dinheiro acumula erro na soma dos itens da proposta.
--
-- Idempotente: cada bloco é UPSERT pela chave natural (código do serviço, slug
-- do plano/termo/add-on, módulo). Rodar de novo atualiza; não duplica e não apaga.
--
-- Rodar no SQL editor do banco do ambiente certo — confira se é produção.

BEGIN;

-- ── Serviços ────────────────────────────────────────────────────────────
INSERT INTO "Service" (
  id, "tenantId", codigo, nome, descricao, modalidade, "precoBaseCentavos",
  unidade, ativo, trilha, "unidadeDeCobranca", duracao,
  entregaveis, papeis, "preRequisitos", "moduloVinculado", "exigeLab",
  "criadoEm", "atualizadoEm"
) VALUES
  (gen_random_uuid()::text, 'system', 'SV-01', 'AI Readiness Assessment', 'Diagnóstico de maturidade em dados, processo, governança e cultura. Entrega score por dimensão e roadmap priorizado.', 'PROJETO', 4800000,
   'projeto', true, 'readiness', 'PROJETO', '4 semanas',
   ARRAY['Score de maturidade (6 dimensões)','Mapa de casos de uso priorizados por WSJF','Análise de lacunas de dado','Roadmap de 12 meses'], ARRAY['Consultor sênior','Arquiteto de dados'], ARRAY[]::text[], 'COSMOS'::"ProductModule", false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-02', 'Data Foundation Audit', 'Auditoria de qualidade, linhagem e disponibilidade dos dados que os casos de uso priorizados exigem.', 'PROJETO', 3200000,
   'projeto', true, 'readiness', 'PROJETO', '3 semanas',
   ARRAY['Inventário de fontes','Matriz de qualidade por fonte','Plano de remediação'], ARRAY['Engenheiro de dados','Arquiteto de dados'], ARRAY['SV-01'], NULL, false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-03', 'AI Governance Setup', 'Implanta política de IA, comitê, fluxo de intake e trilha de evidência — usando o Charter como sistema de registro.', 'PROJETO', 5600000,
   'projeto', true, 'readiness', 'PROJETO', '5 semanas',
   ARRAY['Política de IA versionada','Fluxo de intake e revisão (BPMN)','Comitê e RACI','Charter configurado'], ARRAY['Consultor de governança','Legal/compliance'], ARRAY[]::text[], 'CHARTER'::"ProductModule", false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-04', 'Use Case Delivery Squad', 'Squad dedicada levando um caso de uso do piloto à produção, com métricas de valor no Signal.', 'PROJETO', 7400000,
   'sprint', true, 'adoption', 'SPRINT', 'por sprint de 2 semanas',
   ARRAY['Caso em produção','Baseline e métricas de ROI','Runbook operacional'], ARRAY['Tech lead','2× Engenheiro de IA','Product owner'], ARRAY['SV-01'], 'SIGNAL'::"ProductModule", false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-05', 'MLOps Foundation', 'Pipeline de treino, avaliação, deploy e observabilidade de modelo no ambiente do cliente.', 'PROJETO', 8800000,
   'projeto', true, 'adoption', 'PROJETO', '6 semanas',
   ARRAY['Pipeline CI/CD de modelo','Registry e versionamento','Dashboards de drift e custo'], ARRAY['Engenheiro de ML','SRE'], ARRAY['SV-02'], NULL, false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-06', 'AI Operations Retainer', 'Sustentação de modelos e agentes em produção: monitoramento, retreino, ajuste de guardrails, plantão.', 'RETAINER', 2600000,
   'mês', true, 'adoption', 'RETAINER', 'mensal, mínimo 6 meses',
   ARRAY['SLA de resposta','Retreino periódico','Relatório mensal de valor e risco'], ARRAY['Engenheiro de ML','Analista de operações'], ARRAY['SV-05'], 'SIGNAL'::"ProductModule", false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-07', 'AI Literacy Program', 'Trilhas de capacitação por persona (liderança, produto, engenharia) com certificação e aceite registrado.', 'PROJETO', 3800000,
   'projeto', true, 'enablement', 'PROJETO', '8 semanas',
   ARRAY['3 trilhas por persona','Material e laboratórios','Painel de cobertura e aceite'], ARRAY['Facilitador','Especialista de conteúdo'], ARRAY[]::text[], 'CHARTER'::"ProductModule", false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-08', 'Embedded Advisor', 'Consultor sênior alocado parcialmente no time do cliente para decisões de arquitetura e priorização.', 'PROJETO', 78000,
   'hora', true, 'enablement', 'HORA', 'pacotes de 40h',
   ARRAY['Sessões semanais','Pareceres de arquitetura','Apoio a comitê de IA'], ARRAY['Consultor sênior'], ARRAY[]::text[], NULL, false, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-09', 'SLM Domain Fine-tune', 'Treino de um Small Language Model no domínio e no vocabulário do cliente, com avaliação e cartão de modelo.', 'PROJETO', 16500000,
   'projeto', true, 'custom', 'PROJETO', '10 semanas',
   ARRAY['Modelo treinado e versionado','Suite de avaliação do domínio','Model card e limites de uso','Deploy no ambiente do cliente'], ARRAY['Cientista de dados','Engenheiro de ML','Especialista de domínio'], ARRAY['SV-02','SV-05'], NULL, true, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-10', 'Eval Harness sob medida', 'Suite de avaliação com dados e critérios do cliente, para medir o modelo no que importa para o negócio dele.', 'PROJETO', 4200000,
   'projeto', true, 'custom', 'PROJETO', '3 semanas',
   ARRAY['Dataset de avaliação rotulado','Métricas de domínio','Baseline versus modelos de referência'], ARRAY['Cientista de dados'], ARRAY[]::text[], NULL, true, now(), now()),
  (gen_random_uuid()::text, 'system', 'SV-11', 'Private Model Hosting', 'Hospedagem dedicada do modelo do cliente, com isolamento, observabilidade de inferência e teto de custo.', 'RETAINER', 3400000,
   'mês', false, 'custom', 'RETAINER', 'mensal',
   ARRAY['Endpoint dedicado','Isolamento e residência de dado','Painel de latência, custo e uso'], ARRAY['SRE','Engenheiro de ML'], ARRAY['SV-09'], NULL, true, now(), now())
ON CONFLICT ("tenantId", codigo) DO UPDATE SET
  nome = EXCLUDED.nome, descricao = EXCLUDED.descricao,
  modalidade = EXCLUDED.modalidade, "precoBaseCentavos" = EXCLUDED."precoBaseCentavos",
  unidade = EXCLUDED.unidade, ativo = EXCLUDED.ativo, trilha = EXCLUDED.trilha,
  "unidadeDeCobranca" = EXCLUDED."unidadeDeCobranca", duracao = EXCLUDED.duracao,
  entregaveis = EXCLUDED.entregaveis, papeis = EXCLUDED.papeis,
  "preRequisitos" = EXCLUDED."preRequisitos", "moduloVinculado" = EXCLUDED."moduloVinculado",
  "exigeLab" = EXCLUDED."exigeLab", "atualizadoEm" = now();

-- ── Planos de plataforma ────────────────────────────────────────────────
INSERT INTO "PlanoComercial" (
  id, "tenantId", slug, nome, ordem, "precoAssentoCentavos", "minimoAssentos",
  ativo, "criadoEm", "atualizadoEm"
) VALUES
  (gen_random_uuid()::text, 'system', 'starter', 'Starter', 0, 8900, 10, true, now(), now()),
  (gen_random_uuid()::text, 'system', 'scale', 'Scale', 1, 14900, 25, true, now(), now()),
  (gen_random_uuid()::text, 'system', 'enterprise', 'Enterprise', 2, 21900, 50, true, now(), now())
ON CONFLICT ("tenantId", slug) DO UPDATE SET
  nome = EXCLUDED.nome, ordem = EXCLUDED.ordem,
  "precoAssentoCentavos" = EXCLUDED."precoAssentoCentavos",
  "minimoAssentos" = EXCLUDED."minimoAssentos", ativo = true, "atualizadoEm" = now();

-- ── Preço mensal por módulo ─────────────────────────────────────────────
INSERT INTO "PrecoDeModulo" (id, "tenantId", modulo, "precoMensalCentavos", "atualizadoEm")
VALUES
  (gen_random_uuid()::text, 'system', 'COSMOS'::"ProductModule", 0, now()),
  (gen_random_uuid()::text, 'system', 'CHARTER'::"ProductModule", 180000, now()),
  (gen_random_uuid()::text, 'system', 'SIGNAL'::"ProductModule", 120000, now())
ON CONFLICT ("tenantId", modulo) DO UPDATE SET
  "precoMensalCentavos" = EXCLUDED."precoMensalCentavos", "atualizadoEm" = now();

-- ── Termos de contrato ──────────────────────────────────────────────────
INSERT INTO "TermoDeContrato" (id, "tenantId", slug, nome, meses, "descontoPercent", ordem)
VALUES
  (gen_random_uuid()::text, 'system', 'MENSAL', 'Mensal', 1, 0, 0),
  (gen_random_uuid()::text, 'system', 'ANUAL', 'Anual', 12, 12, 1),
  (gen_random_uuid()::text, 'system', 'BIENAL', 'Bienal', 24, 20, 2)
ON CONFLICT ("tenantId", slug) DO UPDATE SET
  nome = EXCLUDED.nome, meses = EXCLUDED.meses,
  "descontoPercent" = EXCLUDED."descontoPercent", ordem = EXCLUDED.ordem;

-- ── Add-ons ─────────────────────────────────────────────────────────────
-- `recorrente` vem da nota do catálogo: o onboarding é one-time, o resto é
-- mensal. É essa coluna que decide se o item entra na mensalidade da
-- proposta ou uma vez só (ver lib/comercial/precificar).
INSERT INTO "AddOnComercial" (
  id, "tenantId", slug, nome, nota, "precoCentavos", recorrente, ativo, ordem
) VALUES
  (gen_random_uuid()::text, 'system', 'sso', 'SSO / SAML dedicado', 'IdP próprio, múltiplos grupos', 90000, true, true, 0),
  (gen_random_uuid()::text, 'system', 'onboarding', 'Onboarding assistido', 'one-time · 4 semanas com CS', 650000, false, true, 1),
  (gen_random_uuid()::text, 'system', 'bpmn', 'Modelagem BPMN hospedada', 'editor no tenant, versionado', 70000, true, true, 2),
  (gen_random_uuid()::text, 'system', 'sla', 'SLA 99,9% + suporte 8×5', 'canal dedicado', 150000, true, true, 3)
ON CONFLICT ("tenantId", slug) DO UPDATE SET
  nome = EXCLUDED.nome, nota = EXCLUDED.nota,
  "precoCentavos" = EXCLUDED."precoCentavos", recorrente = EXCLUDED.recorrente,
  ativo = true, ordem = EXCLUDED.ordem;

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────
SELECT 'servicos' AS tabela, count(*) FROM "Service" WHERE "tenantId" = 'system'
UNION ALL SELECT 'planos', count(*) FROM "PlanoComercial" WHERE "tenantId" = 'system'
UNION ALL SELECT 'modulos', count(*) FROM "PrecoDeModulo" WHERE "tenantId" = 'system'
UNION ALL SELECT 'termos', count(*) FROM "TermoDeContrato" WHERE "tenantId" = 'system'
UNION ALL SELECT 'addons', count(*) FROM "AddOnComercial" WHERE "tenantId" = 'system';

-- Módulos da plataforma que ficaram SEM preço — o gerador de proposta trata
-- ausência como zero (proposta-escopo.ts: `?.precoMensalCentavos ?? 0`), então
-- um módulo listado aqui é vendável de graça sem ninguém perceber.
SELECT unnest(enum_range(NULL::"ProductModule"))::text AS modulo_sem_preco
EXCEPT
SELECT modulo::text FROM "PrecoDeModulo" WHERE "tenantId" = 'system';
