# Story 059 — Tela Anomalias de Custo (FinOps do portfólio)

**Epic:** epic-007 — Solution Train & Advanced Features
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**Story mãe:** `docs/stories/epic-007/story-030.md` (AC-002 "Cost anomaly detected and notified",
AC-007 "Attribution audit log")
**Também:** `docs/stories/epic-007/story-021.md` (AC-005 "Org-level threshold override within
platform bounds", AC-008 "Threshold reset to default")

> Por que uma história separada da 030 e da 021: a 030 é o **pipeline de custo** (ingestão,
> atribuição por épico, snapshot imutável) e a 021 é o **motor de detecção agendado** com seu
> conjunto de regras. A tela `/cosmos/anomalies` é a superfície onde o Business Owner encontra o
> resultado das duas: a lista de desvios de custo já detectados, o botão que dispara a detecção
> fora do cron, e o controle de sensibilidade da regra `R-COST-01`. Ela nasceu com quase tudo —
> leitura tenant-escopada, reconhecimento auditado, detecção sob demanda — e **sem a metade
> reversível** do controle de sensibilidade: dava para sair do padrão da plataforma e não dava
> para voltar. Nenhum critério aqui é inventado: cada AC aponta para um AC da 030 ou da 021.

---

## Jornada do usuário

O Business Owner abre **Portfolio → FinOps → Anomalias de Custo** quando a fatura da nuvem
surpreende. Ele precisa de três coisas:

1. **Ver o desvio com a conta na mão.** Não "o custo subiu": `$X` neste mês contra a mediana
   `$Y` das anteriores, `+Z%`, z-score `w`. A 030 AC-002 exige exatamente esse conjunto
   (`baselineAmount`, `actualAmount`, variação) no registro da anomalia — a tela é onde ele
   aparece.
2. **Calibrar o gatilho.** O padrão da plataforma para `R-COST-01` é o corte de 3,5 de
   Iglewicz & Hoaglin. Um tenant com custo naturalmente volátil afoga em falso positivo; um
   tenant estável quer ser avisado antes. A 021 AC-005 manda deixar sobrescrever dentro de
   limites da plataforma, e a **021 AC-008 manda deixar voltar ao padrão** — apagando a
   sobrescrita, não gravando 3,5 como se fosse escolha do tenant.
3. **Encerrar o item.** Reconhecer a anomalia tira o alarme da fila sem apagar o registro,
   e a ação fica auditada (030 AC-007).

A lacuna real era a (2): `setAnomalySensitivity` gravava o override e `getAnomalySensitivity`
sabia distinguir override de padrão (`isDefault`), mas **não existia caminho de volta**. Um
tenant que experimentasse 2,0 ficava preso a 2,0 para sempre; regravar 3,5 produz uma linha
`AnomalyRuleConfig` que diz "este tenant escolheu 3,5", o que é diferente de "este tenant segue
a plataforma" — e passaria a ignorar qualquer mudança futura do padrão.

---

## Acceptance Criteria

### AC-001: Voltar a sensibilidade ao padrão da plataforma
_(story-021 AC-008 "The override record is deleted / The next run uses the platform default
threshold / AuditLog records the reset action")_

Given um override de `R-COST-01` gravado para o tenant,
When um ADMIN/STE restaura o padrão,
Then:
- a linha `AnomalyRuleConfig` do tenant para essa regra é **apagada**, não regravada com o
  valor padrão;
- a leitura seguinte devolve o padrão da plataforma com `isDefault: true`;
- a ação é auditada.

Given nenhum override gravado,
When a restauração é submetida,
Then ela é um no-op bem-sucedido — não é erro restaurar o que já é padrão — e nada é auditado
como mudança que não houve.

Given um usuário sem papel ADMIN/STE,
When ele tenta restaurar,
Then a ação é recusada e nada é apagado.

### AC-002: Limiar fora dos limites da plataforma é recusado, com a faixa na mensagem
_(story-021 AC-005 "Setting threshold to 5% (below min 10%) returns 422 with allowed range")_

Given os limites de plataforma 2–8 para o z-score de `R-COST-01`,
When alguém grava 1,5 ou 9,
Then a gravação é recusada e a mensagem **cita a faixa permitida**; nada é persistido.

### AC-003: Reconhecer é escopado por tenant e auditado
_(story-030 AC-007 "Attribution audit log"; audit 2026-07-23, eixo "Data integrity")_

Given um id de anomalia de outro tenant,
When o reconhecimento é submetido,
Then é recusado e nenhuma linha é alterada — o filtro é `(id, tenantId)` junto, nunca `id` só.

Given uma anomalia do tenant,
When um ADMIN/STE/RTE a reconhece,
Then `status`, `acknowledgedBy` e `acknowledgedAt` são gravados e a ação é auditada.

### AC-004: A tela nunca fabrica número de custo
_(story-030 AC-002; audit 2026-07-23, eixo "Data integrity")_

Given anomalias na lista,
When a tela renderiza,
Then o valor real, a mediana de baseline, o Δ% e o z-score vêm da linha — a tela formata e
não recalcula.

Given nenhuma anomalia,
When a tela renderiza,
Then o KPI "Δ% médio" mostra **"—"**, nunca `0%`: média de conjunto vazio não é zero.

### AC-005: Vazio distingue "sem dado de custo" de "sem anomalia"; erro não renderiza anomalia
_(story-030 AC-002 pressupõe `BillingEntry` ingerido; audit 2026-07-23, eixo "Data integrity")_

Given o tenant sem nenhuma linha `BillingEntry`,
When a tela carrega e não há anomalia,
Then a mensagem diz que **não há dado de custo sincronizado** e aponta para conectar uma
integração de billing — não diz "nenhuma anomalia", que sugeriria que o custo foi analisado e
está saudável.

Given o tenant com `BillingEntry` e nenhuma anomalia,
When a tela carrega,
Then a mensagem diz que nada foi detectado **nos dados atuais**.

Given `listCostAnomalies` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhuma** anomalia é renderizada.

---

## Technical Notes

- **Sem migration.** `AnomalyRuleConfig` já existe com a chave única
  `(tenantId, artId, ruleId)`; restaurar o padrão é `delete` sobre essa chave. `CostAnomaly` e
  `BillingEntry` já existem em `packages/database/prisma/schema/finops.prisma`.
- `artId` é opcional no model mas participa da chave única; anomalia de custo é tenant-wide,
  então o repo usa `""` como sentinela de "sem escopo de ART" — mesma convenção de
  `app/actions/intelligence/anomalyRules.ts`. A restauração precisa usar a **mesma** sentinela
  da gravação e da leitura, senão apaga uma linha que não existe e o override sobrevive.
- Apagar uma linha inexistente lança `P2025` no Prisma. A restauração usa `deleteMany`, que
  devolve `count: 0` sem lançar — é o que torna o no-op do AC-001 verdadeiro em vez de um erro
  disfarçado.
- **Este é o pipeline de custo**, não o de fluxo: `CostAnomaly` + `lib/cost/*` (mediana/MAD,
  Iglewicz & Hoaglin 1993), distinto de `Anomaly`/`AnomalyDetectionRun` +
  `app/actions/flow-intelligence/*`, que detecta regressão de métrica de fluxo. Os dois têm
  "anomalia" no nome e não são a mesma coisa.
- **Seed:** o tenant demo passa a ter `BillingEntry` real — sete meses de custo por
  `(serviço, conta)`, com um salto no mês corrente. O seed **não grava `CostAnomaly`**: a
  anomalia é produto do detector (`lib/cost/detect-cost-anomalies.ts`), e escrever a linha de
  saída à mão no seed seria reimplementar a mediana/MAD num segundo lugar e chamar de dado.
  Com o insumo semeado, "Detectar agora" na tela produz a anomalia pelo caminho real.

## Test Plan

- **Risco:** Médio — escrita destrutiva (apagar override) sob RBAC.
- **Action** (`apps/app/__tests__/actions/anomalies.test.ts`): restaurar apaga sob a sentinela
  tenant-wide; restaurar sem override é no-op bem-sucedido; restauração exige papel; o
  round-trip set → reset → get volta a `isDefault: true`; limiar fora dos limites é recusado
  citando a faixa; reconhecimento é IDOR-guardado e auditado.
- **Tela** (`apps/app/__tests__/screens/anomalies.test.tsx`): os números da linha aparecem sem
  recálculo; "Δ% médio" é "—" com lista vazia; o vazio sem `BillingEntry` fala de dado de custo
  ausente e o vazio com `BillingEntry` fala de detecção; o erro não renderiza anomalia;
  restaurar o padrão chama a action e recarrega; o botão de restaurar não aparece quando já se
  está no padrão. Asserção sobre conteúdo — sem snapshot.
