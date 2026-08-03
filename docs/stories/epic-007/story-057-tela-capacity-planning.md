# Story 057 — Tela Capacity Planning (heatmap de utilização do PI)

**Epic:** epic-007 — Solution Train & Advanced Features
**Status:** pending
**Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** Essential
**SRD:** FR-007-012 Performance Intelligence (`docs/srd-epic-007.md:120`)
**Story mãe:** `docs/stories/epic-007/story-032.md` (AC-002 "Capacity utilization heatmap",
AC-003 "PI predictability score")

> Por que uma história separada da 032: a 032 empacota velocity, heatmap de capacidade, ROI,
> métricas de membro e heatmap de skills numa DoD só, e o **heatmap de capacidade** ficou sem
> jornada nem plano de teste próprios — a tela `/cosmos/capacity` foi construída contra a
> descrição e ficou **fora da faixa que o AC-002 define**. Esta história cobre a tela. Nenhum
> critério aqui é inventado: cada AC aponta para um AC da 032.

---

## Jornada do usuário

O RTE abre **ART Board → Capacity Planning** no meio do PI. Ele precisa responder duas
perguntas, nessa ordem:

1. **Quem está fora da faixa?** A grade time × sprint do PI ativo mostra, célula a célula,
   quanto foi planejado e quanto foi entregue. A cor é a regra, não decoração: abaixo de 80%
   o time tem folga, entre 80% e 100% está no limite, acima de 100% está estourado. A 032
   AC-002 chama isso de "always red, non-configurable" — não é um limiar que cada org afina.
2. **Por quê?** Ao lado da grade, os ajustes de capacidade (férias, treinamento, onboarding)
   explicam a variação. É o painel que já existe, e é o que separa "time devagar" de "time com
   metade das pessoas em treinamento".

O que ele **não** deve ver é a tela inteira em "—". Hoje é o que acontece no tenant demo: o
seed nunca cria PI Plan nem snapshot de capacidade, então a grade abre dizendo "Sem PI ativo"
e a tabela de times abre com toda coluna vazia. A regra do AC-002 não tem em quem aparecer.

---

## Acceptance Criteria

### AC-001: Faixa de utilização exatamente como o AC-002 da 032
_(story-032 AC-002: "< 80%: green; 80–100%: yellow; > 100%: red (always red, non-configurable)")_

Given células com utilização de 79%, 80%, 100% e 101%,
When a grade renderiza,
Then a faixa é, respectivamente, verde, âmbar, âmbar e vermelha — 100% é o topo da faixa
âmbar, não o começo da vermelha.

Given uma célula sem snapshot de capacidade,
When a grade renderiza,
Then a faixa é `null` e a célula mostra "—": não se infere faixa de utilização inexistente.

### AC-002: A faixa é derivada na leitura, não na tela
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, "terceiro campo divergente")_

Given a mesma utilização,
When a tabela por time e a grade por sprint renderizam,
Then as duas usam a mesma faixa vinda da action — não há segundo limiar escrito no componente
que possa divergir do primeiro em silêncio.

### AC-003: Hover mostra planejado, entregue e utilização
_(story-032 AC-002 "Hover shows: planned/actual/capacity")_

Given uma célula com snapshot,
When o RTE aponta para ela,
Then aparece planejado, entregue e utilização em story points, com a leitura da faixa em
palavras ("acima da capacidade" / "no limite da capacidade" / "dentro da capacidade").

> A parte "in both points and **hours**" do AC-002 não é implementável: `TeamCapacitySnapshot`
> não tem hora nem dia-pessoa (`availablePersonDays` da story-020 nunca existiu no schema).
> Registrado como lacuna com `migration: true` no nó, não aproximado a partir de SP.

### AC-004: O tenant demo abre com a grade cheia
_(story-032 AC-002 "Given 4 teams × 5 sprints in the current PI"; `docs/superpowers/plans/2026-07-27-seed-completo.md`)_

Given o seed do tenant demo,
When a tela carrega,
Then existe um PI Plan ativo com sprints por time e snapshots de capacidade, e a grade contém
pelo menos uma célula de cada faixa — verde, âmbar e vermelha — para que a regra do AC-001
tenha em quem aparecer.

### AC-005: Estado vazio e estado de erro sem número fabricado
_(audit 2026-07-23, eixo "Data integrity")_

Given `listTeamCapacity` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhuma** linha de time é renderizada.

Given não há PI ativo,
When a grade carrega,
Then aparece o estado vazio dizendo que falta PI/sprint — nunca uma grade de zeros.

---

## Technical Notes

- Sem migration. `TeamCapacitySnapshot` já tem `expectedSpNextSprint`, `actualSpDelivered` e
  `actualCapacityUtil`; a faixa é derivada desses, nunca persistida.
- Os limiares vivem em `apps/app/app/(cosmos)/actions/capacity.constants.ts` — `capacity.ts` é
  `"use server"` e só pode exportar função async, o mesmo motivo pelo qual `CAPACITY_NOTE_TONES`
  já mora lá.
- A tela tinha os limiares próprios (`>= 100` vermelho, `>= 85` âmbar). Além de divergirem do
  AC-002 em dois pontos, eram um segundo lugar onde a regra podia mudar sozinha.
- **Não há caminho de escrita de capacidade planejada pela UI.** `TeamCapacitySnapshot` só nasce
  em `apps/app/app/actions/sprints/snapshot-origination.ts`, no fechamento da sprint. Logo o
  `expectedSp` de uma sprint futura do PI ativo é sempre `null`. É gap de modelagem de fluxo,
  não de tela: registrado como lacuna, não preenchido com estimativa.

## Test Plan

- **Risco:** Baixo-médio — derivação de leitura sem escrita nova; o risco é a regra divergir
  entre os dois lugares que a desenham.
- **Action** (`apps/app/__tests__/actions/capacity.test.ts`): faixa nas quatro bordas
  (79/80/100/101); `null` sem snapshot; a mesma faixa aparece em `listTeamCapacity` e em
  `listTeamCapacityAcrossPI`.
- **Tela** (`apps/app/__tests__/screens/capacity.test.tsx`): a grade mostra a leitura da faixa
  em palavras no hover; célula sem snapshot mostra "—"; estado vazio da grade sem PI; estado de
  erro sem linha de time renderizada. Asserção sobre conteúdo — sem snapshot.
- **Seed** (`packages/database/scripts/seed-cosmos.mts`): PI Plan ativo + sprints do PI por
  time + `TeamCapacitySnapshot` cobrindo as três faixas.
