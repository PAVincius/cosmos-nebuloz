# Story 060 — Tela PI Planning (confidence vote do ART)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** Essential
**Story mãe:** `docs/stories/epic-006/story-018.md` (AC-002 "Votes are anonymous at the data
layer", AC-003 "Reveal gate at ≥50% participation", AC-008 "Closed rounds are immutable")

> Por que uma história separada da 018: a 018 descreve o overlay full-screen via Liveblocks
> dentro do console de ART (`/arts/{id}/pi-planning`) — presença, broadcast, timer. A tela
> `/cosmos/piplanning` é a outra ponta: o painel do PI ativo, que **lê** o placar de confiança e
> não tem caminho para produzi-lo. Sem caminho de escrita, `Confiança média` na tela é sempre
> "—" em qualquer tenant onde ninguém tenha usado o console de ART. Esta história cobre o
> **voto e a revelação a partir da tela do PI ativo**, com as mesmas garantias de dado da 018.

---

## Jornada do usuário

O RTE abre **PI Planning** no fim do dia 2. O plano está na mesa: objetivos com business value,
riscos com desfecho ROAM. Falta a última pergunta da cerimônia — *o ART confia neste plano?*

1. **Cada participante vota de 1 a 5** (fist-of-five). O voto é anônimo por desenho: nada liga o
   voto a quem votou, em nenhuma camada.
2. **O RTE revela** quando participação suficiente foi atingida. Antes disso ninguém vê o
   histograma — inclusive quem já votou —, porque resultado parcial visível muda o voto de quem
   ainda não votou.
3. **O placar entra no gate de commitment** (story-017): confiança abaixo do limiar bloqueia o
   commit do PI.

**O voto é do ART, não por time.** É decisão de modelagem, não omissão: `ConfidenceVoteTally` é
uma linha de contagens por rodada (`score1..5Count`), com `@@unique([voteSessionId, round])` e
sem nenhuma coluna que ligue voto a votante. Acrescentar `teamId` quebraria a unicidade da
rodada **e** a garantia de anonimato — num ART com um time de 4 pessoas, "confiança do time X"
é praticamente o voto nominal de quatro pessoas. No SAFe 6.0 o confidence vote do PI Planning é
do ART inteiro.

---

## Acceptance Criteria

### AC-001: Voto anônimo, agregado na rodada aberta
_(story-018 AC-002)_

Given uma rodada de confidence vote aberta no PI ativo,
When um participante vota 4,
Then:
- apenas `score4Count` e `totalVotes` da rodada são incrementados;
- nenhum id de usuário é gravado junto ao voto, em nenhuma tabela;
- a escrita é do tenant da sessão — a rodada é localizada pelo PI ativo, nunca por id vindo do
  cliente.

### AC-002: Voto só na rodada aberta
_(story-018 AC-008; `packages/safe-engine/src/confidenceVoteMachine.ts`)_

Given uma rodada cujo estado não é `OPEN`,
When um voto é submetido,
Then a operação é recusada e nenhuma contagem muda — quem decide se `SUBMIT_VOTE` é legal é a
máquina de estados do `@repo/safe-engine`, não uma segunda cópia da regra.

Given nenhum PI em Planning/Committed/Executing,
When um voto é submetido,
Then a operação é recusada — não se cria PI nem rodada por efeito colateral de um voto.

### AC-003: Revelação exige participação e é do facilitador
_(story-018 AC-003)_

Given 40% dos participantes elegíveis votaram,
When o facilitador tenta revelar,
Then a operação é recusada citando a participação atual e a mínima (50%), e o resultado
permanece escondido.

Given 60% de participação,
When o facilitador revela,
Then:
- `aggregateScore = Σ(score × count) / totalVotes` é gravado na rodada e na sessão;
- `participationRate`, `revealedAt` e `closedAt` são gravados;
- a rodada sai de `OPEN` pela mesma máquina de estados (`CLOSE_VOTING` → `TALLYING`);
- a ação é auditada com o placar revelado.

Given um usuário sem papel ADMIN/RTE,
When ele tenta revelar,
Then a ação é recusada e nada é gravado.

### AC-004: Histograma só depois da revelação
_(story-018 AC-003 "Results remain hidden")_

Given uma rodada aberta com votos já lançados,
When a tela carrega,
Then ela mostra participação (quantos votaram de quantos) e **não** mostra a distribuição por
nota nem o placar.

Given a rodada revelada,
When a tela carrega,
Then o histograma 1–5 e o placar aparecem.

### AC-005: Estado vazio e estado de erro sem placar fabricado
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given nenhum PI ativo,
When a tela carrega,
Then aparece o estado "Nenhum PI ativo" e nenhum controle de voto.

Given um PI ativo sem rodada de confidence vote,
When a tela carrega,
Then a tela diz que não há rodada aberta, em vez de mostrar placar zerado como se houvesse voto.

---

## Technical Notes

- **Sem migration.** `ConfidenceVoteSession` (com `xStateStatus`) e `ConfidenceVoteTally` (com
  `score1..5Count`, `totalVotes`, `participantCount`, `participationRate`, `aggregateScore`,
  `revealedAt`, `closedAt`) já existem em `packages/database/prisma/schema/metrics.prisma`.
- **A transição não é reimplementada.** `canSendVoteEvent`/`applyVoteEvent` de
  `@repo/safe-engine` são a autoridade sobre o que é legal em cada estado; as actions só
  persistem o resultado. Uma segunda cópia da tabela de transições é como o console de ART e a
  tela do Cosmos passariam a discordar sobre a mesma rodada.
- **`ConfidenceVoteSession.votes`** (Json `number[]`, marcado *legacy* no schema) **não** é
  escrito pelo voto: a contagem por nota mora no tally da story-018. Escrever os dois deixaria
  duas contagens da mesma rodada livres para divergir. Fica como lacuna com `migration: true`.
- **Participação** = `totalVotes / participantCount`, onde `participantCount` é o número de
  `PIParticipant` do PI com papel diferente de `OBSERVER`, congelado na criação do tally (é o
  denominador que a 018 AC-003 usa).
- **RBAC.** Votar não tem gate de papel (todo participante vota, é o ponto da cerimônia);
  revelar é `ADMIN|RTE`, o mesmo gate de facilitador que `app/actions/arts/tally-vote.ts` já
  aplica.
- O overlay Liveblocks, o timer de 60s e o gráfico de tendência cross-PI (018 AC-007) **não**
  entram aqui: o primeiro depende de presença em sala, o segundo de sessão sincronizada e o
  terceiro de PIs fechados com rodada final — ficam como lacunas no nó.

## Test Plan

- **Risco:** Alto — escrita agregada com garantia de anonimato e gate de revelação.
- **Action** (`apps/app/__tests__/actions/piplanning.test.ts`): voto incrementa só a nota votada
  e o total; nenhum userId no payload de escrita; voto fora de `OPEN` é recusado; voto sem PI
  ativo é recusado; revelação sem participação mínima é recusada citando os números; revelação
  calcula o placar ponderado e fecha a rodada pela máquina; RBAC nega a revelação; leitura não
  expõe histograma antes da revelação.
- **Tela** (`apps/app/__tests__/screens/piplanning.test.tsx`): rodada aberta mostra participação
  e esconde o histograma; votar chama a action e recarrega; rodada revelada mostra histograma e
  placar; PI sem rodada; sem PI ativo. Asserção sobre conteúdo — sem snapshot.
