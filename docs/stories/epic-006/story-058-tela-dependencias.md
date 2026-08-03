# Story 058 — Tela Dependências (mapa de bloqueios entre times)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** Essential
**Story mãe:** `docs/stories/epic-006/story-020.md` (AC-005 "Circular dependency prevention",
AC-006 "Dependency line color coding by status")
**Também:** `docs/stories/epic-008/story-042.md` (AC-003 "Circular dependency detection on
DependencyLink creation")

> Por que uma história separada da 020: a 020 é o **Program Board** (grade time × sprint,
> Liveblocks, DND-Kit) e trata a dependência como uma linha desenhada sobre a grade. A tela
> `/cosmos/dependencies` é a outra superfície da mesma regra — a lista de bloqueios, sem
> grade, que o RTE usa fora da sessão de PI Planning. Ela nasceu sem as duas garantias que a
> 020 exige do lado servidor. Nenhum critério aqui é inventado: cada AC aponta para um AC da
> 020 ou da 042.

---

## Jornada do usuário

O RTE abre **ART Board → Dependências** entre cerimônias. Ele precisa de duas coisas:

1. **Registrar um bloqueio sem quebrar o plano.** Uma dependência circular não é um dado ruim,
   é um plano impossível: se A bloqueia B, B bloqueia C e alguém registra que C bloqueia A,
   nenhuma das três pode começar. A 020 AC-005 e a 042 AC-003 mandam **recusar a criação** e
   dizer qual é o ciclo — não aceitar e sinalizar depois.
2. **Levar o bloqueio até o fim.** `DependencyLink.boardStatus` existe com
   IDENTIFIED → IN_PROGRESS → RESOLVED, e a 020 AC-006 cor-codifica exatamente esse campo.
   A tela lia `boardStatus` da action e **não o mostrava**: exibia `status`, o campo textual
   legado. Sem caminho para avançar, toda dependência ficava IDENTIFIED para sempre e o
   quadro nunca dizia o que já foi resolvido.

---

## Acceptance Criteria

### AC-001: Dependência circular é recusada, com o ciclo na mensagem
_(story-020 AC-005; story-042 AC-003 "Circular dependency detected: F-A → F-B → F-C → F-A")_

Given as dependências F-A → F-B e F-B → F-C já registradas no tenant,
When alguém registra F-C → F-A,
Then:
- a criação é recusada;
- a mensagem nomeia o ciclo pelos títulos das features, na ordem em que ele se fecha;
- nenhuma linha de `DependencyLink` é criada.

Given as mesmas dependências,
When alguém registra F-A → F-D,
Then a criação passa — não há ciclo.

### AC-002: Feature não bloqueia a si mesma
_(story-020 AC-005, caso degenerado; `apps/app/app/actions/features/dependencies.ts` já recusa com `SELF_LINK`)_

Given a mesma feature nos dois campos,
When a criação é submetida,
Then é recusada antes de qualquer consulta ao grafo.

### AC-003: A busca do ciclo é escopada por tenant
_(audit 2026-07-23, eixo "Data integrity")_

Given dependências de outro tenant que fechariam um ciclo,
When a criação é avaliada,
Then elas não entram no grafo — a varredura lê apenas `DependencyLink` do tenant da sessão.

Dependência já `RESOLVED` também não entra: bloqueio resolvido não restringe mais a ordem
do trabalho (mesma regra do `detectCircular` de `app/actions/features/dependencies.ts`, que
ignora `boardStatus: RESOLVED`).

### AC-004: Avançar o estado do bloqueio
_(story-020 AC-006 "IDENTIFIED / IN_PROGRESS / RESOLVED"; `DependencyLink.boardStatus`)_

Given uma dependência IDENTIFIED,
When um ADMIN/RTE a move para IN_PROGRESS e depois para RESOLVED,
Then:
- `boardStatus` reflete o novo valor;
- a ação é auditada com o valor anterior;
- a tela mostra o estado atual em cor e em palavra: IDENTIFIED âmbar, IN_PROGRESS azul,
  RESOLVED verde.

Given um usuário sem papel ADMIN/RTE,
When ele tenta avançar,
Then a ação é recusada e nada é gravado.

Given um id de dependência de outro tenant,
When a ação é submetida,
Then é recusada e nada é gravado.

### AC-005: Estado vazio e estado de erro sem dependência fabricada
_(audit 2026-07-23, eixo "Data integrity")_

Given `listDependencies` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhuma** dependência é renderizada.

Given o tenant não tem dependência alguma,
When a tela carrega,
Then aparece o estado vazio convidando a registrar a primeira.

---

## Technical Notes

- Sem migration. `DependencyLink.boardStatus` já existe em
  `packages/database/prisma/schema/planning.prisma` com o vocabulário
  IDENTIFIED/IN_PROGRESS/RESOLVED.
- A detecção de ciclo **reusa** `apps/app/lib/collaboration/dependency-cycle.ts`, que já tinha
  `buildAdjacency`/`wouldCreateCycle` puros e testados mas **sem nenhum chamador de produção**.
  `wouldCreateCycle` passa a ser expresso em termos de `findCyclePath`, o traversal que também
  devolve o caminho — uma implementação só, não duas.
- Uma consulta tenant-escopada monta o grafo inteiro em memória, em vez do DFS com uma consulta
  por nó de `app/actions/features/dependencies.ts`. É a mesma regra com um round-trip.
- O sentido da aresta é `blockingFeatureId → blockedFeatureId`: "A precisa terminar antes de B".
- A `status` textual legada (`not-started`/`on-track`/`at-risk`/`blocked`/`completed`) continua
  sendo exibida; ela e `boardStatus` são dois campos com vocabulários diferentes no mesmo
  registro. Unificá-los exige decidir qual é a fonte de verdade e migrar — registrado como
  lacuna, não resolvido por adivinhação.

## Test Plan

- **Risco:** Médio — guarda de grafo na escrita.
- **Action** (`apps/app/__tests__/actions/dependencies.test.ts`): ciclo é recusado com os
  títulos na mensagem; caminho sem ciclo passa; auto-bloqueio é recusado; a varredura é
  tenant-escopada e ignora RESOLVED; avanço de `boardStatus` exige papel, é IDOR-guardado e
  audita o valor anterior.
- **Tela** (`apps/app/__tests__/screens/dependencies.test.tsx`): o estado do bloqueio aparece
  em palavra; avançar chama a action e recarrega; estado vazio; estado de erro sem dependência
  renderizada. Asserção sobre conteúdo — sem snapshot.
