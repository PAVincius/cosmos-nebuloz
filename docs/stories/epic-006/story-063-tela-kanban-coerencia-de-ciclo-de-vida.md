# Story 063 — Tela Kanban de Épicos (coerência com a máquina de ciclo de vida)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**Story mãe:** `docs/stories/epic-006/story-011.md` (AC-003 "Guard failure returns 422
GUARD_FAILED" com `guard` e `message` nomeados; AC-002 INVALID_TRANSITION)
**Também:** `docs/stories/epic-006/story-012.md` (Portfolio Kanban Board with Real-Time Drag)

> Por que uma história separada da 011 e da 012: a 011 é a **máquina** (XState, guards, trigger
> no banco, histórico de transição) e a 012 é o **board** (drag, WIP, tempo real). Esta é a
> junta entre as duas — o que acontece quando alguém arrasta um card e a máquina diz não.
> O board já passa por `transitionEpicStatus` e já não grava `lifecycleStatus` direto. O que
> faltava é o outro lado: a recusa chegava ao usuário como o código cru `GUARD_FAILED`, e o
> tenant demo tinha épicos em estados que a própria máquina não consegue alcançar, o que fazia
> quase todo arraste falhar e parecer bug de UI.

---

## Jornada do usuário

A Portfolio Manager abre **Portfolio → Kanban de Épicos** e arrasta um card do Portfolio
Backlog para Implementando. O board recusa e mostra: **"Não foi possível mover:
GUARD_FAILED"**.

Isso é inútil de duas formas. Ela não sabe o que falta — pode ser aprovação de governança ou
alocação de orçamento, que são coisas diferentes com donos diferentes. E não sabe se o problema
é dela ou do sistema, então o caminho natural é abrir um bug.

A 011 AC-003 já tinha resolvido isso no papel: a recusa carrega `guard` e uma `message` que diz
o que falta ("INVEST score required before moving to Portfolio Backlog"). O que chegava à tela
era só o código.

### O problema mais fundo: estado não alcançável

`transitionEpicStatus` reconstrói a máquina do zero e **reproduz o caminho canônico** até o
estado atual do épico (`fastForwardToState`) antes de avaliar o evento pedido. Esse replay
passa pelos mesmos guards. Consequência: um épico gravado em `PORTFOLIO_BACKLOG` **sem**
`investScore >= 40` e `hypothesis` de pelo menos 50 caracteres nunca chega a
`PORTFOLIO_BACKLOG` no replay — o ator trava em `ANALYZING`, e o evento real
(`START_IMPLEMENTING`) vira `INVALID_TRANSITION`, que é uma mensagem sobre o estado errado.

O seed do tenant demo gravava `lifecycleStatus` em todas as colunas e **nenhum** dos campos que
os guards leem. Resultado: das quatro transições do board, só `FUNNEL → ANALYZING` funcionava.
As outras três explodiam. Um épico em estado que a máquina não consegue representar não é um
dado ruim — é um dado **impossível**, e todo arraste que parte dele falha.

---

## Acceptance Criteria

### AC-001: O estado gravado de um épico é alcançável pela própria máquina
_(story-011 AC-003 e AC-006 — a máquina e o trigger são a fonte de verdade do estado)_

Given um épico gravado em `ANALYZING` ou além,
Then ele tem `investScore >= 40` e `hypothesis` com pelo menos 50 caracteres — os guards de
`canTransitionToBacklog`.

Given um épico gravado em `IMPLEMENTING` ou além,
Then ele tem, além do acima, `leanBudgetAllocation > 0` e um `GovernedEpic` com
`governanceStatus = "approved"` — os guards de `canTransitionToImplementing`.

Given o tenant demo semeado,
When a Portfolio Manager arrasta qualquer card para a coluna seguinte,
Then a transição acontece — nenhuma delas falha por dado que o seed deixou de gravar.

### AC-002: A recusa nomeia o que falta, não o código
_(story-011 AC-003 "{code: GUARD_FAILED, guard: 'investScore', message: 'INVEST score required
before moving to Portfolio Backlog'}")_

Given um épico em `ANALYZING` sem INVEST score e sem hipótese,
When alguém o arrasta para o Portfolio Backlog,
Then a mensagem diz que falta INVEST score e hipótese para entrar no Portfolio Backlog — não
"GUARD_FAILED".

Given um épico em `PORTFOLIO_BACKLOG` sem aprovação de governança e sem alocação de orçamento,
When alguém o arrasta para Implementando,
Then a mensagem diz que falta aprovação de governança e alocação de orçamento.

Given um épico em estado terminal,
When alguém tenta arrastá-lo,
Then a mensagem diz que o épico está em estado final e não aceita mais transição.

Given uma transição que a máquina não define para o estado de origem,
When ela é submetida,
Then a mensagem diz que aquele salto não existe no ciclo de vida, em vez de sugerir que faltou
um dado.

### AC-003: Voltar ao Funil continua sendo recusado
_(SAFe 6.0 — Portfolio Kanban é um funil de mão única; nenhum evento da máquina tem FUNNEL como
destino)_

Given um épico em qualquer coluna,
When alguém o arrasta de volta para o Funil,
Then é recusado com mensagem própria e `transitionEpicStatus` nem chega a ser chamado.

### AC-004: Reordenar dentro da coluna não é transição
_(story-012, drag dentro da mesma coluna)_

Given um épico movido dentro da mesma coluna,
When a nova posição é gravada,
Then só `lifecycleOrder` muda e a máquina não é acionada.

---

## Technical Notes

- **Sem migration.** `Epic.investScore`, `Epic.hypothesis`, `Epic.leanBudgetAllocation` e o
  model `GovernedEpic` já existem. O que faltava é o seed preenchê-los de forma coerente com
  o estado que ele mesmo grava.
- A tradução da recusa mora em `(cosmos)/actions/kanban.ts`, junto do mapa coluna→evento, e
  **não** em `transitionEpicStatus`: aquela action é compartilhada e o código de erro dela é
  contrato de API (a 011 AC-002/003 fala em códigos HTTP). O board traduz o código para a
  frase que faz sentido na coluna de destino; quem consome a API continua vendo o código.
- O seed continua gravando `lifecycleStatus` direto — ele semeia o **estado inicial**, não faz
  transição. A regra que ele passa a honrar é: *o estado gravado precisa ser alcançável pela
  máquina com os dados da própria linha.*
- **Lacuna registrada:** o `fastForwardToState` reconstrói o caminho canônico a cada chamada em
  vez de hidratar o ator no estado persistido. Funciona, e amarra o épico a um caminho histórico
  que ele pode ter percorrido antes de um guard mudar. Trocar por hidratação direta de estado é
  mudança na máquina compartilhada.

## Test Plan

- **Risco:** Médio — mensagem de recusa é a única pista que a usuária tem quando o board diz não.
- **Action** (`apps/app/__tests__/actions/kanban.test.ts`): cada código de recusa da máquina
  vira uma frase distinta que nomeia o guard da coluna de destino; o código cru não vaza; voltar
  ao Funil é recusado sem chamar a máquina; reordenar não aciona a máquina.
- **Máquina** (`apps/app/__tests__/actions/epic-lifecycle-reachability.test.ts`): para cada
  estado que o seed usa, o caminho canônico da máquina só chega lá com os campos que a AC-001
  exige — é a prova executável da regra que o seed honra, já que o teste do seed nunca roda.
