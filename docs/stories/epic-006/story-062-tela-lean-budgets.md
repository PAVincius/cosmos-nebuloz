# Story 062 — Tela Lean Budgets (guardrails do value stream)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**Story mãe:** `docs/stories/epic-006/story-025.md` (AC-002 "CapEx + OpEx = 100% validation",
AC-005 "CLOSED PI Plan budget is read-only")
**Também:** `docs/lean-budget/LEAN_BUDGET.md` §3.2 (ValueStream / ART), §8 (Aplicação de Lean
Budget Guardrails)

> Por que uma história separada da 025: a 025 é o **pacote de portfólio** (temas, orçamento
> enxuto, relatório de saúde, job em lote de análise). A tela `/cosmos/budgets` é a superfície
> de orçamento dela — a lista de `LeanBudget` por PI/ART com o editor de guardrails. Ela nasceu
> sabendo **gravar** o guardrail e sem saber **quando não pode**: `LeanBudget.immutableAt`
> existe no schema, comentado como "set when PI closes (AC-005)", e nenhuma leitura ou escrita
> do repo olha para ele. Nenhum critério aqui é inventado: cada AC aponta para um AC da 025 ou
> para o LEAN_BUDGET.md.

---

## Decisão de modelagem: o ART **é** o value stream

O design fala em "Value Stream" e o schema não tem esse model. Isso **não** é uma lacuna a
preencher com um model novo — é o mapeamento que o próprio repo já escolheu, em dois lugares:

- `LeanBudget.horizonId` está comentado como "Investment Horizon classification … **this value
  stream's** budget is bucketed under", num model cuja chave de agrupamento é `artId`;
- `governance.prisma` declara `valueStreamId String? // artId of the ART/value stream` — o
  campo se chama value stream e guarda um id de ART.

E o `LEAN_BUDGET.md` §3.2 confirma do lado do domínio: a seção se chama **"ValueStream / ART"**
e descreve **uma** entidade com `tipo: value_stream | art`, não duas.

Criar um model `ValueStream` duplicaria o conceito e obrigaria toda leitura de orçamento a
decidir qual dos dois é a verdade. Este nó documenta o mapeamento e não cria o model.

---

## Jornada do usuário

O Business Owner abre **Portfolio → Financeiro → Lean Budgets** para responder à pergunta do
LPM: "quanto cada value stream tem, quanto já gastou, e o gasto está dentro do guardrail?".

A tela lista os orçamentos, mostra consumido/alocado, e abre um editor por linha para o split
CapEx/OpEx e os limites de gasto e de aprovação. Três coisas estavam erradas:

1. **Orçamento de PI fechado podia ser editado.** A 025 AC-005 é explícita: PI com status
   CLOSED deixa o orçamento em somente leitura, `immutableAt` marcado, e um aviso de que os
   valores são finais. O campo existe e ninguém o lê. Um orçamento de PI encerrado que ainda
   aceita escrita não é um orçamento — é um número que muda depois que a decisão foi tomada,
   e é exatamente o que a imutabilidade de fechamento de PI existe para impedir.
2. **Utilização fabricada.** Um orçamento com valor alocado 0 exibia `0%` de utilização.
   "Consumiu 0% do que tem" e "não há denominador" são coisas diferentes.
3. **Erro virava vazio.** A falha de leitura caía no texto "Nenhum orçamento encontrado", que
   diz ao Business Owner que o portfólio dele não tem orçamento nenhum.

---

## Acceptance Criteria

### AC-001: Orçamento de PI fechado é imutável
_(story-025 AC-005 "All input fields are read-only / `LeanBudget.immutableAt` is set to PI close
timestamp / banner: 'Budget for this PI is final'")_

Given um `LeanBudget` com `immutableAt` preenchido,
When alguém tenta gravar guardrails nele,
Then a escrita é recusada com mensagem que diz que o orçamento do PI está encerrado, e **nada
é gravado** — nem o split, nem os limites.

Given o mesmo orçamento,
When a tela carrega,
Then a linha aparece marcada como final e **não oferece** o botão de guardrails: recusar no
servidor e ainda convidar ao clique é uma armadilha, não uma proteção.

Given um `LeanBudget` sem `immutableAt`,
When os guardrails são gravados,
Then a escrita passa normalmente.

### AC-002: CapEx % + OpEx % somam 100
_(story-025 AC-002 "CapEx + OpEx must equal 100%")_

Given CapEx 60 e OpEx 50,
When a gravação é submetida,
Then é recusada e nada é persistido.

Given CapEx 60 e OpEx 40,
When gravado,
Then `capexPct=60` e `opexPct=40` são persistidos e a ação é auditada.

### AC-003: Utilização sem orçamento alocado é "—", nunca 0%
_(audit 2026-07-23, eixo "Data integrity")_

Given um orçamento com valor alocado 0,
When a tela renderiza,
Then a utilização é **"—"**: sem denominador não há percentual, e `0%` afirmaria um consumo
medido que não existe.

Given orçamentos com valor alocado,
When a tela renderiza,
Then o percentual total do cabeçalho é derivado da soma dos alocados e dos consumidos, e é
"—" quando nenhum orçamento tem valor alocado.

### AC-004: O id vindo do cliente é reconferido no tenant
_(audit 2026-07-23, eixo "Data integrity")_

Given um `budgetId` de outro tenant,
When a gravação é submetida,
Then é recusada e nenhuma linha é alterada.

Given um usuário sem papel ADMIN/STE,
When ele tenta gravar,
Then a ação é recusada.

### AC-005: Estado vazio e estado de erro sem orçamento fabricado
_(audit 2026-07-23, eixo "Data integrity")_

Given `listLeanBudgets` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhum** orçamento é renderizado — hoje a falha dizia
"Nenhum orçamento encontrado" a um tenant que tem orçamentos.

Given o tenant sem orçamento,
When a tela carrega,
Then aparece o estado vazio.

---

## Technical Notes

- **Sem migration.** `LeanBudget.immutableAt` já existe (`packages/database/prisma/schema/`,
  comentado como "set when PI closes (AC-005)"). O que faltava era lê-lo.
- A guarda de imutabilidade é lida na mesma consulta que já faz a guarda de tenant — não é uma
  ida a mais ao banco, é uma coluna a mais no `select` que já existe.
- `utilizationPct` passa a ser `number | null`. O `0` anterior era indistinguível de "consumiu
  nada"; o `null` é o que a tela traduz para "—". Mesma regra já aplicada em `avgProgress` no
  nó `strategy` e em `actualAllocationPct` no nó `themes`.
- **Lacuna registrada, não fechada aqui:** nada no repo **marca** `immutableAt` no fechamento
  do PI. Esta tela passa a respeitar a marca; quem a põe é o fluxo de encerramento de PI, que
  é outra superfície. Sem isso, a proteção existe e nunca dispara em produção — é lacuna real
  e está registrada como tal, não disfarçada de pronta.
- **Lacuna registrada:** `spentSource` (`MANUAL | BILLING_AGGREGATE | FORECAST`) e
  `spentManualOverride` existem no model e a tela mostra `spent` sem dizer de onde veio. Um
  gasto estimado e um gasto faturado não são a mesma afirmação.

## Test Plan

- **Risco:** Médio — escrita financeira sob regra de imutabilidade.
- **Action** (`apps/app/__tests__/actions/budgets.test.ts`): orçamento com `immutableAt`
  recusa a gravação e não chama update; orçamento sem `immutableAt` grava; a guarda de
  imutabilidade vem da mesma consulta tenant-escopada; `utilizationPct` é null sem valor
  alocado.
- **Tela** (`apps/app/__tests__/screens/budgets.test.tsx`): a linha imutável é marcada como
  final e não oferece o botão de guardrails; a linha comum oferece; utilização sem denominador
  é "—"; erro distinto do vazio. Asserção sobre conteúdo — sem snapshot.
