# Story 060 — Tela Board do Time (stories e tasks do nível Team)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** TEAM_AND_TECHNICAL_AGILITY · **Nível:** Team
**Story mãe:** as entidades e ações já existem — `app/actions/stories`, `app/actions/tasks` e
`app/actions/sprints` — e nenhuma delas tem chamador no app.

> Por que esta história existe: o Cosmos tem 38 telas e **nenhuma no nível Team**. A tela de
> times (`/cosmos/teams`) é um diretório; a de detalhe (`/cosmos/team/<id>`) é um painel de
> métricas — velocity por sprint, predictability, capacidade. Nenhuma das duas mostra o
> trabalho: story em coluna, task dentro da story. O SAFe 6.0 chama isso de Team Backlog e
> Iteration Execution, e é o nível onde o trabalho de fato acontece.
>
> O backend está inteiro e sem uso: `createStory`, `listStories`, `updateStoryStatus`,
> `reorderStories`, `moveStoryToSprint`, `splitStory` (0 chamadores fora de teste);
> `createTask`, `listTasksByStory`, `updateTaskStatus`, `deleteTask` (0 chamadores, e até
> agora **0 testes** — cobertos em `__tests__/actions/tasks/tasks.test.ts` por esta história).
> A única superfície que existia, `create-story-modal.tsx`, está órfã: nenhum arquivo a importa.

---

## Jornada do usuário

O Scrum Master ou o desenvolvedor abre o board para responder três perguntas do dia:

1. **O que está em andamento nesta iteração?** Precisa das stories da sprint ativa do seu time,
   agrupadas por estado, não de uma lista paginada.
2. **O que eu movo?** Ao terminar uma story ele muda o estado dela. `updateStoryStatus` já
   carimba `startedAt` na entrada em IN_PROGRESS e `completedAt` na entrada em DONE — o board
   precisa expor a transição, não recriar a regra.
3. **O que falta dentro da story?** A task é a decomposição do trabalho da story, e é onde o
   time vê o resto. `createTask` exige `storyId`, então task só existe dentro de uma story —
   não há task solta no board.

Um detalhe de papel que a tela precisa respeitar em vez de descobrir por erro: a política
(`app/actions/permissions-policy.ts`) libera `Task` create/update/delete para **SM e DEV**, e
não para PO. É deliberado — a task é do time, o PO é dono do backlog. A tela não deve oferecer
ao PO um botão que sempre falha.

---

## Acceptance Criteria

### AC-001: Colunas por estado, com a story na coluna certa
Given um time com sprint e stories em estados diferentes,
When o board carrega,
Then:
- há uma coluna para cada estado de `StoryStatus` (BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE);
- cada story aparece na coluna do seu estado, e em nenhuma outra;
- a coluna mostra quantas stories tem — o board é também um sinal de WIP.

### AC-002: Trocar o time e a sprint
Given um tenant com mais de um time,
When o usuário troca o time,
Then o board recarrega com as sprints daquele time e nenhuma story do time anterior permanece.

Given um time sem sprint,
Then a tela diz que a sprint vem do PI Plan do ART — e aponta `/cosmos/arts`, que é onde ela é
gerada. Não oferece "criar sprint" avulso: no SAFe a sprint nasce da cadência do PI.

### AC-003: Mover a story de coluna
Given uma story em TODO,
When o usuário a move para IN_PROGRESS,
Then:
- `updateStoryStatus` é chamada com o id da story e o estado destino;
- o board recarrega e a story aparece na coluna nova.

### AC-004: Criar story na sprint selecionada
Given uma sprint selecionada,
When o usuário cria uma story com título e pontos,
Then `createStory` é chamada com o `sprintId` da sprint selecionada — nunca sem sprint, que a
deixaria fora do board que a criou.

### AC-005: Task vive dentro da story
Given uma story aberta,
When o usuário cria uma task nela,
Then `createTask` é chamada com o `storyId` daquela story.

Given uma task em TODO,
When o usuário a marca como concluída,
Then `updateTaskStatus` é chamada com DONE.

### AC-006: Vazio e erro sem trabalho fabricado
Given um tenant sem time, uma sprint sem story, ou uma falha de leitura,
Then a tela diz qual é o caso e não renderiza story nem task inventada.

---

## Fora do escopo

- **Arrastar e soltar.** A transição acontece por controle explícito na story. Drag-and-drop é
  outra história, e sem ele a tela já cumpre AC-003 e fica acessível por teclado.
- **`splitStory`, `moveStoryToSprint`, `reorderStories`.** Existem e estão testadas; são a
  próxima camada do board, não a primeira.
- **Defect e Impedimento.** Modelos existem, superfície não. Fora daqui.

---

## Plano de teste

`__tests__/actions/tasks/tasks.test.ts` — 15 casos sobre as ações de task, escritos **antes**
da tela: escopo de tenant, IDOR no `storyId`, `completedAt` derivado da transição, vocabulário
de status, e a recusa do PO.

`__tests__/screens/board.test.tsx` — render test, asserção sobre conteúdo, sem snapshot:

| AC | Teste |
|---|---|
| AC-001 | cada story na sua coluna; contagem por coluna |
| AC-002 | trocar de time recarrega; time sem sprint aponta /cosmos/arts |
| AC-003 | mover chama updateStoryStatus e recarrega |
| AC-004 | criar story manda o sprintId selecionado |
| AC-005 | criar task manda o storyId; concluir manda DONE |
| AC-006 | vazio e erro sem story fabricada |
