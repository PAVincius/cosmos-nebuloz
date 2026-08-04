# Story 059 — Tela ARTs (setup do trem e ciclo de vida do PI Plan)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** Essential
**Story mãe:** `docs/stories/epic-006/story-017.md` (AC-001 "ART creation with unique name",
AC-003 "PI Plan creation with auto-sprint generation", AC-004 "DRAFT → PLANNING transition")

> Por que uma história separada da 017: a 017 foi implementada **inteira no backend** —
> `createART`, `updateARTCadence`, `createPIPlanWithSprints` e `transitionPIPlan` existem em
> `app/actions/arts/lifecycle.ts` com 20 casos de teste verdes em
> `__tests__/actions/arts/lifecycle.test.ts` — e **nenhuma linha de UI foi escrita**. Não há
> um só chamador dessas quatro ações no app. O ART, hoje, só nasce por seed ou SQL.
> Esta história cobre **a tela `/cosmos/arts`**. Nenhum critério aqui é novo: cada AC aponta
> para um AC da 017 que já tem implementação e teste, e o trabalho é dar superfície a ele.

---

## Jornada do usuário

O RTE precisa montar o trem antes de qualquer coisa acontecer no Cosmos. A cadeia é rígida e
hoje ela está partida no primeiro elo:

1. **Criar o ART.** Sem ART não há PI Plan (`createPIPlanWithSprints` exige `artId`), e sem
   PI Plan não há sprint. Não existe tela que crie ART.
2. **Vincular times ao ART.** Já existe, em `/cosmos/teams` (story-056). A 017 AC-003 exige
   **≥1 time** para gerar o PI Plan — um ART vazio recusa com `ART_NO_TEAMS`.
3. **Criar o PI Plan.** Uma ação gera o plano **e todos os sprints de todos os times do ART**,
   derivados da cadência: `floor(piCadenceWeeks / sprintLengthWeeks)` sprints regulares, menos
   um quando o IP sprint está ligado, mais o IP sprint. Não é o RTE que cria sprint a sprint.
4. **Abrir para planejamento.** O PI Plan nasce `DRAFT`, e `DRAFT` é invisível para o resto do
   sistema. O Program Board (`getActiveProgramBoard`) só enxerga PI em
   `PLANNING | COMMITTED | EXECUTING`. Enquanto ninguém chama `transitionPIPlan` com
   `OPEN_PLANNING`, o board mostra "Nenhum time com sprint neste PI" e **o botão de criar
   Feature nunca aparece** — que é exatamente o sintoma relatado.

O elo 4 é o ponto não-óbvio desta tela: criar o PI não basta, ele precisa ser aberto. A tela
tem que dizer isso, não deixar o RTE descobrir pelo board vazio.

---

## Acceptance Criteria

### AC-001: Criar ART com nome único
_(story-017 AC-001)_

Given um ADMIN/RTE preenche nome, cadência do PI, duração do sprint e o toggle de IP sprint,
When submete,
Then:
- o ART é criado com `status=INACTIVE` e a cadência informada;
- a lista recarrega e o ART novo aparece;
- se o nome já existe no tenant (comparação **case-insensitive**), a criação falha e a tela
  mostra o motivo — não cria um segundo ART homônimo nem falha em silêncio.

### AC-002: ART sem time não oferece criação de PI
_(story-017 AC-003 "ART with ≥1 team"; `ART_NO_TEAMS`)_

Given um ART sem nenhum time vinculado,
When a tela carrega,
Then:
- o ART aparece marcado como sem time, dizendo o que aquilo impede (não gera PI Plan);
- a ação de criar PI **não é oferecida** para aquele ART — a precondição é dita antes do erro,
  não depois;
- o caminho de conserto (`/cosmos/teams`) é apontado.

### AC-003: Criar PI Plan gera os sprints e informa quantos
_(story-017 AC-003)_

Given um ART com ≥1 time, cadência de 10 semanas, sprint de 2 semanas e IP sprint ligado,
When o RTE cria o PI Plan com nome e data de início,
Then:
- o PI Plan nasce `DRAFT`;
- os sprints são gerados automaticamente — 4 regulares + 1 IP = 5 por time;
- a tela informa **quantos sprints foram criados**, porque é a única evidência visível de que
  a geração aconteceu;
- a lista recarrega mostrando o PI novo sob o ART.

### AC-004: PI em DRAFT é sinalizado como invisível, e a tela o abre
_(story-017 AC-004)_

Given um PI Plan em `DRAFT`,
When a tela carrega,
Then:
- o PI aparece com aviso de que, em `DRAFT`, não alimenta o Program Board;
- a ação "Abrir para planejamento" é oferecida;
- ao executá-la o PI passa a `PLANNING` e a lista recarrega.

Given um PI Plan já em `PLANNING`, `COMMITTED` ou `EXECUTING`,
Then a ação de abrir **não** é oferecida — a transição só é válida a partir de `DRAFT`, e
oferecê-la fora disso promete um erro.

### AC-005: Vazio e erro sem ART fabricado
_(padrão do audit 2026-07-23, eixo "Empty/error states")_

Given um tenant sem ART, ou uma falha de leitura,
When a tela carrega,
Then:
- no vazio, o estado explica que o ART é o primeiro passo da cadeia;
- no erro, nenhum ART é renderizado e nada é inventado.

---

## Fora do escopo

- **Edição de cadência** (017 AC-002, `updateARTCadence`): a ação existe e está testada,
  incluindo o bloqueio com PI ativo, mas a tela desta história é de criação e ciclo de vida.
  Sem superfície de edição, o bloqueio não tem o que bloquear.
- **COMMIT / FORCE_COMMIT / CLOSE** (017 AC-005 a AC-008): o commitment gate depende de
  objetivos com `plannedValue`, riscos ROAMados e voto de confiança — são as telas
  `/cosmos/piplanning` e `/cosmos/risks`, não esta.

---

## Plano de teste

`__tests__/screens/arts.test.tsx` — render test, asserção sobre conteúdo, sem snapshot:

| AC | Teste |
|---|---|
| AC-001 | cria ART pela tela e recarrega a lista; nome duplicado mostra o erro e não recarrega |
| AC-002 | ART sem time é sinalizado e não oferece criar PI; ART com time oferece |
| AC-003 | criar PI chama a ação com os dados do form e informa a contagem de sprints |
| AC-004 | DRAFT oferece abrir e transiciona; PLANNING/COMMITTED/EXECUTING não oferecem |
| AC-005 | vazio mostra o texto de primeiro passo; erro não renderiza ART nenhum |

Backend já coberto por `__tests__/actions/arts/lifecycle.test.ts` (20 casos) — esta história
não reescreve teste de ação, só cobre a superfície nova.
