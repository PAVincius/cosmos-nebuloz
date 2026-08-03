# Story 053 — Tela Temas Estratégicos (Strategy Map de investimento)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**SRD:** FR-014 (`docs/srd-epic-006.md:170`)
**PRD:** §5.5 UC-62, UC-64, UC-65 (`docs/PRD-v1.0.md:3029`)
**Story mãe:** `docs/stories/epic-006/story-025.md` (DoD "Strategic theme CRUD (max 7 active
without override, archive non-cascading)", "Concentration alert (60% default)")

> Por que uma história separada da 025: a 025 empacota temas + lean budget + relatório de IA
> em batch numa DoD só, e a parte de temas ficou sem jornada nem plano de teste próprios. Esta
> história cobre **a tela `/cosmos/themes`** — a superfície que o Portfolio Manager usa para
> equilibrar investimento. Nenhum critério aqui é inventado: cada AC aponta para FR-014, para
> um UC do PRD, ou para a DoD da 025.

---

## Jornada do usuário

A Portfolio Manager abre **Portfólio · Estratégia → Temas Estratégicos** na segunda-feira de
revisão de PI. Ela precisa responder três perguntas, nessa ordem:

1. **Onde o dinheiro está indo?** Vê os temas ativos lado a lado — para cada um, quanto foi
   *planejado* (alocação-alvo) contra quanto está sendo *gasto de fato* (derivado de
   `BillingEntryAllocation`), e quantos épicos correm sob o tema.
2. **Estamos concentrados demais?** SAFe trata concentração de portfólio como risco: se um
   único tema abocanha mais de 60% dos épicos, a tela precisa dizer isso na cara, não deixar
   ela derivar do gráfico. Ela reequilibra os pesos-alvo ali mesmo (soma tem que fechar 100%).
3. **O que já não vale mais?** Um tema que a estratégia abandonou precisa sair do quadro sem
   apagar história: os épicos que rodaram sob ele continuam apontando para ele. Ela arquiva.

Ao criar um tema novo, o sistema segura a mão dela no oitavo: SAFe recomenda no máximo 7 temas
estratégicos ativos, porque acima disso "tema" deixa de ser critério de decisão de investimento
e vira taxonomia.

---

## Acceptance Criteria

### AC-001: Strategy Map lista só tema ativo, com investimento real vs. alvo
_(FR-014 "Strategy Map (investment distribution)"; UC-64 passo 1)_

Given um tenant com temas ativos e um tema `ARCHIVED`,
When a tela carrega,
Then:
- apenas os temas ativos aparecem no grid;
- cada card mostra alocação-alvo e, quando existe dado de custo, a alocação real derivada de
  `BillingEntryAllocation` (nunca um número fabricado — sem dado, o card diz "Sem dados de
  alocação real");
- o cabeçalho informa quantos temas foram arquivados, para que arquivar não pareça apagar.

### AC-002: Máximo de 7 temas ativos
_(FR-014 AC "Given 7 active themes ... an 8th is created, Then it's blocked com max-7 message";
UC-62 passo 4; DoD story-025)_

Given 7 temas não-arquivados no tenant,
When um ADMIN/STE cria o oitavo,
Then a criação é recusada com mensagem citando o limite de 7, e nada é gravado.

Given 7 temas onde 2 estão `ARCHIVED` (5 ativos),
When o oitavo registro é criado,
Then a criação passa — o limite conta tema **ativo**, não linha na tabela.

### AC-003: Arquivar é não-cascateante
_(FR-014 "archive (non-cascading)"; UC-62 passo 3)_

Given um tema com épicos vinculados,
When um ADMIN/STE arquiva o tema,
Then:
- `status` vira `ARCHIVED`;
- nenhum `Epic` é alterado — os épicos existentes continuam apontando para o tema, para
  fidelidade histórica;
- a alocação-alvo do tema é zerada (`targetAllocationPct = null`): alvo de investimento é
  atributo de tema ativo, e deixá-lo pendurado quebraria a soma de 100% do AC-005;
- a ação é auditada (`logAudit`) com o estado anterior.

### AC-004: Alerta de concentração em 60%
_(story-025 AC-001; UC-65 passo 4 "warning if any single theme exceeds 60%")_

Given 3 temas ativos com 8/2/2 épicos (66,7% / 16,7% / 16,7%),
When a tela carrega,
Then o primeiro tema é sinalizado como concentrado ("66.7% dos épicos do portfólio — acima da
diretriz de 60%") e os outros dois não.

Given nenhum épico vinculado a tema algum,
When a tela carrega,
Then a fatia de cada tema é `null` (não 0%) e ninguém é sinalizado — não se infere
concentração de denominador zero.

### AC-005: Pesos-alvo somam 100% e só valem para tema ativo
_(UC-65 passos 1–3)_

Given a Portfolio Manager ajusta os pesos-alvo,
When a soma não fecha 100%,
Then o rebalanceamento é recusado e nenhuma linha é atualizada.

Given um dos ids enviados é de um tema `ARCHIVED` (ou de outro tenant),
When o rebalanceamento é submetido,
Then é recusado inteiro — rebalanceamento parcial nunca persiste.

### AC-006: Estado vazio e estado de erro sem dado fabricado
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given `listThemes` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhum** tema é renderizado.

Given o tenant não tem tema algum,
When a tela carrega,
Then aparece o estado vazio convidando a criar o primeiro tema.

---

## Technical Notes

- Sem migration. `StrategicTheme.status` já existe em `packages/database/prisma/schema/portfolio.prisma`
  com `ARCHIVED` no vocabulário; arquivar é transição de status, não coluna nova.
- Limite (7) e limiar de concentração (60) vivem em
  `apps/app/app/(cosmos)/actions/themes.constants.ts` — `themes.ts` é `"use server"` e só pode
  exportar função async (mesmo motivo de `capacity.constants.ts`).
- `strategy:override` do FR-014 (liberar o 8º tema) **não é implementável hoje**: a autorização
  do repo é por papel (`MemberRole`), não por permissão granular. Registrado como lacuna no nó
  `docs/cosmos/nodes/themes.json`.
- "Threshold is configurable per org (FR-014)" idem: não há linha de configuração de portfólio
  para hospedar o valor. Fica constante e vira lacuna com `migration: true`.
- Concentração é derivada na leitura (share de épicos entre temas ativos), nunca persistida —
  terceiro campo divergente é o defeito que o audit encontrou em outras telas.

## Test Plan

- **Risco:** Médio — escrita multi-linha (rebalance) e guarda de limite.
- **Action** (`apps/app/__tests__/actions/themes.test.ts`): limite de 7 conta só ativo; arquivar
  exige papel, é IDOR-guardado, não toca `Epic`, zera alvo e audita; rebalance recusa arquivado;
  `epicSharePct`/`overConcentrated` calculados só sobre ativos e `null` com denominador zero.
- **Tela** (`apps/app/__tests__/screens/themes.test.tsx`): grid esconde arquivado e mostra a
  contagem; card concentrado exibe o aviso; estado vazio; estado de erro sem tema renderizado.
  Asserção sobre conteúdo — sem snapshot.
- **Seed** (`packages/database/scripts/seed-cosmos.mts`): os temas do tenant demo precisam
  nascer com horizonte, saúde e alocação-alvo somando 100%, senão a tela abre com todos os KPIs
  em "—" e o Strategy Map não tem o que provar.
