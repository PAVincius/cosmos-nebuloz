# Meridian — Software Requirements Document

> **PRODUCT** Meridian · **COMPANION** [Meridian PRD v1.0](./meridian-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança

Especificação do Meridian (AVALIAR) como está na `main`: o guard de quatro camadas, a porta
do respondente por token, os 16 modelos, as fórmulas exatas do scoring e da dispersão, e as
fronteiras com Scaffold, back-office, Storage e LGPD.

---

## 1. Escopo

Especifica o software do Meridian em `apps/app` — a rota `/meridian/[[...seg]]`, a rota
`/meridian-responder/<token>`, os 11 arquivos de server action, o domínio puro e o schema
`meridian.prisma` — e as peças em `@repo/rbac` e `@repo/provisioning`.

**Fora de escopo:** o produto Scaffold, que lê a promoção; a materialização de `Engagement`
no back-office; o site público; e a rubrica de growth do back-office.

**Notação.** Estado na `main` @ `ea512044`: `implementado`, `parcial` ou `ausente`;
`[inferido]` é conclusão tirada do código sem executá-lo. Caminhos: `actions/` =
`apps/app/app/(meridian)/actions/` · `lib/` = `apps/app/lib/meridian/` · `screens/` =
`apps/app/components/meridian/screens/` · `schema` = `packages/database/prisma/schema/meridian.prisma`.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Tenant da consultoria | Tenant de onde a Nebuloz aplica o diagnóstico em várias organizações; o cliente não entra nele |
| Assessment | Diagnóstico de uma organização (`orgName`, texto livre) num período, com template congelado |
| Eixo | `DATA`, `PROCESS`, `PEOPLE`, `GOVERNANCE`, `INFRASTRUCTURE`, nessa ordem canônica (`lib/axes.ts:11-17`) |
| Computado · final | Score 0–100 do motor, gravado uma vez · `final ?? computed`, com `final` só depois de override |
| Spread · contestado | Maior diferença entre os scores individuais do eixo · eixo com `spread ≥ contestedSpread` |
| Gap · selo | Lacuna com eixo, severidade, esforço e custo de atraso 0–100 · `MEASURED`, `ESTIMATED`, `DECLARED` |
| Coorte · retida | Setor × faixa de tamanho, global e sem `tenantId` · lida sem percentis |

---

## 2. Arquitetura

```text
   Consultor · Revisor · Leitor             Respondente (sem conta)
                ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│ /meridian/[[...seg]]          │        │ /meridian-responder/<token>   │
│ requireMeridianContext        │        │ sha256(token) → tenant        │
│ actions/ · withTenantDb       │        │ actions/respondent.ts         │
│ escrita e trilha na mesma tx  │        │ client comum, sem transação   │
└───────────────┬───────────────┘        └───────────────┬───────────────┘
                └───────────────────┬────────────────────┘
                                    ▼
            ┌───────────────────────────────────────────────┐
            │ PostgreSQL · 14 tabelas de tenant + AuditLog  │
            │ 2 tabelas globais de benchmark, sem tenantId  │
            │ Storage · bucket privado meridian-evidence    │
            └───────────────────────────────────────────────┘
```
*FIGURA 1 — DUAS PORTAS. A DA SESSÃO PASSA PELO GUARD; A DO RESPONDENTE DESCOBRE O TENANT PELO TOKEN.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `apps/app/app/(meridian)/layout.tsx` · `meridian/[[...seg]]/page.tsx` | Guard da navegação e rota única; id de tela → componente (`screens/registry.tsx:15-23`) |
| `apps/app/app/meridian-responder/[token]/page.tsx` | Bateria do respondente, fora do route group e do prefixo protegido |
| `lib/` | `guards.ts` (quatro camadas), domínio puro (`scoring`, `graph`, `plan`, `benchmark`, `composite`) e `respondent-token.ts` |
| `actions/` | 11 arquivos; `_shared.ts` grava a trilha e emite os códigos `AS-104`, `G-01`, `OV-11` |
| `packages/rbac/src/meridian-matrix.ts` · `packages/provisioning/src/meridian.ts` | 7 permissões × 3 papéis, com o papel em cache por 300 s · bootstrap com `CONSULTANT` e o template v3.2 de 15 perguntas |

> **CONTRATO DE ACTION**
> Toda action devolve `Result<T>` por `safeAction`. O contrato nomeia 401, 403, 422 e 409 com
> `blockers` (`specs/001-meridian-diagnose/contracts/actions.md`), mas `safeAction` devolve só
> `{ ok: false, error }` com a mensagem (`apps/app/app/actions/_base.ts:11,65-86`). A tela
> recalcula o que precisa, como os eixos sem dono (`screens/tab-coleta.tsx:47`).

---

## 3. Modelo de dados

```text
Tenant ──1:N── MeridianMembership · MeridianSequence
  ├──1:N── MeridianTemplate ──1:N── MeridianQuestion
  └──1:N── MeridianAssessment ──N:1── MeridianTemplate    reassessmentOf ──▶ MeridianAssessment
             ├──1:N── MeridianRespondent ──1:N── MeridianResponse ──1:N── MeridianEvidence
             ├──1:N── MeridianAxisScore (um por eixo) · MeridianOverride (append-only)
             ├──1:N── MeridianPlanItem ──N:1── MeridianGap
             └──1:N── MeridianGap (Restrict) ──1:N── MeridianGapDependency
                        └──1:N── MeridianGapPromotion ──▶ ScaffoldTrack · Engagement

GLOBAL, SEM tenantId
MeridianBenchmarkCohort ──1:N── MeridianBenchmarkContribution (assessmentId sem FK)
```
*FIGURA 2 — 16 MODELOS E 11 ENUMS EM `meridian.prisma`; 14 COM `tenantId`, 2 GLOBAIS.*

| ENTIDADE | CAMPOS-CHAVE E REGRA |
|---|---|
| `MeridianTemplate` · `MeridianQuestion` | `version` única por tenant, `contestedSpread` 25, `gapThreshold` 60, `lockedAt` · `ordinal`, `type`, `weight`, `inverted`, `scaleLabels` |
| `MeridianAssessment` | `orgName`, `sector`, `sizeBand`, `status`, `deadline`, `benchmarkOptIn` (`false`), `reassessmentOfId` |
| `MeridianRespondent` · `MeridianResponse` | `axis`, `status`, `tokenHash` `@unique`, `tokenExpiresAt` · `rawValue`, `normalized` Decimal(4,3) |
| `MeridianAxisScore` | `computed` write-once, `final` só por override, `confidence` Decimal(3,2), `spread`, `status`, `note` |
| `MeridianOverride` | `fromScore`, `toScore`, `rationale`, `reviewerId`; sem `updatedAt` |
| `MeridianGap` · `MeridianGapPromotion` | `severity`, `effort`, `costOfDelay`, `confidence`, `state`, `derived` · `targetProduct`, `targetEntityId?`, `revokedAt` |

**Não existe coluna `composite`:** a média dos finais é calculada na leitura
(`lib/composite.ts:4-5,19-30`) e não fica para trás no primeiro override. Contagem de modelos:
16 no schema, 13 no `plan.md`, 14 na completion de 2026-08-28, 27 no índice mestre.

| ENTIDADE | TRANSIÇÃO | QUEM GRAVA | ESTADO |
|---|---|---|---|
| Assessment | `DRAFT → COLLECTING → REVIEW` | primeiro `assignRespondent`; `closeCollection`, com scoring na mesma transação (`actions/collection.ts:84-89,257-276`) | implementado |
| Assessment | `REVIEW → FINALISED`, sem eixo contestado | nenhuma action; só o seed | ausente |
| Respondente | `INVITED → PENDING → DONE` · `→ REVOKED` | `saveDraft`, `submitBattery` · `revokeRespondent`, sem tela | implementado |
| Respondente | `→ OVERDUE` | nenhum código; só o rótulo na tela | ausente |
| Eixo | `COMPUTED` ou `CONTESTED → OVERRIDDEN` | `registerOverride`; novo scoring não desfaz | implementado |
| Gap | `OPEN → PLANNED` · `→ PROMOTED` e volta | `generatePlan`, em lote · `promoteGap`; `revokePromotion` sem tela | implementado |
| Gap | `→ RESOLVED` | nenhuma action | ausente |

---

## 4. O guard

Premissa (decisão do dono do produto, 2026-09-22): a consultoria Nebuloz opera o Meridian num
tenant próprio, para várias organizações; a sessão é dela, e o cliente só entra pelo token.

```text
        ┌───────────┐  sem sessão      ┌──────────────┐
        │ requisição│─────────────────▶│ UNAUTHORIZED │──▶ /sign-in
        └─────┬─────┘                  └──────────────┘
              ▼
        ┌───────────┐  sem MERIDIAN    ┌───────────┐
        │  módulo   │─────────────────▶│ FORBIDDEN │──▶ /meridian-indisponivel · "não contratado"
        └─────┬─────┘  ACTIVE · TRIAL  └───────────┘
              ▼
        ┌───────────┐  sem Membership  ┌───────────┐
        │   papel   │─────────────────▶│ FORBIDDEN │──▶ /meridian-indisponivel · "sem papel"
        └─────┬─────┘                  └───────────┘
              ▼
        ┌───────────┐  sem permissão   ┌───────────┐
        │ permissão │─────────────────▶│ FORBIDDEN │──▶ "Requer papel …"
        └─────┬─────┘                  └───────────┘
              ▼  MeridianContext { tenantId, userId, meridianRole }
```
*FIGURA 3 — ORDEM DAS PERGUNTAS. O LAYOUT GUARDA A NAVEGAÇÃO; TODA ACTION REPETE O GUARD.*

| ID | REQUISITO DE GUARD | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| MG-01 | Toda action com sessão começa por `requireMeridianContext` ou `requireMeridianPermissionContext` | implementado | os 9 arquivos de action com sessão; `apps/app/__tests__/meridian/guards.test.ts` |
| MG-02 | Ordem fixa: sessão → módulo → papel → permissão | implementado | `lib/guards.ts:18-32,81-114` |
| MG-03 | Módulo concedido só em `ACTIVE` ou `TRIAL`, dentro da validade | implementado | `packages/rbac/src/modules.ts:15,23-33` |
| MG-04 | Sem `MeridianMembership`, sem acesso; o `ADMIN` do tenant não herda | implementado | `lib/guards.ts:85-93`; `apps/app/e2e/meridian-diagnose.spec.ts:21-41` |
| MG-05 | A recusa nomeia o papel que concede a permissão | implementado | `packages/rbac/src/meridian-matrix.ts:98-107` |
| MG-06 | Toda escrita exige permissão da matriz | parcial | `withdrawContribution` muda o opt-in e apaga contribuições com qualquer papel e sem trilha (`actions/benchmark.ts:98-128`) |
| MG-07 | Papel em cache por 300 s, invalidado quando muda | parcial | `packages/rbac/src/meridian-resolve.ts:13,30-59`; `invalidateMeridianRoleCache` não tem chamador |
| MG-08 | Atribuir, trocar e revogar papel pela aplicação | ausente | só o bootstrap e o seed gravam `MeridianMembership` (`packages/provisioning/src/meridian.ts:260`; `apps/app/scripts/seed-meridian.ts:381`) |
| MG-09 | Papel como lente sobre o papel do Charter (Mapa de fronteiras) | ausente | gap: `MeridianRole`, `MeridianMembership` e matriz próprios; mudar exige o Charter como fonte do papel |
| MG-10 | Leitor de uma organização sem ver as outras do tenant | ausente | gap do modelo de consultoria: o guard isola tenant, não organização; `orgName` é texto (`schema:210-212`), e as listas filtram só `tenantId` (`actions/assessments.ts:126-129`; `actions/gaps.ts:81-88`) |

### O respondente externo

`assignRespondent` grava o SHA-256 de 32 bytes aleatórios e devolve o token em claro uma vez,
válido até o prazo (`actions/collection.ts:65-78,99`). A rota fica fora de `PROTECTED_PREFIXES`
(`packages/auth/proxy.ts:26-29`), e o hash é resolvido no client comum (`actions/respondent.ts:46-79`).

| ID | REQUISITO DO RESPONDENTE | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| MR-01 | Token de 32 bytes; só o hash persiste; revogar invalida na hora | implementado | `lib/respondent-token.ts:16-22`; `schema:259-263`; hash regravado (`actions/collection.ts:129-132`) |
| MR-02 | Token inexistente, expirado e revogado dão a mesma resposta | implementado | `actions/respondent.ts:28-31,63-65`; `apps/app/app/meridian-responder/[token]/page.tsx:34-80` |
| MR-03 | O tenant sai do token, nunca do request | implementado | `actions/respondent.ts:53-79` |
| MR-04 | Só as perguntas do eixo; pergunta de outro eixo é descartada | implementado | `actions/respondent.ts:117-127,203-209` |
| MR-05 | Toda leitura e todo upload pelo token na trilha (R-03) | parcial | `submitBattery` e `attachEvidence` auditam; `getBattery` e `saveDraft`, não |
| MR-06 | Resposta imutável depois do fechamento da coleta | ausente | `saveDraft` não confere o estado do assessment, e o token de quem concluiu vale até o prazo (`actions/respondent.ts:178-236`; `lib/respondent-token.ts:24-35`) |
| MR-07 | Escrita e trilha do respondente na mesma transação | ausente | chamadas em sequência no client comum (`actions/respondent.ts:258-271,317-352`) |
| MR-08 | A porta continua funcionando sem `BYPASSRLS` | ausente | a função `SECURITY DEFINER` está descrita e não existe (`packages/database/prisma/migrations/20260902130000_meridian_rls/migration.sql:63-81`) |

> **INVARIANTE CRÍTICA**
> Com a RLS inerte ([ADR-0012](../adr/0012-rls-anulada-por-conexao-superuser.md)), quem isola
> é o `where`, e toda relação seguida por `include` precisa ter nascido no mesmo tenant. Dois
> ids entram sem essa conferência: `reassessmentOfId` (`actions/assessments.ts:345,388`), lido
> pelo diff (`actions/report.ts:191-198`), e o `assessmentId` de gap criado à mão
> (`actions/gaps.ts:203-226`), lido pelo registro (`actions/gaps.ts:90-97`). Com um id de outro
> tenant, os dois atravessam [inferido].

---

## 5. Scoring e dispersão

As fórmulas como estão no código. O motor é função pura; o resto vive em volta dele.

```text
NORMALIZAÇÃO — lib/scoring.ts:44-57
  LIKERT v = clamp(raw, 0, 4) / 4 · YES_NO v = 1 se raw = 0 ("Sim"), senão 0
  SCALE  k = max(2, nº de rótulos);  v = clamp(raw, 0, k − 1) / (k − 1)
  inverted → v = 1 − v, nos três tipos
SCORE DO EIXO — lib/scoring.ts:121-136
  m_q = média de v entre quem respondeu q;  score = round(100 × Σ w_q·m_q / Σ w_q)
DISPERSÃO — lib/scoring.ts:63-81, 138-153
  s_r = Σ w_q·v_rq / Σ w_q, nas perguntas que r respondeu
  spread = round(100 × (max s_r − min s_r)); 0 com menos de dois respondentes
CONFIANÇA — lib/scoring.ts:155-160
  n = respondentes com ao menos uma resposta; cobertura = respostas ÷ (perguntas × n)
  amostra = min(1, n ÷ 2); concordância = 1 − spread ÷ 100
  confiança = round(100 × clamp(cobertura × amostra × concordância, 0, 1)) ÷ 100
STATUS — lib/scoring.ts:110-119, 162
  CONTESTED se spread ≥ contestedSpread (25), senão COMPUTED
  eixo sem resposta: score 0, confiança 0, COMPUTED
DERIVAÇÃO DE GAP — actions/scoring.ts:170-179, 207-285
  valor = final ?? computed ?? score desta passada;  deriva se valor < gapThreshold (60),
  uma vez por assessment × eixo;  lacuna = max(0, 60 − valor), 60 fixo (:246);  razão = lacuna ÷ 60
  severidade HIGH se razão ≥ 0,5 · MEDIUM se ≥ 0,25 · LOW;  esforço L · M · S, mesmos cortes
  custo de atraso = min(100, round(100 × razão) + lacuna)
  selo = MEASURED se confiança ≥ 0,75 · ESTIMATED se ≥ 0,5 · DECLARED
COMPOSITE E TOM — lib/composite.ts:14-40
  composite = round(Σ final dos cinco eixos ÷ 5), nulo se faltar eixo
  tom: score ≥ 70 · 50–69 · < 50;  confiança ≥ 0,75 · 0,5–0,74 · < 0,5
COORTE — lib/benchmark.ts:16-89; actions/benchmark.ts:30-91
  cohortKey = setor sem acento, minúsculo, aparado + " · " + faixa aparada
  contribuição = final ?? computed por eixo, regravada a cada scoring com opt-in
  n = nº de assessmentId distintos;  p(q) = interpolação linear em (N − 1)·q, arredondada
  retida se n < 5 ou se faltar eixo nas bandas
PLANO — lib/graph.ts:71-136; lib/plan.ts:27-38
  ordem = Kahn, empate por custo de atraso decrescente e depois código
  fatia = ceil(N ÷ 4);  trimestre(i) = min(4, floor(i ÷ fatia) + 1);  seq = i + 1
```

Um final de 46 deriva gap `LOW`, esforço `S`, custo de atraso 37 (lacuna 14, razão 0,23);
`MEDIUM` só a partir de 45, `HIGH` a partir de 30.

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| MS-01 | Mesmo template e mesmas respostas → mesmo resultado | implementado | ordem por `ordinal` e `AXIS_IDS` (`lib/scoring.ts:102-108`); teste do motor |
| MS-02 | `computed` gravado uma vez, também em novo scoring; sobrescrito não volta a contestado | implementado | `actions/scoring.ts:134-153`; a nova passada muda confiança, spread e status, não o número |
| MS-03 | Limiares vêm do template | parcial | contestação e derivação sim; severidade e custo usam 60 fixo (`actions/scoring.ts:246`) |
| MS-04 | "0" e "não medido" não se confundem | parcial | composite nulo sem os cinco eixos (`lib/composite.ts:16-30`); eixo com respondente e sem resposta fecha com `computed = 0` e gap `HIGH` de custo 100 |
| MS-05 | Plano checado antes de gravar: nenhum item antes de pré-requisito | implementado | `actions/plan.ts:89-99` |
| MS-06 | Limiar de coorte num ponto só, fora da resposta da action | implementado | `lib/benchmark.ts:70-89`; `actions/report.ts:121-132` |
| MS-07 | Contribuição e agregado na transação do scoring | ausente | `contributeInTx` recebe `db` e escreve com `database` (`actions/benchmark.ts:58-91`), ao contrário do comentário das linhas 27-29 |

Onde a spec kit e o código divergem, vale o código hoje. **Contestado:** FR-015 diz "exceder";
R-05 e o código usam `≥`. **Inversão:** R-04 inverte só `SCALE`; o código, qualquer tipo — a
bateria v3.2 só inverte `Q-D03`, que é `SCALE` (`packages/provisioning/src/meridian.ts:56-62`).
**Override:** FR-017 compara com o computado; o código, com o final atual
(`actions/overrides.ts:62-68`). **Plano:** R-06 manda por nível topológico; o código fatia por
posição, e com 5, 6 ou 9 gaps o Q4 fica vazio (2/2/1/0, 2/2/2/0, 3/3/3/0) — o comentário de
`lib/plan.ts:22-23` diz 2/2/1/1 para 6, e os testes cobrem só 4, 8 e 12 gaps. **Pool:**
override posterior ao scoring não recontribui [inferido de `actions/overrides.ts:30-116`].

---

## 6. Interfaces

| INTERFACE | DIREÇÃO | PROPÓSITO | ESTADO |
|---|---|---|---|
| Back-office · `bootstrapMeridianAction` | In | Papel `CONSULTANT` para e-mail já cadastrado; template v3.2 | implementado, no tenant do cliente (`apps/backoffice/app/actions/provisioning.ts:117-142`) |
| `@repo/auth` · `@repo/rbac` · Upstash | In | Sessão, módulo e papel; cache opcional de 300 s | implementado |
| Scaffold · `createTrackFromGap` | In | Lê a promoção `SCAFFOLD` pendente, cria a trilha, grava `targetEntityId` | implementado, com tela (`apps/app/app/(scaffold)/actions/tracks.ts:115-156,278-292`; `apps/app/components/scaffold/new-track-modal.tsx`) |
| Back-office · `materializarEngajamento` | In | Lê promoções via `platformDb`, cria `Engagement`, grava `targetEntityId` | implementado, sem tela: só testes chamam (`apps/backoffice/app/actions/scaffold.ts:56-66,144-188`; `apps/backoffice/__tests__/scaffold.test.ts`) |
| Cosmos · Charter · Signal | Out | Destino de promoção | ausente — só o registro |
| Supabase Storage | Out | Upload do respondente; URL assinada de 300 s, auditada antes | parcial — download sem tela (`actions/report.ts:24,264-302`) |
| `AuditLog` | Out | `meridian.*`; `actorType` `user` ou `respondent`; diff `[campo, antes, depois]` | parcial (MN-02, MN-09) |
| Export do plano | Out | JSON de `specs/001-meridian-diagnose/contracts/plan-export.md` | parcial — sai no console; `promoted_to.entity_id` pode ser nulo |
| E-mail | Out | Convite e lembrete | ausente |
| Job LGPD · `lgpd-dsr.ts` | In | Anonimiza nome e e-mail, expira o token, anonimiza `fileName` | parcial — o arquivo fica (`apps/app/lib/inngest/lgpd-dsr.ts:175-233`) |

O contrato cita `getGap`, que não existe; `readCohort` é `readCohortAction`; `contributeToBenchmark`
é `contributeInTx`, interno; e `consultantId` vem da sessão, não do input (`actions/assessments.ts:385`).

### Fronteiras

Alvo normativo: o [Mapa de fronteiras](./mapa-de-fronteiras.md) (Arquitetura de produto,
ago/2026 v1), que põe o Meridian em AVALIAR — "Estamos prontos?".

| ENTIDADE DO MAPA | TABELA | QUEM LÊ OU ESCREVE NO CÓDIGO | GAP E O QUE TERIA DE MUDAR |
|---|---|---|---|
| Avaliação de prontidão (dona: Meridian) | `MeridianAxisScore`, `MeridianOverride` | só o Meridian; o back-office tem `AvaliacaoDeMaturidade` própria (`packages/database/prisma/schema/platform-ops.prisma:667-715`) | Scaffold e Signal lerem, sem recalcular; o back-office largar a rubrica própria |
| Escala de confiança (dona: Meridian) · costura Meridian → Signal | enum `MeridianConfidence` | só o Meridian; o Signal usa Alta, Média e Baixa (`apps/app/lib/signal/confidence.ts:32-54`), e o Scaffold duplica o enum | O escore do Signal, `ScaffoldMetricConfidence` e o `wsjfConfidence` do Cosmos darem lugar a ele |
| Gap register (dono: Meridian) | `MeridianGap`, `MeridianGapPromotion` | Scaffold lê (`tracks.ts:123,281,561`) e grava `targetEntityId` (`tracks.ts:153-156`); o back-office também grava (`apps/backoffice/app/actions/scaffold.ts:166-188`) | Consumidores pararem de escrever na promoção; o Cosmos criar a iniciativa com `origin_gap_id`, do tenant da consultoria ao do cliente, travessia hoje restrita pelo ADR-0013 |
| Usuário e papel (dono: Charter) | `MeridianMembership` | o guard do Meridian | Papel do Meridian como lente sobre o do Charter (MG-09) |
| Trilha (dona: Charter) · costura Todos → Charter | `AuditLog` | todos | Alinhado no formato ([ADR-0009](../adr/0009-auditoria-reusa-auditlog.md)) |

O mapa põe engajamento e trilha sob o Scaffold, com o back-office só lendo, e pede a revisão
do ADR-0014, que faz do `Engagement` o destino da promoção.

---

## 7. Requisitos não-funcionais

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| MN-01 | `tenantId` no `where` de toda leitura e escrita de tenant | parcial | as duas exceções da §4 |
| MN-02 | Escrita e trilha na mesma transação | parcial | actions com sessão, sim (`packages/database/tenant-db.ts:20-31`); respondente e benchmark, não |
| MN-03 | Trilha e override append-only | implementado | trigger no `AuditLog` (`packages/database/prisma/migrations/20260603000002_audit_log_immutable_trigger`); override só por `create`, sem trigger próprio |
| MN-04 | RLS nas 14 tabelas de tenant | parcial | declarada e inerte (`packages/database/prisma/migrations/20260902130000_meridian_rls/migration.sql:9-14,34-61`) |
| MN-05 | Evidência fora do banco, em bucket privado, até 10 MB, com trilha antes da URL assinada | implementado | `packages/storage/src/index.ts:15,21-35`; `actions/report.ts:271-294`; sem lista de tipos de arquivo |
| MN-06 | Carteira e registro em menos de 2 s com 200 assessments e 2.000 gaps | ausente | sem teste de carga; as listas não paginam (`actions/assessments.ts:112-209`; `actions/gaps.ts:73-138`) |
| MN-07 | Página do respondente fora de índice; nenhuma IA no módulo | implementado | `apps/app/app/meridian-responder/[token]/page.tsx:20-24`; nenhum import de SDK de IA |
| MN-08 | Eliminação LGPD alcança o respondente | parcial | o arquivo fica no bucket; o nome segue em `AuditLog.metadata` e `target`, tabela append-only [inferido de `actions/_shared.ts:87-115` e `actions/collection.ts:95`] |
| MN-09 | Leitura de resposta de respondente registrada | parcial | `getDivergence` exige `evidence.read` e diz auditar, mas não grava (`actions/scoring.ts:355-421`) |

> **CUIDADO COM LEITURA CRUZADA**
> As duas tabelas de benchmark são globais por contrato e as únicas lidas sem `tenantId`
> (`actions/benchmark.ts`; `actions/report.ts:121-125`). A contribuição guarda o `assessmentId`
> sem FK: pseudônimo, não anônimo, para quem acessa o banco [inferido de `schema:515-527`].

---

## 8. Restrições e premissas

- O produto escala com respondentes, respostas e gaps por tenant. A carteira agrega respostas
  com `groupBy` e lê todos os respondentes do tenant a cada render (`actions/assessments.ts:122-165`).
  Em produção, o módulo está ativo em 4 tenants internos ou de teste, com 2 assessments (banco
  de produção, consulta de 2026-09-22): nenhuma dessas leituras foi exercida em escala.
- A porta do respondente depende de `BYPASSRLS` e não tem teto de requisição; a proteção é a
  entropia do token (256 bits) e a resposta única para token inválido. O token de quem concluiu
  vale até o prazo (`lib/respondent-token.ts:24-35`).
- `promoteGap` só registra a intenção, por decisão: a promoção não pode falhar porque o destino
  não foi contratado (`apps/app/app/(scaffold)/actions/tracks.ts:109-113`).
- A casca conhece quatro módulos; um `SCAFFOLD` contratado chega ao seletor sem metadado
  (`apps/app/components/meridian/shell.tsx:35-65,257-289`; `actions/shell.ts:13,49`) [inferido].
- `seed:meridian` apaga o domínio do tenant alvo, `nebuloz` por padrão, onde o dogfood é gravado
  (`apps/app/scripts/seed-meridian.ts:74,409-424`; `apps/app/scripts/seed-meridian-nebuloz.ts:62`).
- `apps/app/app/(meridian)/layout.tsx:19-21` e o `plan.md` põem a rota do respondente em
  `(meridian)/responder/[token]`; ela vive em `meridian-responder/[token]`.

---

## 9. Critérios de aceite

| CRITÉRIO | HOJE |
|---|---|
| Nenhuma action com sessão chega ao Prisma sem o guard; um `ADMIN` sem papel não entra | sim — `apps/app/__tests__/meridian/guards.test.ts`; `apps/app/e2e/meridian-diagnose.spec.ts:21-41` |
| Duas execuções do motor sobre a mesma entrada são idênticas | sim — `apps/app/__tests__/lib/meridian-scoring.test.ts:80` |
| Override com justificativa curta ou sem mudança é recusado, e o computado não muda | sim — `apps/app/__tests__/meridian/overrides.test.ts` |
| Ciclo é recusado com os códigos, e nenhum item do plano precede um pré-requisito | sim — `apps/app/__tests__/lib/meridian-graph.test.ts`; `apps/app/__tests__/lib/meridian-plan.test.ts` |
| Coorte abaixo de 5 sai da action sem percentis | sim — `apps/app/__tests__/meridian/benchmark.test.ts` |
| Token inexistente, expirado e revogado devolvem o mesmo erro | sim — `apps/app/__tests__/meridian/respondent.test.ts` |
| A trilha do acesso à evidência é gravada antes da URL | sim — `apps/app/__tests__/meridian/report.test.ts` |
| Resposta travada no fechamento; relatório só depois da fila de contestados | não — MR-06; SC-004 no PRD |
| Um tenant não lê dado de outro por nenhum caminho | não garantido — RLS inerte e os dois ids da §4 |
| A consultora cria assessment e atribui respondente pela tela | não — M-05 e M-07 no PRD |

---

*Engineering draft. Documento companheiro: Meridian PRD v1.0.*
