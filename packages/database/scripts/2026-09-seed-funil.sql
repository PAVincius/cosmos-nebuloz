-- Semeia os 4 estágios do funil e os 5 canais de lead da Nebuloz em
-- `EstagioDoFunil` e `CanalDeLead`.
--
-- O QUE SEMEIA
--   Os 4 estágios (peso, teto, critérios de saída) e os 5 canais de
--   packages/provisioning/src/funil-nebuloz.ts (`ESTAGIOS_NEBULOZ`,
--   `CANAIS_NEBULOZ`), mesmo código/slug/ordem desse arquivo. Gerado a
--   partir dele — se a lista mudar lá, gere este arquivo de novo.
--
-- SÓ CRIA
--   Todo INSERT tem `ON CONFLICT ... DO NOTHING`: rodar de novo, ou rodar
--   depois de um estágio/canal já ter sido editado pela tela (painel do
--   estágio, tela de CAC), não sobrescreve nada.
--
-- ORDEM DE DEPLOY
--   1. O deploy da Vercel aplica a migration `20260908000000_funil_v2`
--      (cria as 4 tabelas novas e já faz o backfill de `estagioDesde`,
--      `notaPerda` e uma linha de `HistoricoDeEstagio` por lead existente —
--      nada disso depende deste script).
--   2. Rode este arquivo no SQL Editor do Supabase.
--   3. Confira o SELECT final: deve devolver `4 | 5`.
--   Até o passo 2 rodar, o board do funil funciona (estágio embutido no
--   `Lead`), mas o painel do estágio (peso/teto/critérios) e o filtro por
--   canal aparecem vazios: sem canal cadastrado é impossível criar lead
--   (`NovoLeadDialog` bloqueia o formulário) e, sem `EstagioDoFunil`, os KPIs
--   "Pipeline ponderado" e "Estagnados" mostram "—" em vez de 0.

BEGIN;

INSERT INTO "EstagioDoFunil" ("id","tenantId","codigo","pesoPercent","tetoDias","criterios","ordem","atualizadoEm") VALUES ('funil_estagio_lead','system','LEAD',10,7,ARRAY['Contato respondeu e aceitou conversar','Sponsor ou caminho até ele identificado','Porta de entrada na Escada registrada']::text[],0,now()) ON CONFLICT ("tenantId","codigo") DO NOTHING;
INSERT INTO "EstagioDoFunil" ("id","tenantId","codigo","pesoPercent","tetoDias","criterios","ordem","atualizadoEm") VALUES ('funil_estagio_discovery','system','DISCOVERY',30,14,ARRAY['Problema descrito na linguagem do cliente, não da Nebuloz','Decisor com orçamento participou de uma reunião','Baseline mínimo do processo alvo conhecido']::text[],1,now()) ON CONFLICT ("tenantId","codigo") DO NOTHING;
INSERT INTO "EstagioDoFunil" ("id","tenantId","codigo","pesoPercent","tetoDias","criterios","ordem","atualizadoEm") VALUES ('funil_estagio_evaluation','system','EVALUATION',60,21,ARRAY['Escopo fechado: serviço, módulo e assentos','Capacidade simulada para a janela pedida','Preço de tabela aceito como ponto de partida']::text[],2,now()) ON CONFLICT ("tenantId","codigo") DO NOTHING;
INSERT INTO "EstagioDoFunil" ("id","tenantId","codigo","pesoPercent","tetoDias","criterios","ordem","atualizadoEm") VALUES ('funil_estagio_proposal','system','PROPOSAL',80,30,ARRAY['Proposta enviada ao decisor, não ao contato','Data de decisão combinada','Desfecho registrado: ganha → tenant, perdida → motivo']::text[],3,now()) ON CONFLICT ("tenantId","codigo") DO NOTHING;

INSERT INTO "CanalDeLead" ("id","tenantId","slug","nome","cacMedioCentavos","ativo","ordem") VALUES ('funil_canal_indicacao','system','indicacao','Indicação',NULL,true,0) ON CONFLICT ("tenantId","slug") DO NOTHING;
INSERT INTO "CanalDeLead" ("id","tenantId","slug","nome","cacMedioCentavos","ativo","ordem") VALUES ('funil_canal_evento','system','evento','Evento',NULL,true,1) ON CONFLICT ("tenantId","slug") DO NOTHING;
INSERT INTO "CanalDeLead" ("id","tenantId","slug","nome","cacMedioCentavos","ativo","ordem") VALUES ('funil_canal_inbound','system','inbound','Inbound',NULL,true,2) ON CONFLICT ("tenantId","slug") DO NOTHING;
INSERT INTO "CanalDeLead" ("id","tenantId","slug","nome","cacMedioCentavos","ativo","ordem") VALUES ('funil_canal_outbound','system','outbound','Outbound',NULL,true,3) ON CONFLICT ("tenantId","slug") DO NOTHING;
INSERT INTO "CanalDeLead" ("id","tenantId","slug","nome","cacMedioCentavos","ativo","ordem") VALUES ('funil_canal_parceiro','system','parceiro','Parceiro',NULL,true,4) ON CONFLICT ("tenantId","slug") DO NOTHING;

COMMIT;

SELECT
  (SELECT count(*) FROM "EstagioDoFunil" WHERE "tenantId"='system') AS estagios,
  (SELECT count(*) FROM "CanalDeLead" WHERE "tenantId"='system') AS canais;
