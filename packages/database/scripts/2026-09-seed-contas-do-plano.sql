-- Semeia as 27 contas do plano de contas da Nebuloz em `ContaDoPlano`.
--
-- O QUE SEMEIA
--   As 27 contas de packages/provisioning/src/plano-de-contas-nebuloz.ts
--   (grupos 1–6: receita, deduções, custo de entrega, comercial, produto e
--   engenharia, G&A), com o mesmo id/ordem/centro de custo desse arquivo.
--   Gerado a partir dele — se a lista mudar lá, gere este arquivo de novo.
--
-- SÓ CRIA
--   Todo INSERT tem `ON CONFLICT ("tenantId","conta") DO NOTHING`: rodar de
--   novo, ou rodar depois de uma conta já ter sido criada/editada pela tela,
--   não sobrescreve nada.
--
-- ORDEM DE DEPLOY
--   1. O deploy da Vercel aplica a migration `20260907000000_conta_do_plano`
--      (cria a tabela `ContaDoPlano`, vazia).
--   2. Rode este arquivo no SQL Editor do Supabase.
--   3. Confira: `SELECT count(*) FROM "ContaDoPlano" WHERE "tenantId"='system';`
--      deve devolver 27.
--   Até o passo 2 rodar, a tela de Financeiro recusa todo lançamento
--   ("Conta desativada ou fora do plano.") — o DRE existe sem nenhuma conta.

BEGIN;

INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_11','system','1.1','Receita de assinatura — Meridian',1,NULL,true,0,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_12','system','1.2','Receita de assinatura — Charter',1,NULL,true,1,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_13','system','1.3','Receita de assinatura — Cosmos',1,NULL,true,2,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_14','system','1.4','Receita de assinatura — Signal',1,NULL,true,3,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_15','system','1.5','Receita de serviço — Meridian (diagnóstico)',1,NULL,true,4,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_16','system','1.6','Receita de serviço — Scaffold',1,NULL,true,5,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_17','system','1.7','Receita de serviço — Charter (setup)',1,NULL,true,6,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_18','system','1.8','Receita de outros serviços',1,NULL,true,7,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_21','system','2.1','Impostos sobre serviço/receita',2,NULL,true,8,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_22','system','2.2','Cancelamentos e estornos',2,NULL,true,9,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_31','system','3.1','Pessoal de entrega — Meridian',3,'entrega',true,10,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_32','system','3.2','Pessoal de entrega — Scaffold',3,'entrega',true,11,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_33','system','3.3','Pessoal de entrega — Charter/outros',3,'entrega',true,12,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_34','system','3.4','Terceiros e subcontratados de entrega',3,'entrega',true,13,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_35','system','3.5','Ferramentas de entrega',3,'entrega',true,14,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_41','system','4.1','Pessoal de vendas',4,'comercial',true,15,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_42','system','4.2','Pessoal de marketing',4,'comercial',true,16,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_43','system','4.3','Comissões',4,'comercial',true,17,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_44','system','4.4','Ferramentas de vendas e marketing',4,'comercial',true,18,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_45','system','4.5','Mídia paga',4,'comercial',true,19,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_46','system','4.6','Discovery não faturado',4,'comercial',true,20,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_51','system','5.1','Pessoal de engenharia e produto',5,'produto-engenharia',true,21,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_52','system','5.2','Infraestrutura',5,'produto-engenharia',true,22,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_53','system','5.3','Ferramentas de engenharia',5,'produto-engenharia',true,23,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_61','system','6.1','Pessoal de liderança e administrativo',6,'ga',true,24,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_62','system','6.2','Jurídico e contábil',6,'ga',true,25,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;
INSERT INTO "ContaDoPlano" ("id","tenantId","conta","nome","grupo","centroDeCusto","ativa","ordem","criadoEm","atualizadoEm") VALUES ('emp_conta_63','system','6.3','Escritório e outras despesas',6,'ga',true,26,now(),now()) ON CONFLICT ("tenantId","conta") DO NOTHING;

COMMIT;

SELECT count(*) FROM "ContaDoPlano" WHERE "tenantId"='system';
