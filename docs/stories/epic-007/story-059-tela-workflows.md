# Story 059 — Tela Workflows (console de ativação de automação)

**Epic:** epic-007 — Solution Train & Advanced Features
**Status:** pending
**Competência SAFe:** CONTINUOUS_LEARNING_CULTURE / Lean-Agile Leadership · **Nível:** Portfolio
**SRD:** FR-030 (`docs/srd-epic-007.md:326`), FR-031 (`docs/srd-epic-007.md:337`)
**Story mãe:** `docs/stories/epic-007/story-028.md` (BPMN Workflow Modeling & XState Runtime)

> Por que uma história separada da 028: a 028 empacota **três** superfícies numa DoD só — o
> canvas BPMN (bpmn-js, co-edição Liveblocks, diff), o compilador BPMN→XState e o runtime de
> transição. As duas primeiras não têm rota alcançável neste app (`apps/app/e2e/bpmn-canvas.spec.ts`
> aponta para `/workflows/[teamId]/bpmn`, que não existe). Esta história cobre **só a tela
> `/cosmos/workflows`**: o console que lista as definições do tenant e liga/desliga qual delas
> governa o trabalho. Nenhum critério aqui é inventado — cada AC sai de FR-030, de FR-031 ou do
> comportamento que `apps/app/app/actions/workflow/transition.ts` já assume hoje.

---

## Jornada do usuário

A RTE abre **Portfolio · Automação → Workflows** quando o time reclama que "a story travou".
Ela precisa responder três perguntas, nessa ordem:

1. **Qual automação está no ar?** Vê as definições do tenant com o gatilho que as dispara,
   quantas ações executam e quantas vezes já rodaram — e, de cada uma, **sobre o quê** ela manda:
   o tipo de entidade (STORY/FEATURE/EPIC) e o dono (ORG/ART/TEAM). Sem o escopo visível, "ativo"
   não quer dizer nada: duas automações ativas de escopos diferentes são normais, duas do mesmo
   escopo são um defeito.
2. **Posso desligar essa sem quebrar o resto?** Uma automação que está escalonando indevidamente
   precisa sair do ar em um clique, sem ser apagada — a definição e o histórico continuam.
3. **O que acontece se eu ligar a nova?** Ligar a v2 de um escopo tem que **desligar a v1 do mesmo
   escopo**, e a tela precisa dizer isso *antes* do clique, não depois.

---

## Acceptance Criteria

### AC-001: Uma ativa por escopo (owner + entityType)
_(FR-030 "one active per owner+entityType"; dependência real de
`apps/app/app/actions/workflow/transition.ts:82`, que carrega a máquina com
`findFirst({ ownerId, active: true })` e portanto pega uma qualquer se houver duas)_

Given uma definição ativa e outra inativa no **mesmo** escopo (`ownerType` + `ownerId` +
`entityType`),
When a inativa é ativada,
Then:
- a que estava ativa passa a `active = false` na mesma transação;
- a nova fica `active = true` com `activatedAt`/`activatedBy` carimbados;
- nunca existe momento observável com duas ativas no escopo — desativar e ativar são uma
  escrita atômica, não duas.

Given uma definição ativa em **outro** escopo (outro `entityType` ou outro `ownerId`),
When uma definição é ativada,
Then a de outro escopo **não** é tocada — a exclusividade é por escopo, não global.

### AC-002: Desativar não cascateia
_(FR-030 "append-only versioning"; FR-031 "stateless per-transition actor reconstruction")_

Given uma definição ativa,
When ela é desativada,
Then:
- só `active` muda; `activatedAt`/`activatedBy` ficam como estão, porque são o registro histórico
  de *quando foi ativada*, não de *está ativa agora*;
- nenhuma outra definição é ativada no lugar — o escopo simplesmente fica sem automação, e o
  runtime devolve `NO_ACTIVE_WORKFLOW` em vez de escolher sozinho um substituto.

### AC-003: Ativação é escrita privilegiada, guardada por tenant e auditada
_(FR-030 "Actors: SM, RTE, SA, Compliance Officer, Platform Admin"; NFR
`docs/srd-epic-007.md:378` "integration lifecycle ... written to immutable audit trail")_

Given um papel fora de `ADMIN`/`RTE`/`STE`,
When a ativação é submetida,
Then é recusada e **nada** é gravado.

Given um id de definição de outro tenant,
When a ativação é submetida,
Then é recusada pela reconferência de `tenantId` e nada é gravado.

Given a ativação passa,
Then um `AuditLog` registra a mudança de estado com o id da definição substituída, quando houve
substituição — trocar a automação que governa um ART é decisão de governança, não preferência.

### AC-004: A tela mostra o escopo e avisa a substituição antes do clique
_(FR-030 "team overrides org"; audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`,
eixo "Handoff coverage")_

Given uma definição inativa cujo escopo já tem outra ativa,
When a tela carrega,
Then o controle de ativação anuncia qual definição será substituída, e cada linha exibe o escopo
(`entityType` · `ownerType`).

Given uma definição inativa cujo escopo **não** tem nenhuma ativa,
When a tela carrega,
Then o controle apenas ativa, sem anunciar substituição que não vai acontecer.

### AC-005: Estado vazio e estado de erro sem automação fabricada
_(audit 2026-07-23, eixo "Data integrity")_

Given `listWorkflows` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhuma** automação é renderizada.

Given o tenant não tem definição alguma,
When a tela carrega,
Then aparece o estado vazio — e nenhum KPI inventa número.

---

## Technical Notes

- **Sem migration.** `BpmnDefinition` já tem `active`, `activatedAt`, `activatedBy`,
  `triggerLabel`, `actionCount`, `runCount` (`packages/database/prisma/schema/planning.prisma:59`)
  e o índice `@@index([tenantId, entityType, ownerId, active])`. A exclusividade do AC-001 **não**
  vira `@@unique` porque unique com booleano proibiria o caso legítimo "nenhuma ativa no escopo"
  ter mais de uma inativa; a invariante é imposta na escrita, dentro de `$transaction`.
- **O builder BPMN não entra.** Criar/editar definição é o canvas da story-028, outra ordem de
  grandeza (bpmn-js + moddle `cosmos:*` + Liveblocks + compilador). Esta tela não oferece "criar
  workflow" — a ausência é deliberada e está dita no cabeçalho do componente.
- **`ownerId` não é resolvido para nome.** `BpmnDefinition.ownerId` é polimórfico (ORG/ART/TEAM)
  e não tem relação Prisma; resolver o nome exigiria três consultas condicionais por linha. A tela
  mostra o `ownerType`, que é o que muda o significado da exclusividade. Lacuna registrada no nó.
- `runCount`/`actionCount` são denormalizações que o schema declara como
  "recomputed on activate/run"; nada neste app as recomputa hoje (o runtime de transição não
  incrementa `runCount`). A tela mostra o valor persistido como está — não estima. Lacuna registrada.

## Test Plan

- **Risco:** Alto — a escrita muda qual máquina de estados governa entidades de trabalho reais.
- **Action** (`apps/app/__tests__/actions/workflows.test.ts`): leitura filtra por `tenantId`;
  ativação exige papel e **fecha** para papel sem permissão; IDOR guardado; ativar desativa a
  irmã do mesmo escopo e **não** toca outro escopo; desativar não mexe em `activatedAt`; auditoria
  registra a substituição.
- **Tela** (`apps/app/__tests__/screens/workflows.test.tsx`): escopo visível por linha; o controle
  anuncia a substituição só quando ela vai acontecer; toggle chama a action e recarrega; estado
  vazio; estado de erro sem automação renderizada. Asserção sobre conteúdo — sem snapshot.
- **Seed** (`packages/database/scripts/seed-cosmos.mts`): o tenant demo precisa de duas definições
  no mesmo escopo (uma ativa, uma inativa) e uma em escopo distinto — sem isso a tela abre vazia e
  a regra do AC-001 não tem o que demonstrar. `xmlGzip` é obrigatório: o seed grava o XML BPMN
  mínimo real gzipado, não bytes aleatórios.
