# Story 055 — Tela Value Realization (benefit tracking pós-entrega)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**PRD:** §2.5 Epic Owner — UC-09 "Track Benefit Realization Against Hypothesis"
(`docs/PRD-v1.0.md:822`), Acceptance Criteria §2.5.5 (`docs/PRD-v1.0.md:836`)
**Handoff:** ValueRealizationScreen (`screen-bundle-1.jsx:1283`)
**Audit:** `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md` — RF-31, listada
entre as 12 telas ausentes; construída depois do audit.

> Por que uma história própria: o UC-09 mora na seção do **Epic Owner** do PRD e descreve o
> ciclo inteiro (indicador → medição → decisão). A tela `/cosmos/value` é a superfície de
> portfólio desse ciclo — a lista de todas as hipóteses de valor em aberto. Os critérios
> abaixo saem literalmente do UC-09 e do AC §2.5.5; nada aqui foi inventado.

---

## Jornada do usuário

O PRD é direto sobre o problema (§2.5.7): *benefit hypothesis tracking é a prática SAFe mais
negligenciada — definida na concepção e raramente revisitada*. O sintoma é o épico zumbi:
entregue, em IMPLEMENTING para sempre, sem ninguém dizer se a hipótese se confirmou.

O LPM abre **Portfólio · Benefit Tracking → Value Realization** e vê, numa tabela, cada
épico ligado ao indicador de negócio que ele prometeu mover: meta planejada, valor
realizado e quanto disso é do alvo. Quando o número chega, ele registra o resultado. E
quando decide encerrar — hipótese confirmada, ou abaixo da meta e hora de pivotar — o
sistema **exige que ele diga por quê**, e guarda essa frase na trilha de auditoria.

É essa última parte que separa benefit tracking de planilha: a decisão fica registrada com
o motivo, não só com o número.

---

## Acceptance Criteria

### AC-001: Encerrar a hipótese exige justificativa
_(UC-09 passo 5: "Epic Owner decides: continue, pivot, or close based on hypothesis
evidence")_

Given um indicador de valor,
When o resultado é registrado com status **Validado** (hipótese confirmada) ou **Abaixo da
meta** (sinal de pivô),
Then a justificativa é obrigatória: sem ela a gravação é recusada e **nada** é atualizado.

Given o mesmo registro com status **Em medição** ou **Aguardando dados**,
When é gravado sem justificativa,
Then passa — continuar medindo não é uma decisão sobre a hipótese, e exigir texto aí só
ensinaria o usuário a escrever "ok".

### AC-002: A justificativa vai para a trilha de auditoria
_(UC-09 passo 6: "Decision is recorded in AuditLog with rationale text")_

Given uma gravação com justificativa,
When ela é concluída,
Then o registro de auditoria da métrica carrega o texto junto do valor e do status.

### AC-003: Confiança da hipótese é derivada, nunca fabricada
_(UC-09 passo 4: "System surfaces hypothesis confidence score: (current/target)")_

Given um indicador sem valor realizado,
When a linha é exibida,
Then aparece "sem dados" — não 0%, não uma barra vazia que se lê como zero.

Given um indicador com valor realizado,
Then a realização é `realizado / planejado`, calculada na leitura e nunca persistida como
terceiro campo.

### AC-004: A tela distingue vazio, erro e lista
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given a leitura falha,
Then aparece o erro e nenhum indicador é renderizado.

Given não há indicador registrado,
Then aparece o estado vazio convidando a registrar o primeiro.

### AC-005: Seta de tendência das últimas 3 medições — **BLOQUEADO**
_(AC §2.5.5: "a trend arrow based on last 3 measurement snapshots")_

Given um indicador com três ou mais medições,
When a linha é exibida,
Then uma seta indica se a realização está subindo ou caindo.

> **Não implementável sem migration.** `EpicValueMetric`
> (`packages/database/prisma/schema/finops.prisma:278`) guarda só a última medição
> (`actualValue` + `measuredAt`): cada gravação sobrescreve a anterior e não existe
> histórico de onde tirar tendência. Exige uma tabela de snapshot, que é da trilha de
> schema. Registrado como lacuna com `bloqueio: true` em `docs/cosmos/nodes/value.json`;
> nenhum passo deste AC foi implementado, e nada foi aproximado no lugar dele.

---

## Technical Notes

- A justificativa **não é persistida em coluna** — o UC-09 pede AuditLog, e é para lá que
  ela vai. Criar um campo novo em `EpicValueMetric` seria migration e guardaria só a última
  justificativa, perdendo justamente o histórico que a auditoria quer.
- Os status que contam como decisão sobre a hipótese (`done`, `at-risk`) vivem em
  `apps/app/app/(cosmos)/actions/value-realization.constants.ts`, ao lado do enum, para que
  a regra do servidor e o formulário da tela leiam a mesma lista.

## Test Plan

- **Risco:** Médio — a regra é de recusa; falha silenciosa aqui deixa hipótese sendo
  encerrada sem motivo registrado.
- **Action** (`apps/app/__tests__/actions/value-realization.test.ts`): recusa sem
  justificativa nos dois status terminais, sem escrever nem auditar; aceita sem
  justificativa nos não-terminais; justificativa presente no diff de auditoria.
- **Tela** (`apps/app/__tests__/screens/value.test.tsx`): lista real (já coberta), vazio,
  erro, e o formulário barrando o envio quando o status terminal está sem justificativa.
  Asserção sobre conteúdo — sem snapshot.
