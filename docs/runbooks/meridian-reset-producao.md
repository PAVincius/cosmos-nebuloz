# Reset do Meridian em produção

Zera os dados de diagnóstico do Meridian em **todos os tenants**, mantendo a
configuração e o acesso das pessoas. O SQL é `apps/app/scripts/sql/meridian-reset.sql`:
o mesmo arquivo roda no banco local antes, para provar a ordem de FK, e depois
no SQL Studio da produção.

**Escrita em produção: só com "vai" do CEO, por operação.** Este runbook não dá
essa autorização.

## Escopo

| | Tabelas |
|---|---|
| **Apaga** (nesta ordem) | `MeridianGapPromotion`, `MeridianPlanItem`, `MeridianGapDependency`, `MeridianGap`, `MeridianEvidence`, `MeridianResponse`, `MeridianOverride`, `MeridianAxisScore`, `MeridianRespondent`, `MeridianAssessment`, `MeridianBenchmarkContribution`, `MeridianBenchmarkCohort`, `MeridianSequence` |
| **Mantém** | `MeridianTemplate`, `MeridianQuestion` (sem eles não se abre diagnóstico novo), `MeridianMembership` (acesso das pessoas) |
| **Não toca** | `AuditLog` (o trigger impede apagar; Lacre aceitou em 856ad865) |
| **Fora do SQL** | bucket `meridian-evidence` do Supabase Storage (passo 6) |

`MeridianGap` sai antes de `MeridianAssessment` porque a FK é `Restrict`.

`MeridianSequence` é apagada, não atualizada: a coluna é `next` (default 1) e o
upsert de `_shared.ts` trata linha ausente como primeiro número. Com a tabela
vazia, o próximo diagnóstico volta a ser `AS-001` e o próximo gap `G-01`.

## Antes de rodar

1. **Local primeiro.** Rode o arquivo inteiro no banco local (porta 5434) depois
   do E2E M1–M11. Aceite: bloco 4 com o grupo `apaga` todo em 0, o grupo `mantém`
   igual ao bloco 1, nenhum erro.
2. **Conferir o alvo.** Antes de qualquer bloco em produção, confira o host do
   `DATABASE_URL` que o SQL Studio está usando e cite-o no relatório. Só afirme o
   resultado ("reset aplicado") depois de ver a contagem no próprio banco.
3. **Schema fora da API.** No painel do Supabase, em Dashboard > API Settings,
   confira que `backup_meridian_20260929` **não** está em *Exposed schemas*.
   O backup guarda respondentes de todos os tenants; o schema novo não herda RLS
   nem grants, então o SQL o fecha para `anon`, `authenticated` e `service_role`
   (REVOKE + RLS ligada e forçada, sem policy). O bloco 3 confere
   `has_schema_privilege(<papel>, schema, 'USAGE') = false` e aborta antes do
   DELETE se algum papel ainda enxergar o schema.
4. **Papel dono do banco.** Rode como `postgres` no SQL Studio. O bloco 3 recusa
   papel que não ignore RLS (as guardas contariam zero sob RLS).
5. **Nome de backup livre.** O schema `backup_meridian_20260929` não pode existir
   em produção. Se existir, o bloco 3 falha e desfaz tudo (é de propósito, para
   não misturar backups); escolha outro sufixo de data no arquivo inteiro.

## Rodar

Na ordem, um bloco por vez no SQL Studio:

1. **Contagem antes** — guarde a saída no relatório.
2. **Vínculos externos** — `trilhas_vinculadas` = número de `ScaffoldTrack` com
   `sourceGapId` ou `sourcePromotionId` preenchido. Não há FK, então apagar
   deixaria a trilha apontando para gap que não existe. **Se for maior que 0:
   pare e registre; não rode o bloco 3.** O bloco 3 repete a guarda e aborta
   sozinho, mas a decisão de seguir é do CEO.
3. **Transação única** — backup e apagamento no mesmo `BEGIN..COMMIT`. Ela:
   1. exige papel que ignore RLS;
   2. trava a escrita nas 13 tabelas (`LOCK ... SHARE ROW EXCLUSIVE`,
      `lock_timeout` de 30 s). O `/meridian-responder` é público e grava a
      qualquer hora: sem a trava, uma resposta entre o backup e o DELETE
      sumiria sem estar no backup. Durante a transação as gravações esperam na
      fila; leituras seguem;
   3. cria o backup e o fecha para os papéis da API;
   4. aborta se houver trilha do Scaffold, ou linha do `ProcessRegistry`
      (tabela do Alicerce; só conferida se existir), apontando para gap;
   5. apaga na ordem de FK e aborta se sobrar qualquer linha.
   Qualquer aborto desfaz tudo, backup incluído; nada foi apagado.
4. **Contagem depois** — grupo `apaga` em 0; grupo `mantém` igual ao passo 1.

## Depois do SQL

5. **Bucket.** Esvazie `meridian-evidence` pelo painel Storage do Supabase. As
   linhas de `MeridianEvidence` já foram apagadas, então os arquivos ficam sem
   dono. **O bucket não tem backup**: esvaziado, os arquivos não voltam. Cite no
   relatório quantos objetos havia e que o bucket ficou vazio.
6. **Conferir no app.** Em `app.nebuloz.ai/meridian`, a lista de diagnósticos vem
   vazia e o consultor consegue abrir um diagnóstico novo com o template mantido.

## Backup e prazo (dado pessoal)

O schema `backup_meridian_20260929` guarda respondentes, respostas e evidências
de todos os tenants: é dado pessoal. **Prazo de 30 dias**, contado do dia em que
o bloco 3 rodar em produção (com o reset em 2026-09-29: **2026-10-29**).

- **Quem apaga:** Pilar (quem aplica em produção), com a confirmação de Lacre de
  que o prazo venceu.
- **Como:** `DROP SCHEMA backup_meridian_20260929 CASCADE;` com "vai" do CEO,
  conferindo o host antes. Registre a data de apagamento no relatório.
- **O que o DROP não apaga:** os backups automáticos e o PITR da plataforma
  Supabase continuam contendo os dados do período de retenção do plano. Apagar
  o schema encerra a cópia que este runbook criou, não essas. Lacre deve levar
  isso em conta ao responder pedido de exclusão de titular dentro da janela.
- **Restaurar antes do prazo, só com "vai" do CEO.** As tabelas de destino
  precisam estar **vazias** antes: `MeridianGap` tem unicidade `(tenantId, code)`
  e `MeridianSequence` também, então restaurar sobre linhas criadas depois do
  reset colide. Esvazie as tabelas (na mesma ordem do bloco 3), depois
  `INSERT INTO "<Tabela>" SELECT * FROM backup_meridian_20260929."<Tabela>"` na
  ordem inversa do apagamento (`MeridianBenchmarkCohort` primeiro,
  `MeridianGapPromotion` por último). Diagnósticos abertos depois do reset
  serão perdidos: exporte-os antes, se houver. Restaurar não recria os arquivos
  do bucket.

## Revisões

- **Vigia:** escopo de tenant (o reset é global por decisão do CEO), nada fora
  do domínio Meridian, fechamento do backup e trava de escrita.
- **Lacre:** prazo e responsável pelo backup acima.
