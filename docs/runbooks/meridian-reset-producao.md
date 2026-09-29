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
   do E2E M1–M11. Aceite: bloco 5 com o grupo `apaga` todo em 0, o grupo `mantém`
   igual ao bloco 2, nenhum erro.
2. **Conferir o alvo.** Antes de qualquer bloco em produção, confira o host do
   `DATABASE_URL` que o SQL Studio está usando e cite-o no relatório. Só afirme o
   resultado ("reset aplicado") depois de ver a contagem no próprio banco.
3. **Nome de backup livre.** O schema `backup_meridian_20260929` não pode existir
   em produção. Se existir, o bloco 1 falha (é de propósito, para não
   sobrescrever backup anterior); escolha outro sufixo de data no arquivo inteiro.

## Rodar

Na ordem, um bloco por vez no SQL Studio:

1. **Backup** — copia as 13 tabelas para `backup_meridian_20260929`.
2. **Contagem antes** — guarde a saída no relatório.
3. **Vínculo externo** — `trilhas_vinculadas` = número de `ScaffoldTrack` com
   `sourceGapId` ou `sourcePromotionId` preenchido. Não há FK, então apagar
   deixaria a trilha apontando para gap que não existe. **Se for maior que 0:
   pare e registre; não rode o bloco 4.** O bloco 4 repete a guarda e aborta
   sozinho, mas a decisão de seguir é do CEO.
4. **Apagamento** — transação única. Aborta e desfaz tudo se houver trilha
   vinculada ou se sobrar qualquer linha nas tabelas apagadas.
5. **Contagem depois** — grupo `apaga` em 0; grupo `mantém` igual ao passo 2.

Se o bloco 4 falhar, nada foi apagado e o backup do bloco 1 segue no lugar.

## Depois do SQL

6. **Bucket.** Esvazie `meridian-evidence` pelo painel Storage do Supabase. As
   linhas de `MeridianEvidence` já foram apagadas, então os arquivos ficam sem
   dono; cite no relatório quantos objetos havia e que o bucket ficou vazio.
7. **Conferir no app.** Em `app.nebuloz.ai/meridian`, a lista de diagnósticos vem
   vazia e o consultor consegue abrir um diagnóstico novo com o template mantido.

## Backup e prazo (dado pessoal)

O schema `backup_meridian_20260929` guarda respondentes, respostas e evidências:
é dado pessoal. **Prazo de 30 dias**, contado do dia em que o bloco 1 rodar em
produção (com o reset em 2026-09-29: **2026-10-29**).

- **Quem apaga:** Pilar (quem aplica em produção), com a confirmação de Lacre de
  que o prazo venceu.
- **Como:** `DROP SCHEMA backup_meridian_20260929 CASCADE;` com "vai" do CEO,
  conferindo o host antes. Registre a data de apagamento no relatório.
- **Restaurar antes do prazo:** `INSERT INTO "<Tabela>" SELECT * FROM
  backup_meridian_20260929."<Tabela>"` na ordem inversa do apagamento
  (`MeridianBenchmarkCohort` primeiro, `MeridianGapPromotion` por último), só
  com "vai" do CEO. Restaurar não recria arquivos do bucket.

## Revisões

- **Vigia:** escopo de tenant (o reset é global por decisão do CEO) e nada fora
  do domínio Meridian.
- **Lacre:** prazo e responsável pelo backup acima.
