# Story 056 — Tela Times (diretório de squads do ART)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** TEAM_AND_TECHNICAL_AGILITY · **Nível:** Essential
**Story mãe:** `docs/stories/epic-006/story-017.md` (DoD "Team management (add/remove, SM
assignment, default velocity)", AC-002 "Cadence modification blocked on active PI",
AC-003 "PI Plan creation … ART with ≥1 team")

> Por que uma história separada da 017: a 017 empacota criação de ART, gestão de times e o
> ciclo de vida inteiro do PI Plan numa DoD só, e a parte de **gestão de times** ficou sem
> jornada nem plano de teste próprios — foi a única linha da DoD que nunca virou superfície.
> Esta história cobre **a tela `/cosmos/teams`**. Nenhum critério aqui é inventado: cada AC
> aponta para uma linha da 017 ou para a regra do SAFe 6.0 de que um Agile Team pertence a
> um, e somente um, ART.

---

## Jornada do usuário

O RTE abre **ART Board → Times** antes de abrir o PI Planning. Ele precisa responder duas
perguntas, nessa ordem:

1. **Todo squad está dentro de um ART?** A 017 AC-003 exige "ART com ≥1 time" para gerar o PI
   Plan e seus sprints. Um time sem ART não aparece em PI Plan algum: não recebe sprint, não
   entra no Program Board, não aparece na grade de capacidade. Hoje a tela mostra o badge do
   ART quando existe e **silencia** quando não existe — o buraco é invisível exatamente para
   quem precisa vê-lo.
2. **Como conserto?** Ele vincula o squad ao ART ali mesmo. É a linha "Team management" da DoD
   da 017, a única que nunca ganhou superfície: `createTeam` aceita `artId` na criação e,
   depois disso, não existe caminho para corrigir.

O sistema segura a mão dele num caso: um time que já tem sprint num PI **COMMITTED ou
EXECUTING** não pode trocar de ART no meio do PI. Os sprints daquele time apontam para o PI
Plan do ART antigo; movê-lo deixaria sprint comprometido pendurado num trem que o time não
corre mais. É a mesma regra da 017 AC-002 aplicada ao outro lado da relação ART↔time:
mudança estrutural é bloqueada enquanto há PI ativo.

---

## Acceptance Criteria

### AC-001: Time sem ART é sinalizado, não silenciado
_(story-017 AC-003 "ART with ≥1 team"; audit 2026-07-23 eixo "Data integrity")_

Given um tenant com times, alguns com `artId` e outros sem,
When a tela carrega,
Then:
- os times sem ART aparecem numa seção própria, dizendo por que aquilo importa (não entram em
  PI Planning);
- os times com ART continuam no grid com o badge do ART;
- quando todo time tem ART, a seção não aparece — não se inventa alerta sem causa.

### AC-002: Vincular um time a um ART
_(story-017 DoD "Team management"; SAFe 6.0 — um Agile Team é parte de um, e somente um, ART)_

Given um time sem ART,
When um ADMIN/RTE vincula o time a um ART do tenant,
Then:
- `Team.artId` passa a apontar para aquele ART e nada mais é alterado;
- a ação é auditada (`logAudit`) com o `artId` anterior;
- a lista recarrega e o time sai da seção "sem ART".

Given um usuário sem papel ADMIN/RTE,
When ele tenta vincular,
Then a ação é recusada e nada é gravado.

Given um `artId` que não pertence ao tenant da sessão,
When a ação é submetida,
Then é recusada e nada é gravado — id vindo do cliente é reconferido dentro do tenant.

### AC-003: Realinhar time com PI ativo é recusado
_(story-017 AC-002, mesma regra do outro lado da relação ART↔time)_

Given um time que já pertence ao ART A e tem sprint num PI Plan `COMMITTED` ou `EXECUTING`,
When se tenta movê-lo para o ART B,
Then a operação é recusada com mensagem citando o PI ativo, e `Team.artId` não muda.

Given o mesmo time, mas com sprints apenas em PI Plan `DRAFT`/`PLANNING`/`CLOSED`,
When se tenta movê-lo para o ART B,
Then a operação passa — só PI comprometido ou em execução trava.

Given o time já está no ART pedido,
When a ação é submetida,
Then ela é idempotente: nada é gravado e nenhum guard de PI é consultado — reafirmar o
vínculo existente não é mudança estrutural.

### AC-004: Estado vazio e estado de erro sem time fabricado
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given `listTeams` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhum** time é renderizado.

Given o tenant não tem time algum,
When a tela carrega,
Then aparece o estado vazio, e a seção "sem ART" não aparece.

---

## Technical Notes

- Sem migration. `Team.artId` já é `String?` com relação `ART?` em
  `packages/database/prisma/schema/art-core.prisma` — vincular é escrita de FK existente.
- O guard de PI ativo lê `Sprint` (que tem `teamId` e `piPlanId`) e o `PIPlan.status`, os dois
  filtrados por `tenantId`. Não há relação declarada `Team → PIPlan`; o caminho é pelo sprint,
  que é justamente o registro que ficaria órfão.
- RBAC `ADMIN|RTE` para casar com `createTeam` no mesmo arquivo — quem pode criar o time no
  ART é quem pode movê-lo entre ARTs.
- "add/remove" da DoD da 017: **remover** time não entra aqui. `Sprint`, `TeamCapacitySnapshot`
  e `PIObjective` apontam para `Team` e a exclusão levaria histórico de PI junto; o padrão do
  repo para saída de escopo é transição de status, e `Team` não tem coluna de status. Fica
  como lacuna com `migration: true` no nó.
- "SM assignment" da DoD da 017 idem: `Team.leadUserId` existe, mas não há papel SM materializado
  por time (a autorização do repo é por `MemberRole` no tenant), então atribuir um SM seria
  gravar um id sem regra que o valide. Lacuna registrada, não aproximada.

## Test Plan

- **Risco:** Médio — escrita de FK estrutural com guard temporal (PI ativo).
- **Action** (`apps/app/__tests__/actions/teams.test.ts`): RBAC nega; `artId` de outro tenant é
  recusado; time de outro tenant é recusado; PI `COMMITTED`/`EXECUTING` bloqueia o realinhamento;
  PI `PLANNING` não bloqueia; reafirmar o mesmo ART não consulta o guard nem grava; audita com o
  `artId` anterior.
- **Tela** (`apps/app/__tests__/screens/teams.test.tsx`): a seção "sem ART" lista só time sem
  ART e some quando todos têm; vincular chama a action e recarrega a lista; estado vazio; estado
  de erro sem time renderizado. Asserção sobre conteúdo — sem snapshot.
