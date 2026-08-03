# Story 059 — Tela Riscos (registro ROAM do ART)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** Essential
**Story mãe:** `docs/stories/epic-006/story-019.md` (AC-002 "ROAM transitions with guards",
AC-003 "COMMITTED PI Plan blocks unROAMed risks", DoD "5-lane ROAM Kanban")

> Por que uma história separada da 019: a 019 empacota o registro ROAM, o surfacing por IA
> (pgvector), a quick-poll de 60s e o cron de staleness numa DoD só. A tela `/cosmos/risks`
> nasceu cobrindo **só a criação** — o risco entra em `UNCLASSIFIED` e congela ali, porque não
> existe caminho para mudar o desfecho. Esta história cobre a parte da 019 que a tela precisa
> para cumprir a prática: **a transição ROAM** e a **matriz de probabilidade × impacto** com
> vocabulário que caiba no desenho. Nada aqui é inventado: cada AC aponta para uma linha da 019
> ou para a regra do SAFe 6.0 de que nenhum risco fica sem desfecho antes do commitment do PI.

---

## Jornada do usuário

O RTE abre **Riscos** no dia 2 do PI Planning, ou num ART Sync no meio do PI. Ele responde três
perguntas, nessa ordem:

1. **Quais riscos ainda não têm desfecho?** O SAFe exige que todo risco levantado no PI Planning
   receba um dos quatro desfechos ROAM — Resolved, Owned, Accepted, Mitigated — antes do time se
   comprometer com o PI. A 019 AC-003 transforma isso em gate: PI com risco `UNCLASSIFIED` não
   comita. Hoje a tela mostra o badge `UNCLASSIFIED` e não oferece saída, então o gate nunca pode
   ser satisfeito pela tela que registra o risco.
2. **Qual desfecho, e com que compromisso?** Desfecho ROAM não é rótulo: `OWNED` sem dono é uma
   promessa sem responsável, `MITIGATED` sem plano é um plano imaginário, `RESOLVED` sem nota de
   resolução é uma afirmação sem prova. São os três guards da 019 AC-002.
3. **Onde este risco cai na matriz?** A matriz de probabilidade × impacto é o instrumento de
   priorização da sessão. Ela nasceu 3×3 porque o vocabulário gravado tinha três níveis
   (`low`/`medium`/`high`), enquanto o desenho da tela (`apps/app/lib/cosmos-data.ts:833`) e a
   própria escala de severidade do modelo (`Risk.severity` 1–5) trabalham em cinco.

O sistema segura a mão dele num caso: **não existe caminho de volta para `UNCLASSIFIED`**.
Desclassificar um risco depois de o PI ter sido comprometido esvaziaria o gate da AC-003 sem
deixar rastro de que a decisão foi revertida — a 019 só descreve transições **para** os quatro
desfechos.

---

## Acceptance Criteria

### AC-001: Transição ROAM com guard por desfecho
_(story-019 AC-002)_

Given um risco em `UNCLASSIFIED`,
When um ADMIN/RTE o move para `OWNED` **sem** informar dono,
Then a operação é recusada com `ownerRequired` e nada é gravado.

Given o mesmo risco,
When é movido para `OWNED` **com** dono,
Then `roamStatus=OWNED`, `ownedAt` é carimbado e o dono passa a aparecer na linha do registro.

Given um risco,
When é movido para `MITIGATED` com plano de mitigação de menos de 30 caracteres,
Then a operação é recusada com `mitigationPlanRequired` e nada é gravado.

Given um risco,
When é movido para `RESOLVED` sem nota de resolução,
Then a operação é recusada com `resolutionNoteRequired` e nada é gravado; com nota, `resolvedAt`
é carimbado.

Given um risco,
When é movido para `ACCEPTED`,
Then a transição passa sem exigir campo extra — aceitar é a decisão de conviver com o risco.

### AC-002: A trilha é o que torna o commitment auditável
_(story-019 AC-002 + PRD-v1.0 UC-03 passo 6 "AuditLog records ROAM classification decision with
RTE userId, timestamp, and prior status")_

Given qualquer transição bem-sucedida,
When ela é gravada,
Then `logAudit` registra ator, entidade `risk` e o **estado anterior** no diff
(`UNCLASSIFIED→OWNED`).

Given um usuário sem papel ADMIN/RTE,
When ele tenta transicionar,
Then a ação é recusada e nada é gravado.

Given um `riskId` que não pertence ao tenant da sessão,
When a ação é submetida,
Then é recusada e nada é gravado — id vindo do cliente é reconferido dentro do tenant.

### AC-003: `UNCLASSIFIED` não é destino
_(story-019 AC-003 — o gate de commitment depende de o desfecho ser terminal)_

Given um risco já classificado,
When se tenta movê-lo de volta para `UNCLASSIFIED`,
Then a ação é recusada na validação de entrada e nada é gravado.

### AC-004: Matriz 5×5 sobre o vocabulário de cinco níveis
_(`apps/app/lib/cosmos-data.ts:833` `prob`/`impact` 1–5; `Risk.severity` 1–5)_

Given riscos com `probability`/`impact` no vocabulário
`very_low | low | medium | high | very_high`,
When a tela carrega,
Then a matriz é uma grade 5×5 e cada risco cai na célula do seu par (probabilidade, impacto).

Given um risco gravado antes desta história, com `probability="high"`,
When a tela carrega,
Then ele continua caindo na coluna "Alta" — o vocabulário **estende** o anterior, não o
substitui, e nenhum dado existente é invalidado.

### AC-005: Estado vazio e estado de erro sem risco fabricado
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given `listRisks` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhum** risco é renderizado.

Given o tenant não tem risco algum,
When a tela carrega,
Then aparece o estado vazio e nenhum botão de transição.

---

## Technical Notes

- **Sem migration.** `Risk.probability` e `Risk.impact` são `String` com default `"medium"` em
  `packages/database/prisma/schema/art-core.prisma` — cinco níveis cabem sem tocar no schema, e
  `low`/`medium`/`high` seguem válidos. `Risk.roamStatus`, `ownedAt`, `mitigationPlan`,
  `resolutionNote` e `resolvedAt` também já existem (a 019 os criou).
- **Vocabulário.** `very_low`(1) · `low`(2) · `medium`(3) · `high`(4) · `very_high`(5). Os pesos
  1–5 não são arbitrados aqui: a tela já mapeava `low/medium/high → 2/3/4`, deixando 1 e 5 vagos
  exatamente para as duas pontas que faltavam.
- **Dono do risco.** A escrita usa `Risk.ownerUserId` — a coluna que `listRisks` resolve em nome
  de usuário. `Risk.ownerId` é uma segunda coluna de dono que só a action órfã
  `apps/app/app/actions/risks/roam-transition.ts` escreve (sem UI que a chame); consolidar as
  duas exige migration e fica como lacuna no nó, não como escrita duplicada.
- **RBAC `ADMIN|RTE`.** Criar risco é `ADMIN|RTE|PO|SM` (qualquer um levanta risco na sessão);
  **classificar** é do facilitador — o PRD-v1.0 UC-03 passo 4 põe a confirmação final do
  `roamStatus` na mão do RTE.
- A quick-poll de 60s (019 AC-006), o surfacing por IA (AC-004/AC-007) e o cron de staleness
  (AC-005) **não** entram aqui: dependem de PISession/Liveblocks, de pgvector e de agendador.
  Ficam como lacunas registradas no nó, não como aproximações.

## Test Plan

- **Risco:** Médio — escrita de estado terminal com guard por destino e trilha de auditoria.
- **Action** (`apps/app/__tests__/actions/risks.test.ts`): RBAC nega; risco de outro tenant é
  recusado; cada guard (`ownerRequired`, `mitigationPlanRequired`, `resolutionNoteRequired`)
  recusa e não grava; `ACCEPTED` passa sem campo extra; `ownedAt`/`resolvedAt` carimbados;
  auditoria com o `roamStatus` anterior; `UNCLASSIFIED` recusado como destino; vocabulário de
  cinco níveis aceito na criação.
- **Tela** (`apps/app/__tests__/screens/risks.test.tsx`): a matriz tem 25 células; risco cai na
  célula do seu par; valor legado `high` continua posicionado; transição pela tela chama a action
  e recarrega a lista; estado vazio; estado de erro sem risco renderizado. Asserção sobre
  conteúdo — sem snapshot.
