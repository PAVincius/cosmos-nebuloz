# Charter — Software Requirements Document

> **PRODUCT** Charter · **COMPANION** [Charter PRD v1.0](./charter-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança

Especificação do módulo de governança: guard de quatro portões, as quatro regras
que são o produto, trilha gravada na mesma transação e os gaps de fronteira.

---

## 1. Escopo

Especifica o Charter em `apps/app`: a rota `/charter/[[...seg]]`, com 11 telas, e
o portão `/charter-indisponivel`; 12 módulos de server action em 15 arquivos; as
regras de `lib/charter`; 18 modelos e 21 enums em `charter.prisma`; a matriz de
`packages/rbac`; o bootstrap e a derivação de teto de `packages/provisioning`.

**Fora de escopo:** criação de tenant e contrato de módulo (back-office), sessão e
SSO (`@repo/auth`), envio de notificação (ADR-0011) e bloqueio de uso em runtime.

**Fontes.** SRD & Data Model do Charter (projeto de design, ago/2026): norma de
telas e dados. [Mapa de fronteiras](./mapa-de-fronteiras.md) (Arquitetura de
produto, ago/2026 v1): alvo de propriedade entre produtos. `main` em `ea512044`
(2026-09-22): o estado. Cada requisito diz **implementado**, **parcial** ou
**ausente**, com evidência. Divergência com o SRD & Data Model traz as duas
versões, e vale o código; divergência com o Mapa é gap. Prefixos: `A/` =
`apps/app/app/(charter)/actions/`, `C/` = `apps/app/components/charter/`, `L/` =
`apps/app/lib/charter/`, `P/` = `packages/provisioning/src/`, `R/` =
`packages/rbac/src/`, `S/` = `packages/database/prisma/schema/`.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Classe de dado | Público, Interno, Confidencial, Restrito; peso 1, 2, 4 e 5 |
| Caminho | Quem revisa, SLA em dias úteis e nível de HITL de um caso (`UC-NNN`); congelado na submissão |
| Teto | Classe máxima que o contrato do fornecedor permite; sempre derivado |
| Cláusula crítica | CL-01, CL-02, CL-03, CL-04 e CL-08; a ausência limita o teto |
| Capacidade | O que o Charter consegue provar; relê o registro a cada abertura |

---

## 2. Arquitetura

```text
          ┌───────────────────────────────────────┐
          │ /charter/[[...seg]] · layout + shell  │  guard na navegação
          └───────────────────┬───────────────────┘
                              ▼
          ┌───────────────────────────────────────┐
          │ server action · safeAction · guard    │  guard em toda RPC
          └────────┬──────────────────────┬───────┘
                   ▼                      ▼
            ┌─────────────┐   ┌───────────────────────┐
            │ lib/charter │   │ withTenantDb + trilha │  mesma transação
            └─────────────┘   └───────────┬───────────┘
                                          ▼
                    PostgreSQL · 18 tabelas do Charter · AuditLog
```
*FIGURA 1 — TOPOLOGIA. REGRA SEM I/O À ESQUERDA; TODA ESCRITA GRAVA A TRILHA NA MESMA TRANSAÇÃO. DEPENDÊNCIAS EXTERNAS EM §6.3.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `apps/app/app/(charter)/layout.tsx` · `C/screens/registry.tsx` | Primeiro portão; 11 ids de tela, e id ausente vira `ComingSoon`, não link morto |
| `A/*.ts` | Actions por área; toda escrita chama `logCharterAudit` na transação |
| `L/rules.ts` · `L/capabilities.ts` | Regras iguais no cliente e no servidor; catálogo das 7 capacidades, em código |
| `L/guards.ts` · `R/charter-matrix.ts` | Ordem do guard, erros 422 e 409; 7 papéis × 12 permissões, sem coringa |
| `P/charter.ts` · `P/charter-rules.ts` | Bootstrap idempotente; derivação do teto, dividida com o back-office |

> **CONTRATO DE ACTION**
> Toda action devolve `Result<T>` por `safeAction`. As classes de erro seguem a
> convenção do SRD & Data Model (`FORBIDDEN`, 422 com a regra, 409 com os
> bloqueadores), mas `safeAction` devolve só `{ ok: false, error }`, sem `code`
> (`apps/app/app/actions/_base.ts:78-87`); o cliente não distingue os três.

---

## 3. Modelo de dados

```text
Tenant ──1:1── CharterSettings                      perfil, postura, retenção, gatilhos
  ├──1:N── CharterMembership ──N:1── User           papel de governança
  ├──1:N── CharterSequence                          códigos UC, MIT, V, CL, TR
  ├──1:N── CharterPolicy ──1:N── CharterPolicySection ──N:1── CharterRequirement
  │            ├──1:N── CharterPolicyVersion ──1:N── CharterAcknowledgment
  │            ├──1:N── CharterTrack ──────────1:N── CharterAcknowledgment
  │            └──1:N── CharterPolicyLink           USE_CASE | VENDOR
  ├──1:N── CharterVendor ──N:M── CharterClause      via CharterVendorClause
  │            └──1:N── CharterUseCase ──1:N── CharterDecision
  │                                    └──1:N── CharterMitigation
  ├──1:N── CharterCoverage ──N:1── CharterRequirement ──N:1── CharterRequirementSet
  │                                                 tenantId nulo = regulação global
  └──1:N── AuditLog                                 tabela da plataforma · charter.*
```
*FIGURA 2 — 18 MODELOS E 21 ENUMS EM `charter.prisma`. RLS FORCE EM 16; AS DUAS TABELAS DE EXIGÊNCIA NÃO TÊM RLS POR DESENHO.*

| ENTIDADE | CAMPOS-CHAVE |
|---|---|
| `CharterUseCase` | `dataClass`, `exposure`, `criticality`, `vendorId`, `status`, `approvalPath`, `slaTotal`, `hitl`, `submittedAt`, 7 `risk*`, 7 `prob*`, `restrictions`, `blockReason`, `changeRequest`, `vendorIneligible` |
| `CharterDecision` | `outcome`, `rationale`, `conditions`, `deciderId`, `deciderRole`, `previousStatus` |
| `CharterVendor` | `tier`, `dpa`, `retention`, `region`, `subprocessors`, `score`, `maxClass` (cache derivado), `notes` |
| `CharterPolicyVersion` | `version`, `summary`, `snapshot`, `changeCount`, `status` (`PUBLISHED` ou `SUPERSEDED`) |

**Não existe campo digitado de teto, SLA restante nem cobertura de trilha.**
`maxClass` é cache recomputado a cada mudança de postura (ADR-0003); SLA, cobertura
e vigência resolvida de norma saem da leitura (`L/rules.ts:416-426`,
`A/onboarding.ts:65-92`, `L/vigencia.ts:1-24`).

### Divergências do DATA-MODEL

| ITEM | SRD & DATA MODEL | CÓDIGO (VALE HOJE) |
|---|---|---|
| Organização | `Organization` | `CharterSettings` (indústria, geo, postura, porte, retenção, gatilhos) mais `Tenant` (`S/charter.prisma:135-150`) |
| Auditoria | `AuditEntry` própria, `A-####` | `AuditLog` da plataforma, `entityType charter.*`, id cuid (ADR-0009) |
| Permissões | 10 | 12: mais `compliance.map` e `compliance.edit` (`R/charter-matrix.ts:15-27`) |
| Mitigação | `overdue` é status | Derivado de `dueDate`; o enum tem OPEN, PROGRESS e DONE |
| Score do fornecedor | 0–100, maior é pior | Coluna com default 50 que nenhuma escrita calcula (`S/charter.prisma:282`) |
| Risco do caso | 7 eixos de 1 a 5 | 7 de impacto e 7 de probabilidade; nenhuma tela escreve os 14 |
| Estados do caso | `changes` volta a `review`; `archived` ao fim | Nenhuma action grava `REVIEW` nem `ARCHIVED`; `CHANGES` não tem reenvio |
| Fornecedor do caso | Exatamente um | `vendorId` opcional; obrigatório só na submissão (`A/cases.ts:320-341`) |
| Aceite | `AckPending` | Uma linha por pessoa e trilha; publicar zera status e data e mantém o `policyVersionId` antigo (`A/policy.ts:410-413`) |
| Mudanças da versão | Contagem de mudanças | `changeCount` = total de seções da política (`A/policy.ts:365`) |
| Conformidade | Não existe | `CharterRequirementSet`, `CharterRequirement`, `CharterCoverage` e `CharterPolicyLink` (migration `20260806000000_charter_conformidade`) |

---

## 4. O guard

Todo entry point — layout, página e action — começa por `requireCharterContext`.
O layout protege navegação; não protege RPC (`apps/app/app/(charter)/layout.tsx:9-13`).

```text
requisição
  ├─ sem sessão de tenant ─────────────────────▶ UNAUTHORIZED ──▶ /sign-in
  ├─ módulo CHARTER não vigente ───────────────▶ FORBIDDEN    ──▶ /charter-indisponivel
  ├─ sem CharterMembership (ADMIN não herda) ──▶ FORBIDDEN    ──▶ "peça a um Compliance Lead"
  ├─ papel sem a permissão ────────────────────▶ FORBIDDEN    ──▶ "Requer papel … — …"
  └─ passa nos quatro ─▶ CharterContext { userId, tenantId, charterRole }
```
*FIGURA 3 — ORDEM FIXA, DE CIMA PARA BAIXO (`L/guards.ts:18-28`). VIGENTE É `ACTIVE` OU `TRIAL`, SEM `expiresAt` VENCIDO (`R/modules.ts:23-33`).*

| ID | REQUISITO DE GUARD | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| NFR-1.1 | Isolamento por RLS em Postgres | parcial | RLS FORCE em 16 das 18 tabelas e em `TenantModule` (`packages/database/prisma/migrations/20260728120000_charter_module/migration.sql:510-535`); a conexão superuser anula (ADR-0012); quem isola é `tenantId` no `where` |
| NFR-1.2 | Sessão presa a um tenant | implementado | `requireTenantSession` em toda action (`L/guards.ts:75-90`) |
| NFR-1.3 | Default deny no servidor e na UI, com motivo | implementado | `R/charter-matrix.ts:86-149`; `GatedButton` com `denialReason` (ADR-0004); sem papel, o portão explica (`apps/app/app/charter-indisponivel/page.tsx:74-103`) |
| NFR-1.4 | SSO SAML 2.0 por tenant | ausente | A plataforma grava a configuração de IdP (`apps/app/app/actions/settings/sso.ts`), mas só telas de configuração a leem; `@repo/auth` não a consome |
| NFR-1.5 | Trilha append-only, sem UPDATE nem DELETE | parcial | Trigger imutável (migration `20260603000002_audit_log_immutable_trigger`); a revogação de grant espera o papel `cosmos_app` (ADR-0012) |
| NFR-1.6 | Retenção de 30, 90 ou 365 dias e região de dado | ausente | Valor gravado e exibido (`A/settings.ts:194`, `C/screens/audit.tsx:134`), sem nada que o aplique; a região não entra no pacote (`A/audit.ts:160-217`) |
| CHG-01 | Admin do tenant não herda permissão de governança | implementado | `L/guards.ts:79-87`; ADR-0002 |
| CHG-02 | Só Compliance atribui papel, sem rebaixar o último Compliance | parcial | `A/settings.ts:331`, `:376-386`; a corrida entre duas chamadas está documentada e aberta (`:363-375`) |
| CHG-03 | Cache de papel invalidado na troca | implementado | 300 s com sentinela `"none"` (`R/charter-resolve.ts:13-48`); invalidação em `A/settings.ts:409` |
| CHG-04 | Aceite exige papel; em nome de terceiro, justificativa de 10+ caracteres | implementado | `A/onboarding.ts:240-285`. Qualquer papel registra: não há permissão própria |

> **INVARIANTE CRÍTICA**
> `tenantId` vai no `where`, dentro de `withTenantDb`: é o que isola hoje. As duas
> tabelas de exigência não têm RLS porque carregam regulação global com `tenantId`
> nulo; toda leitura filtra "meu tenant ou global" à mão (`A/compliance.ts:21-28`).
> Sem o filtro, a RFP de um cliente vaza a outro.

---

## 5. Regras de governança

Moram em `L/rules.ts` e `P/charter-rules.ts`, sem I/O: o intake recalcula no
cliente a cada tecla, e o servidor revalida com a mesma função (`L/rules.ts:9-16`).

### 5.1 `recommendPath` — FR-4 · implementado, igual ao SRD & Data Model
```text
peso(classe): PUBLIC 1 · INTERNAL 2 · CONFIDENTIAL 4 · RESTRICTED 5   (salto 2→4 intencional)
primeira condição que casar:
  peso ≥ 5 ou (EXTERNAL e HIGH) → Legal + Segurança + Comitê de IA · SLA 10 · red    · FULL_REVIEW
  peso ≥ 4 ou HIGH              → Segurança + Legal               · SLA 5  · amber  · FULL_REVIEW
  peso ≥ 2 ou EXTERNAL          → Segurança                       · SLA 3  · accent · SAMPLING
  senão                         → Via rápida                      · SLA 1  · green  · PASSIVE
```
- Devolve também a frase da regra que decidiu (`L/rules.ts:80-133`). Caminho, SLA e HITL congelam na submissão (`A/cases.ts:392-398`; ADR-0005); rascunho não congela.
- "Via rápida — aprovação automática com registro" é rótulo: todo caso vai a `SUBMITTED` e espera decisão (`A/cases.ts:392`). `CharterSettings.posture` não é entrada; o apetite de risco do Mapa não chega aqui (§6.3).

### 5.2 SLA em dias úteis — FR-3 · implementado
```text
slaRemaining = slaTotal − diasÚteis(submittedAt, agora)    // null antes da submissão
diasÚteis    = dias sem sábado, domingo e feriado nacional
tom          = null → accent · < 0 → red + "vencido" · ≤ 2 → amber · senão green
```
- `L/rules.ts:385-440`. Feriados da BrasilAPI em cache de 30 dias; se a API falhar, conta só fim de semana (`apps/app/lib/feriados/index.ts:1-27`). O ADR-0006 diz "feriado fora do V1", mas o código conta feriado nacional desde #185 (2026-09-06); vale o código.
- O SLA corre em `SUBMITTED`, `REVIEW` e `CHANGES`; bloquear zera `slaTotal` (`A/cases.ts:121`, `:585`).

### 5.3 Gate de fornecedor — FR-4 · implementado
```text
sem fornecedor  → recusa vendor.required
elegível        = maxClass ≠ null e peso(maxClass) ≥ peso(classe do caso)
não elegível    → recusa vendor.maxClass, com o motivo lido de vendor.notes
```
- `L/rules.ts:157-183`; `A/cases.ts:320-341`. Vale para caso novo e para rascunho promovido (`submitDraftCase`); rascunho passa sem gate e sem SLA.

### 5.4 Teto do fornecedor — FR-9 · implementado, sem validação jurídica
```text
tier = BLOCKED               → null            nenhum dado
falta DPA ou CL-01           → PUBLIC
falta CL-02, CL-03 ou CL-04  → INTERNAL
falta CL-08                  → CONFIDENTIAL
senão                        → RESTRICTED
```
- `P/charter-rules.ts:37-82`, com o raciocínio degrau a degrau. O SRD & Data Model manda derivar e mostrar sem dar o algoritmo; a escada é decisão de engenharia sem aval de Legal e Segurança (ADR-0003:92-94). Recalcula no cadastro, no tier e nas cláusulas, marcando `vendorIneligible` nos casos vinculados sem bloqueá-los (`A/vendors.ts:211-254`); o export do back-office recalcula só o teto.
- **Pré-condição que falha em tenant criado pelo bootstrap:** as cláusulas vêm da biblioteca do tenant (`A/vendors.ts:431-434`), e o bootstrap não cria biblioteca (`P/charter.ts:67-158`). Sem CL-01, o teto para em `PUBLIC`.

### 5.5 Score de risco — FR-5, FR-7 · regra implementada, entrada ausente
```text
severidade    = max(privacy, regulatory, security, bias, ip, operational, reputational)
probabilidade = max(1, round(média dos mesmos 7))
score         = severidade × probabilidade                  // 1..25
rótulo        = ≥ 16 Crítico (red) · ≥ 9 Elevado (amber) · ≥ 4 Moderado (green) · < 4 Baixo (green)
```
- `L/rules.ts:215-261`, igual ao SRD & Data Model; severidade é máximo de propósito. Nenhuma tela chama `rescoreCase` (`A/cases.ts:646-714`, `risk.score`, auditado) e o intake não pede risco: em caso criado pela tela, todo eixo nasce 1, score 1, "Baixo". Fora `rescoreCase`, só os seeds escrevem risco.
- As 7 colunas `prob*` (`S/charter.prisma:376-382`) só são lidas pela capacidade RISK_SCORING (`L/capabilities.ts:189-224`). `nivel()` (`L/risk-matrix.ts:19-30`) usa 15/9/4 e só aparece em teste; a escala que vale é a de cima.

### 5.6 Bloqueio de publicação — FR-2 · implementado
```text
bloqueadores = seções com status ≠ PUBLISHED
política sem seção       → bloqueador "Política sem seções"
publicar com bloqueador  → 409 policy.publishBlocked, com nome e status de cada um
```
- `L/rules.ts:310-321`; `A/policy.ts:336-351`; o modal lista os bloqueadores pela leitura da política (`A/policy.ts:98-123`). Publicar exige resumo, sobe o minor (`v1.0` na primeira), grava snapshot, marca a anterior `SUPERSEDED`, agenda revisão em 6 meses, zera os aceites das trilhas vinculadas e marca reatribuição (`A/policy.ts:297-432`; ADR-0007).

### 5.7 Veredito de conformidade — FR-13 · implementado

- `ATENDE` e `PARCIAL` exigem capacidade do catálogo; `NAO_APLICAVEL` exige comentário; capacidade desconhecida é recusada (`A/compliance.ts:584-608`). Conjunto `REFERENCIA` não guarda texto de norma; código repetido na colagem recusa a importação inteira (`A/compliance.ts:166-182`). Conjunto global é da Nebuloz: o tenant adota a versão nova e não faz fork (`A/compliance.ts:263-274`).

---

## 6. Interfaces

### 6.1 API sugerida × server actions

O SRD & Data Model sugere REST; o código usa server actions. Nos dois, o tenant vem da sessão.

| SUGERIDO | NA MAIN | PERMISSÃO | ESTADO |
|---|---|---|---|
| `GET /api/policy` | `getPolicy`, `getPolicyScope` | papel | implementado |
| `PATCH /sections/:id` | `editSection`, `setSectionStatus`, `generatePolicyDraft`, `saveGeneratedDraft` | `policy.edit` | implementado |
| — | `linkPolicy`, `unlinkPolicy` (escopo da política) | `policy.edit` | implementado |
| `POST /versions` (409) | `publishPolicyVersion` | `policy.publish` | implementado; o 409 não chega ao cliente |
| `POST /cases` (422) | `submitCase`, `submitDraftCase` | `case.submit` | implementado; o 422 também não |
| `POST /cases/:id/decision` | `decideCase` | `case.decide` | implementado |
| `/risks`, `/mitigations` | `rescoreCase`; `createMitigation`, `setMitigationStatus` | `risk.score` | parcial: `rescoreCase` sem tela |
| `/vendors`, `/vendors/:id/tier` | `listVendors`, `getVendor`, `createVendor`, `setVendorTier` | `vendor.approve` na escrita | implementado |
| `/clauses`, `/vendors/:id/clauses` | `getClauseLibrary`, `setVendorClauses` | `clause.manage` na escrita | parcial: biblioteca só por seed |
| `/onboarding/tracks` | `getOnboarding`, `publishTrack`, `acknowledge` | `onboarding.publish`; papel no aceite | implementado |
| `/audit`, `/audit/export` | `listAudit`, `exportEvidence` | `audit.read`, `audit.export` | implementado |
| — | `importRequirementSet`, `publishSetVersion`, `adoptSetVersion`, `setCoverage`; `getComplianceMap`, `exportComplianceMap` | `compliance.edit`; `compliance.map`; `audit.export` | implementado |
| — | `setMemberCharterRole`, `updateWorkspace`, `setNotificationTrigger` | papel `COMPLIANCE`; `policy.edit` | implementado; gatilho sem efeito |

### 6.2 Efeitos colaterais do DATA-MODEL

| EFEITO | ESTADO | EVIDÊNCIA |
|---|---|---|
| Decidir grava diff | implementado | `A/cases.ts:602-622` |
| Decidir notifica; restrição abre pendência de aceite das condições | ausente | ADR-0011:39-46 |
| Publicar invalida aceites e marca reatribuição | implementado | `A/policy.ts:396-414`; nada limpa a marca depois |
| Mudar tier reavalia todos os casos vinculados | implementado | `A/vendors.ts:211-254` |
| Repontuar recalcula e reposiciona | parcial | Action pronta, sem tela |
| Exportar grava a si mesmo | implementado | `A/audit.ts:200-207`; `A/compliance-export.ts:96-104` |
| SLA vencido alerta revisor e Compliance por job | ausente | Só alerta na leitura da Visão Geral (ADR-0011:42-43) |

### 6.3 Fronteiras e gaps do Mapa de fronteiras

| INTERFACE | DIREÇÃO | PROPÓSITO |
|---|---|---|
| Back-office | In · Out | Contrata `TenantModule` e roda `bootstrapCharter` (`apps/backoffice/app/actions/provisioning.ts:89-160`); lê prontidão (`apps/backoffice/app/actions/clients.ts:102-110`); grava `CharterVendor` do tenant `nebuloz` e recalcula o teto (`apps/backoffice/app/actions/empresa/fornecedores.ts:262-342`) |
| Scaffold | Out | Lê a política no SG-05; o aceite fica em `ScaffoldPhaseInstance` e em `AuditLog`, não em `CharterAcknowledgment` (`apps/app/app/(scaffold)/actions/gates.ts:123-149`, `:532-552`) |
| `@repo/ai` · `@repo/rbac` · Upstash · BrasilAPI · `@react-pdf` | In · Out | LLM pela primeira chave presente: Anthropic (`claude-haiku-4-5`), Google (`gemini-2.0-flash`) ou OpenAI (`gpt-4o-mini`) (`packages/ai/lib/router.ts:11-43`); papel e módulo com cache de 5 min; cota de 30 gerações por tenant a cada 30 dias; feriados, só com o ano na requisição; PDF do mapa (`L/compliance-pdf.tsx`) |

O Mapa é o alvo normativo e o código é o estado. Cada linha abaixo é gap.

| ENTIDADE OU COSTURA | ALVO NO MAPA | ESTADO NA MAIN | O QUE TERIA DE MUDAR |
|---|---|---|---|
| Tenant | O Charter é o único emissor de `tenant_id` | `provisionTenant` (`P/tenant.ts:53-63`), chamado pelo back-office (`apps/backoffice/app/actions/provisioning.ts:145-160`) e pelo onboarding do app (`apps/app/app/actions/onboarding.ts:38`) | Emissão de tenant e contrato sob o Charter, com os dois chamadores atuais consumindo |
| Usuário, papel, permissão | Um modelo, do Charter; persona de produto é lente | `MemberRole` e `CustomRole`, `CharterRole`, `MeridianRole`, `ScaffoldRole` e `SignalRole`, cada um com matriz em `R/`; IdP configurado no Cosmos, sem consumidor | Papel e permissão unificados sob o Charter; rever ADR-0002 |
| Política e apetite de risco | Cosmos, Signal, Meridian e back-office leem; violação vira evento no Charter | Leem o Scaffold e o back-office; nenhuma leitura em `app/(cosmos)`, `(signal)` ou `(meridian)`; `posture` não entra em regra; sem evento de violação | Leitura da versão publicada, degradando sem o módulo, como no SG-05; `posture` como entrada de `recommendPath`; canal de violação |
| Todos → Charter · evento de auditoria | Formato único do Charter; cada produto renderiza sua vista | `AuditLog` em `S/system.prisma:81`, escrita por helper de cada produto (`A/_shared.ts:85` e os `_shared.ts` de Meridian, Scaffold e Signal), por `logAudit` (diff como mapa, erro engolido: `apps/app/app/actions/audit/log-audit.ts:14-30`), por `@repo/audit` e por `P/audit.ts` | Formato de evento — ator, momento, entidade, antes e depois, motivo — definido pelo Charter e adotado por todos os escritores |
| Iniciativa (Cosmos) e decisão de valor (Signal) | O Charter lê | Não lê: nenhum acesso a tabela de outro produto em `A/`, `C/` e `L/` (ADR-0001:63-65) | Referência de leitura do caso de uso à iniciativa e leitura da decisão de valor, degradando sem o módulo |

---

## 7. Requisitos não-funcionais

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| NFR-1 | Segurança e multi-tenant | parcial | §4: RLS anulada, SSO e retenção ausentes |
| NFR-2 | WCAG AA nos dois temas, cor nunca sozinha, teclado, ícone com `aria-label`, reduced-motion | parcial | Lint sem isenção de a11y (`docs/design-handoff/charter-prototype/HANDOFF.md:102-105`); heatmap com `aria-label` (`C/parts.tsx:185`); trap de foco e nome acessível de linha (`.claude/completions/2026-09-16-charter-a11y.md`); reduced-motion (`C/charter.css:321`). Falta axe nas rotas (`HANDOFF.md:177-178`) e medição de contraste |
| NFR-3 | Micro < 200 ms, transição ≤ 450 ms, code-splitting por rota, skeleton sem layout shift, lista de casos paginada acima de 200 linhas | parcial | Entrada de 450 ms (`C/charter.css:361`) e skeletons; a lista de casos não pagina nem virtualiza (`A/cases.ts:167-195`); rota única com registry estático (`C/screens/registry.tsx`); nenhum tempo medido |
| NFR-4 | Loading com forma real, vazio com CTA, erro com retry | implementado | `SkeletonKpi`, `SmartEmptyState`, `ScreenError` com "Tentar de novo" (`C/base.tsx:938-999`) |
| NFR-5 | Ator, papel, momento, alvo, diff, justificativa; export reproduzível | implementado | Papel e nome gravados no ato, diff só do que mudou, trilha na transação da escrita (`A/_shared.ts:56-124`); ordem determinística no export (`A/audit.ts:152-178`). A troca de papel grava o id do usuário, não o nome (`A/settings.ts:405`) |
| NFR-6 | pt-BR, strings externalizadas, locale em data e número | parcial | UI e datas em pt-BR; as strings moram no componente, sem `@repo/internationalization` em `C/` |
| NFR-7 | IA: mínimo de dado ao provedor, custo com teto, geração rastreável (do repo, não do SRD & Data Model) | parcial | `sanitizar()` corta cada campo em 200 caracteres (`L/policy-generation.ts:84-93`); provedor checado antes da cota de 30 por mês (`A/policy-generate.ts:25`, `:199-225`); trilha com provedor e fontes. Sem trace de LLM e sem zero-retention confirmado |
| NFR-8 | LGPD: nome de pessoa alcançado pela eliminação de titular (do repo) | ausente | `CharterUseCase.ownerName` fica fora (`docs/compliance/lgpd-ropa-e-lacunas.md:157`); `personName` e `CharterMitigation.ownerName` nem entram na tabela; o nome também vai para o alvo imutável da trilha |

> **CUIDADO COM VALOR PADRÃO**
> Coluna com default que a tela mostra como fato lê como medição: score 50 do
> fornecedor, risco 1 do caso. Onde ninguém mediu, a tela deve dizer "sem
> pontuação", como o Cosmos diz "sem sinal".

---

## 8. Restrições e premissas

- O Charter divide tenant e login com o Cosmos e tem shell próprio; não importa tela nem action de outro produto (ADR-0001:63-65), e o kit visual é a exceção deliberada (ADR-0010).
- Contratar é linha em `TenantModule`, não flag; `SUSPENDED` e `CANCELED` fecham a porta sem apagar evidência (ADR-0001:34-36). Não há job agendado: SLA, atraso e alerta são calculados na leitura (ADR-0011).
- A regra vive em código, não em tabela, e mudar a regra não reescreve caso submetido (ADR-0005). O catálogo de capacidades também: capacidade em banco vira ficção (`L/capabilities.ts:15-16`).
- Feriado é só nacional, porque o schema não modela geografia (`apps/app/lib/feriados/index.ts:9-12`). Versão major é manual (ADR-0007).
- Nenhum cliente usa o Charter ainda: `CHARTER` está `ACTIVE` em 6 tenants e `TRIAL` em 1, todos internos ou de teste, e os 9 casos de uso de produção são do tenant `nebuloz` (banco de produção, consulta de 2026-09-22).
- A primeira conta Compliance nasce no bootstrap, e a pessoa precisa ter entrado uma vez (`P/charter.ts:83-93`). `seed:charter` apaga o tenant e cria contas com senha conhecida; nunca roda em produção (`docs/runbooks/charter-em-producao.md:128-137`).

---

## 9. Critérios de aceite

- Toda action exportada de `A/` chama o guard antes do Prisma. **Atende** por leitura do código; nenhum teste o garante.
- Tenant sem `TenantModule` CHARTER cai em `/charter-indisponivel`, e intake com classe acima do teto não submete e cita o motivo. **Atende** (`apps/app/e2e/charter-default-deny.spec.ts`, `charter-intake.spec.ts`).
- Publicar com seção fora de `PUBLISHED` lista cada seção por nome, e aprovar com restrições sem condição não grava. **Atende** (`apps/app/e2e/charter-policy-publish.spec.ts`, `charter-decision.spec.ts`).
- Escrita cuja entrada de auditoria falha não persiste. **Atende** por construção (`A/_shared.ts:56-71`).
- Conjunto `REFERENCIA` nunca guarda texto de norma. **Atende** (`apps/app/__tests__/charter/licenca-copyright.test.ts`).
- Tenant provisionado pelo back-office submete caso Interno sem SQL nem seed. **Não atende** (§5.4).
- Caso sem pontuação não mostra score. **Não atende** (§5.5).
- `verify:charter` passa sem as duas falhas de `BYPASSRLS`. **Não atende** (ADR-0012).
- axe sem violação nas 11 telas, nos dois temas. **Não existe** o teste.
- Todo escritor de `AuditLog` usa o formato de evento do Charter. **Não atende** (§6.3).

---

*Engineering draft. Documento companheiro: Charter PRD v1.0.*
