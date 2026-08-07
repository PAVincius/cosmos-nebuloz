# Cosmos — Software Requirements Document

> **PRODUCT** Cosmos · **COMPANION** [Cosmos PRD v1.0](./cosmos-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança

Especificação do produto: guard de tenant, matriz de permissão, o contrato
`Result<T>` das server actions, o modelo de dados das quatro altitudes e as
fronteiras com integrações e back-office.

---

## 1. Escopo

Especifica o software de `apps/app`: autenticação e autorização multi-tenant,
as 63 telas do Cosmos e as 12 do Charter atrás de rotas catch-all, os 62 módulos
de server action, o schema de 166 modelos, a derivação de métrica de fluxo, e as
interfaces com Linear, GitHub, Fireflies, Fathom e `@repo/*`.

**Fora de escopo:** provisionamento de tenant e contratação de módulo
(`apps/backoffice`), execução de billing de nuvem (o Cosmos lê e aloca; não
fecha), e o site público (`apps/web`).

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Tenant | Organização cliente; unidade de isolamento de todo dado |
| Módulo | `COSMOS`, `CHARTER` ou `SIGNAL`, com status próprio por tenant |
| Altitude | Portfólio, ART, time ou analytics — nível de decisão do SAFe |
| Papel efetivo | Papel SAFe resolvido para o usuário, opcionalmente por ART |
| Permissão | Unidade da matriz de RBAC; concedida por papel ou papel customizado |
| Derivado | Valor calculado a partir de fato gravado — nunca campo escrito à mão |
| Sem sinal | Categoria de resposta quando falta o fato; distinta de zero |
| Screen | Componente sob `components/cosmos/screens`, resolvido pelo segmento da rota |

---

## 2. Arquitetura

```
┌────────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐
│ Portfolio  │ │   ART    │ │  Time  │ │ Liderança │
└─────┬──────┘ └────┬─────┘ └───┬────┘ └─────┬─────┘
      └─────────────┴───────────┴────────────┘
                          ▼
         ┌──────────────────────────────────┐
         │  /cosmos/[[...seg]]  ·  shell    │  nav · command palette
         └────────────────┬─────────────────┘
                          ▼
         ┌──────────────────────────────────┐
         │        withSecureAction          │  sessão · tenant · papel · permissão
         └────────────────┬─────────────────┘
     ┌─────────┬──────────┼──────────┬─────────────┐
     ▼         ▼          ▼          ▼             ▼
┌─────────┐┌────────┐┌─────────┐┌─────────┐┌──────────────┐
│Portfolio││  ART   ││  Team   ││Analytics││ Integrações  │
│ actions ││actions ││ actions ││ actions ││  + Copilot   │
└────┬────┘└───┬────┘└────┬────┘└────┬────┘└──────┬───────┘
     └─────────┴──────────┼──────────┴────────────┘
                          ▼
            ┌─────────────────────────┐
            │  @repo/database · Prisma│  166 modelos · 87 migrations
            └────────────┬────────────┘
                         ▼
         ┌───────────┬───────────┬───────────┐
         ▼           ▼           ▼           ▼
    PostgreSQL   Liveblocks   Upstash     Sentry
                (presença)    (teto)   (observab.)
```
*FIGURA 1 — TOPOLOGIA. TODA ESCRITA PASSA PELO WRAPPER; TODO `where` CARREGA `tenantId`.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `app/(cosmos)/cosmos/[[...seg]]` | Rota única; resolve o segmento para a screen |
| `components/cosmos/shell.tsx` | Navegação de nove seções e command palette |
| `actions/_base.ts` | `Result<T>`, `safeAction`, paginação, `buildPage` |
| `actions/_withSecureAction.ts` | Sessão + papel efetivo + permissão + auditoria de negativa |
| `@repo/auth/server` | `requireTenantSession`, `requireRole`, `requireMfaForPrivilegedRoles` |
| `@repo/rbac` | Matriz papel × permissão; papéis customizados por tenant |
| `@repo/safe-engine` | WSJF e máquina de confidence vote |
| `@repo/audit` | Trilha append-only |
| `@repo/provisioning` | Consumido pelo back-office; cria tenant e módulo |

> **CONTRATO DE ACTION**
> Toda server action devolve `Result<T>` — `{ ok: true, data }` ou
> `{ ok: false, error, code }`. Exceção não atravessa a fronteira do servidor:
> `safeAction` converte. Uma action que lança expõe stack ao cliente e trata
> erro de negócio como erro de infra, que são coisas diferentes.

---

## 3. Modelo de dados

```
Tenant ──1:N── TenantMember ──(role)── User
  ├──1:N── TenantModule (COSMOS · CHARTER · SIGNAL)
  ├──1:N── CustomRole ──1:N── CustomRoleAssignment
  └──1:N── AuditLog

PORTFÓLIO
StrategicTheme ──1:N── ThemeART        LeanBudget ──1:N── LeanBudgetReallocation
StrategyPillar                          InvestmentHorizon
OKR ──1:N── KeyResult ──1:N── KeyResultSnapshot
RoadmapItem       EpicValueMetric       PortfolioAnalysisReport

ART
ART ──1:N── Team ──1:N── ARTMembership
ART ──1:N── PIPlan ──1:N── PIObjective
                  └──1:N── PIParticipant
Epic ──1:N── Feature ──1:N── Story ──1:N── Task
Risk ──N:M── RiskOKR      DependencyLink      WsjfSettings · ScoringEvent

TIME
Sprint ──1:N── Story · Task · Defect · Impediment
TeamMemberAssignment ──1:N── MemberSprintMetrics
TeamCapacitySnapshot   PairSynergy   GroupSynergy

ANALYTICS
StateTransitionHistory ──▶ FlowMetricSnapshot
AnomalyDetectionRun ──1:N── Anomaly ──N:1── AnomalyRuleConfig
CompetencyAssessment ──1:N── ImprovementAction

INTEGRAÇÕES
LinearSync ──1:N── LinearSyncEvent      GitHubSync ──1:N── GitHubSyncEvent
WebhookEndpoint ──1:N── WebhookDeliveryLog       WebhookDlq
ApiKey ──1:N── ApiKeyUsageLog
MeetingIntegration ──1:N── MeetingTranscript ──1:N── MeetingInsight

FINOPS
BillingEntry ──1:N── BillingEntryAllocation      CostSnapshot · CostAnomaly
TagRule · UnmappedCostBucket · BudgetPlan · PersonCost
```
*FIGURA 2 — 166 MODELOS EM 27 ARQUIVOS PRISMA, AGRUPADOS POR ALTITUDE.*

| ENTIDADE | CAMPOS-CHAVE |
|---|---|
| `TenantMember` | `tenantId`, `userId`, `role` — a chave de todo isolamento |
| `Epic` | `tenantId`, `artId`, `state`, fatores WSJF, `themeId` |
| `Feature` | `tenantId`, `epicId`, `teamId`, `milestone`, `piPlanId` |
| `StateTransitionHistory` | `entityType`, `entityId`, `from`, `to`, `at` — base de todo flow metric |
| `PIObjective` | `plannedValue`, `achievedValue` — previsibilidade sai daqui |
| `AuditLog` | `tenantId`, `actorId`, `actorType`, `action`, `entityType`, `metadata` |
| `LinearSync` / `GitHubSync` | cursor de sync incremental; evento em tabela própria |
| `WebhookDlq` | entrega que falhou, para reprocesso explícito |

**Não existe campo `velocity`, `predictability` nem `flowEfficiency`.** Os três
são derivados de `StateTransitionHistory` e de `Sprint`. A ausência é a
especificação: métrica gravada à mão envelhece no dia em que alguém esquece de
recalcular, e um gráfico afirmando tendência sobre dado velho é pior que gráfico
vazio — ele fundamenta decisão que ninguém tomaria com a tela em branco.

---

## 4. O guard

Todo caminho de escrita passa por `withSecureAction`. O layout protege
navegação; não protege server action.

```
        ┌───────────┐  sem sessão    ┌──────────────┐
        │ requisição│───────────────▶│ UNAUTHORIZED │──▶ /sign-in
        └─────┬─────┘                └──────────────┘
              │ sessão
              ▼
        ┌───────────┐  sem tenant    ┌───────────────────────┐
        │  tenant   │───────────────▶│ NO_ACTIVE_ORGANIZATION│
        │  ativo    │                └───────────────────────┘
        └─────┬─────┘
              │ tenantId
              ▼
        ┌───────────┐  não é membro  ┌───────────┐
        │membership │───────────────▶│ FORBIDDEN │
        └─────┬─────┘                └───────────┘
              │ papel efetivo (opcionalmente por ART)
              ▼
        ┌───────────┐  sem permissão ┌──────────────────┐
        │  matriz   │───────────────▶│ INSUFFICIENT_ROLE│──▶ authz.denied na trilha
        │  + custom │                └──────────────────┘
        └─────┬─────┘
              ▼  SecureActionCtx { userId, tenantId, role }
```
*FIGURA 3 — ORDEM DAS PERGUNTAS. A NEGATIVA TAMBÉM É UM FATO E ENTRA NA TRILHA.*

| ID | REQUISITO DE GUARD |
|---|---|
| CG-01 | Toda server action de escrita usa `withSecureAction`, sem exceção |
| CG-02 | O papel efetivo resolve por ART quando a operação é de ART (`artId`) |
| CG-03 | Papel customizado **amplia**, nunca restringe o que a matriz já concede |
| CG-04 | Negativa de autorização grava `authz.denied` com papel exigido e papel real |
| CG-05 | Falha ao gravar a trilha não converte negativa em permissão |
| CG-06 | `requireMfaForPrivilegedRoles` exige 2FA verificado para `ADMIN` e `STE` (SOC2 CC6.2) |
| CG-07 | `requireRole` roda no servidor; UI escondida não é controle |
| CG-08 | Sessão sem `activeTenantId` resolve pelo primeiro membership e persiste — `P2025` degrada aberto por ser sessão já validada |

> **INVARIANTE CRÍTICA**
> `tenantId` entra no `where` do Prisma, não no filtro da UI e não no `.filter()`
> depois da consulta. Reduzir em memória o que veio de uma amostra paginada é
> defeito de **correção**, não de performance: a tela passa a afirmar o oposto da
> verdade sem erro, sem log e sem métrica.

---

## 5. Derivação de métrica

Nenhum KPI vem de constante. A cadeia é sempre a mesma: fato → transição →
snapshot → tela.

| ID | REQUISITO |
|---|---|
| CM-01 | Toda mudança de estado de `Story`, `Task`, `Feature` e `Epic` grava `StateTransitionHistory` |
| CM-02 | CFD, throughput, aging WIP e lead time derivam **apenas** de transição |
| CM-03 | Previsibilidade de PI deriva de `PIObjective.plannedValue` vs `achievedValue` |
| CM-04 | Velocity deriva de `Sprint` fechado, nunca de campo digitado |
| CM-05 | Ranking WSJF deriva dos fatores BV/TC/RR/CoD; `prev` é o rank anterior real |
| CM-06 | Custo por tema deriva de `BillingEntryAllocation`, não de rateio na UI |
| CM-07 | Sem fato suficiente, a resposta é **sem sinal** — nunca zero, média ou estimativa |
| CM-08 | Agregação roda no banco; nenhuma tela soma coleção paginada em memória |

---

## 6. Interfaces

| INTERFACE | DIREÇÃO | PROPÓSITO |
|---|---|---|
| Linear | In/Out | Import de épico e issue; sync incremental com cursor |
| GitHub | In | PR, deploy e issue; PR sem vínculo vai para `GitHubUnlinkedPR` |
| Fireflies · Fathom | In | Transcrição de reunião → `MeetingInsight` |
| Webhooks de saída | Out | `WebhookEndpoint` com log de entrega e DLQ |
| API keys | In | Acesso programático, com `ApiKeyUsageLog` |
| `@repo/auth` | In | Sessão, papel, SSO, segundo fator |
| `@repo/rbac` | In | Matriz de permissão e papéis customizados |
| `@repo/ai` | Out | SAFe Copilot, com sessão e mensagem persistidas |
| Back-office | In | Provisiona o tenant e o módulo; o Cosmos não se auto-provisiona |
| Liveblocks | Out | Presença e edição concorrente |
| Upstash Redis | Out | Teto por identidade — degrada aberto |

---

## 7. Requisitos não-funcionais

| ID | REQUISITO |
|---|---|
| CN-01 | Toda leitura e escrita escopada por `tenantId` no `where` |
| CN-02 | Segredo de integração (`secretHash`, `secretEnc`, `idp*`) nunca entra em `select` |
| CN-03 | Trilha append-only; nenhuma action chama `update`/`delete` em `AuditLog` |
| CN-04 | Toda lista que cresce com o tenant é paginada (`PaginationSchema`, teto de 100) |
| CN-05 | Agregação no banco para contagem e soma; nada de `length` sobre página |
| CN-06 | Server action devolve `Result<T>`; exceção não atravessa a fronteira |
| CN-07 | Sync de integração é idempotente por chave externa do provedor |
| CN-08 | Entrega de webhook que falha vai para DLQ com reprocesso visível |
| CN-09 | Pool de conexão com `max` e timeout explícitos |
| CN-10 | Headers de segurança herdados de `@repo/next-config` |
| CN-11 | Erro de produção coletado no Sentry, com tenant no escopo |
| CN-12 | Cobertura de teste por domínio: 283 arquivos de teste unitário e 41 specs E2E hoje |

> **CUIDADO COM LEITURA CRUZADA**
> Nenhuma tela do Cosmos lê mais de um tenant. Diferente do back-office, aqui
> **não existe caso legítimo** de leitura cruzada — qualquer consulta sem
> `tenantId` no `where` é defeito, não decisão, e o teste deve tratar assim.

---

## 8. Restrições e premissas

- O produto escala com **atividade do tenant** (transição de estado, entrada de
  billing, evento de sync), não com número de usuários. A otimização segue esse
  eixo: `StateTransitionHistory` e `BillingEntry` são as tabelas que crescem.
- As 63 telas vivem atrás de uma rota catch-all única. Isso barateia navegação e
  encarece regressão: mudança no shell atinge tudo, e é por isso que E2E é por
  área, não por tela.
- Charter tem shell, rota e 18 modelos próprios. Divide tenant e auth com o
  Cosmos; não divide navegação.
- O Cosmos não cria tenant nem contrata módulo. Se o módulo `COSMOS` não está
  ativo, a rota degrada para portão explicativo (`/charter-indisponivel` é o
  equivalente do Charter).
- Papel customizado é aditivo por decisão. Restringir por papel customizado
  criaria dois sistemas de negativa, e o segundo sempre discorda do primeiro.
- Integração pode estar ausente ou fora do ar; a área degrada para estado vazio
  explicativo, nunca para número.

---

## 9. Critérios de aceite

- Nenhum caminho de escrita chega ao Prisma sem passar por `withSecureAction`,
  verificado por teste.
- Nenhuma consulta de tela do Cosmos monta `where` sem `tenantId`, verificado por
  teste — um tenant não lê dado de outro por nenhum caminho de API.
- Nenhum KPI de tela vem de constante no código, verificado por teste.
- Toda linha de lista abre o detalhe correspondente; nenhum clique é decorativo.
- Uma métrica de fluxo sobre dez mil transições responde no mesmo orçamento de
  tempo que sobre cem — porque agrega no banco.
- Um `ADMIN` sem 2FA verificado não executa operação privilegiada.
- Uma negativa de autorização aparece na trilha com papel exigido e papel real.
- Importar o mesmo épico do Linear duas vezes produz um registro, não dois.
- Uma entrega de webhook que falha é visível e reprocessável sem SQL.

---

*Engineering draft. Documento companheiro: Cosmos PRD v1.0.*
