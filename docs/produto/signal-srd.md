# Signal — Software Requirements Document

> **PRODUCT** Signal · **COMPANION** [Signal PRD v1.0](./signal-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança

Guard em cinco portões, motor de cálculo puro, número derivado na leitura, trilha na mesma transação, relatório congelado — e os gaps contra o Mapa de fronteiras.

---

## 1. Escopo

Especifica o Signal em `apps/app`: a rota `/signal/[[...seg]]` com 10 telas
(`components/signal`), 12 arquivos de server action e `_shared.ts`
(`app/(signal)/actions`), o motor puro (`lib/signal`), o schema `signal.prisma`
(18 modelos, 13 enums, migration `20260902090000_signal_measure`), a matriz
(`packages/rbac/src/signal-{matrix,resolve}.ts`) e as costuras com os outros produtos.

**Fora de escopo:** provisionamento e preço (back-office), conectores e o site.

**Referência:** `main` @ `ea512044`. O código entrou em `f63e4991` (PR #182,
2026-09-04); depois, só `c223abe2` tocou esses caminhos, com tipografia. Estado por
requisito: **implementado**, **parcial** ou **ausente**, com arquivo:linha. Caminho sem
pasta raiz é relativo a `apps/app/`; `actions/` abrevia `app/(signal)/actions/`; os
arquivos da spec ficam em `specs/003-signal-measure/`; nome sozinho remete à última citação completa.

**Alvo normativo:** o [Mapa de fronteiras](./mapa-de-fronteiras.md) (Arquitetura
de produto, ago/2026 v1). Nele, o Signal é **APURAR** ("Valeu a pena?") e é dono
de métrica e fórmula, atribuição de ganho, decisão de valor e encerramento de
valor. Onde o código diverge do Mapa, o texto registra **gap** e o que teria de
mudar; onde a spec 003 diverge do código, diz qual vale hoje.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Iniciativa | `SignalInitiative`, código `IN-014`: a unidade medida |
| Baseline | Linha de base versionada; depois de assinada, imutável |
| Observação | Evidência: valor numa janela, com origem rastreável |
| Múltiplo | Retornado ÷ investido da fórmula `ACTIVE` (só uma por iniciativa) |
| Confiança | Soma dos pontos obtidos nos fatores; os pesos somam 100 |
| Veredito | `PROVEN`, `VANITY`, `PROMISE` ou `STOP`, derivado na leitura |
| Sem lastro | ROI sem fórmula ativa ou com confiança zero |

---

## 2. Arquitetura

```text
requisição
   ▼
app/(signal)/layout.tsx ── getShellData() ── guard de navegação
   ▼
/signal/[[...seg]] ── SCREENS[seg[0]], detalhe em seg[1] ── 10 telas
   ▼  server action
signalAction ── requireSignalContext → requireSignalPermission → posse da linha
   ├──▶ lib/signal/* ── motor puro, sem I/O
   └──▶ withTenantDb(ctx.tenantId) ── $transaction + set_config('app.tenant_id')
          ▼
        PostgreSQL · 18 tabelas Signal* com RLS ENABLE + FORCE · AuditLog append-only
Upstash Redis: cache de módulo e papel por 5 min, opcional
```
*FIGURA 1 — TOPOLOGIA. TODA ACTION REPETE O GUARD; TODA ESCRITA GRAVA A TRILHA NA MESMA TRANSAÇÃO.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `app/(signal)/layout.tsx` | `UNAUTHORIZED` → `/sign-in`; `FORBIDDEN` → `/signal-indisponivel` (`:19-35`) |
| `app/(signal)/actions/_shared.ts` | `signalAction`, `logSignalAudit`, `logSignalSystemAudit`, `nextCode`, `buildDiff` |
| `lib/signal/guards.ts` · `errors.ts` | Cinco portões; `SignalRuleError` (422) e `SignalStateConflictError` (409) |
| `components/signal/verdict-badge.tsx` | `ValueReading`: veredito, múltiplo, versão, confiança e adoção num bloco só |

> **CONTRATO DE ACTION**
> Toda action devolve `SignalResult<T>`: `{ ok: true, data }` ou `{ ok: false, error, rule?, blockers?, status? }`
> (`app/(signal)/actions/_shared.ts:22-53`). O `safeAction` do app descartaria `rule` e
> `blockers`. `AuthError` (403) chega à tela só como mensagem, sem `status`.

---

## 3. Modelo de dados

```text
Tenant ─1:N─ SignalInitiative ─1:N─ SignalBaseline ─1:N─ SignalBaselineDimension
   │              ├─1:N─ SignalRoiFormula ─1:N─ SignalRoiEntry · SignalRoiAssumption
   │              ├─1:N─ SignalAdoptionSnapshot · SignalOutcomeSnapshot
   │              ├─1:N─ SignalConfidenceScore ─N:1─ SignalConfidenceRule
   │              ├─1:N─ SignalMetricObservation ─N:1─ SignalMetricMapping
   │              └─1:N─ SignalAlert
   ├─1:N─ SignalConnection ─1:N─ SignalMetricMapping
   ├─1:N─ SignalReportSnapshot · SignalMember · SignalSequence
   └─1:1─ SignalSettings
AuditLog (compartilhado) ← entityType "signal.<entidade>", diff [campo, antes, depois]
```
*FIGURA 2 — 18 MODELOS E 13 ENUMS EM `packages/database/prisma/schema/signal.prisma`. TODA TABELA TEM `tenantId`.*

| ENTIDADE | CAMPOS-CHAVE | NOTA |
|---|---|---|
| `SignalInitiative` | `code`, `status`, `ownerId`, `hypothesis`, `businessUnit`, `category`, `closureReason` | `businessUnit` é texto livre |
| `SignalBaseline` · `…Dimension` | `version`, `signedAt`; `key`, `value` (texto), `numericValue`, `sourceLabel` | assinado = imutável |
| `SignalConnection` | `kind` (texto), `config` (Json), `health`, `lastSyncAt`, `expectedFreqMinutes`, `errorMessage`, `impactNote` | nenhuma action grava `config` |
| `SignalMetricMapping` · `…Observation` | `(code, version)`, `transform`, `state`; `mappingId` ou `recordedById`, `flag`, `frozenAt` | observação não tem update |
| `SignalRoiFormula` · `…Entry` · `…Assumption` | `version`, `state`; `kind`, `total`, `sourceLabel`; `note` obrigatória | sem coluna de total |
| `SignalAdoptionSnapshot` · `SignalOutcomeSnapshot` | `activeUsers`, `licensedUsers`; `baselineValue`, `currentValue`, `direction` | nenhuma action grava |
| `SignalConfidenceRule` · `…Score` | `weight` (Σ = 100); `got`, `note` | score não é coluna |
| `SignalAlert` · `SignalReportSnapshot` | `kind`, `what`, `nextStep`, `ownerId`; `state`, `payload`, `blockedReason` | `FINAL` ⇒ `payload` fixo |
| `SignalMember` · `SignalSettings` · `SignalSequence` | `role`; réguas 60 · 1,5 · 40 · 8 · 1,0 · 48 h · `BRL`; `next` | uma linha de settings por tenant |

**Não existe coluna `invested`, `returned`, `multiple`, `score`, `pct` nem
`verdict`** (`signal.prisma:4-22`). O protótipo guardava total ao lado das partes,
e 2 de 8 iniciativas não fechavam — a IN-014 com score 86 contra fatores somando
93 (`specs/003-signal-measure/data-model.md:114`). Congelam só o baseline
assinado, a versão de fórmula e o `payload` do relatório; `SignalConnection.health`
é a única desnormalização, recalculada por `recomputeHealth`.

- **Spec × código.** O `data-model.md` fala em 15 entidades e 11 enums; vale o schema, com 18 e 13.
  O `integrations-vault` que o schema cita não existe (`specs/003-signal-measure/tasks.md:165-166`).
- **Gaps contra o Mapa.** Quatro modelos ocupam entidade de outro dono: `SignalInitiative` e
  `businessUnit` (Cosmos), `SignalBaseline` (Scaffold), confiança com faixas próprias (Meridian) e
  `SignalMember` (Charter). Para fechar: chave para o nó do Cosmos, referência imutável ao baseline
  importado, selo do Meridian por ganho e papel lido do Charter. E faltam modelos para o núcleo do
  Signal: decisão de valor, atribuição com contrafactual e encerramento de benefício.

---

## 4. O guard

```text
requisição ── sem sessão ─────────────────────────────────────▶ UNAUTHORIZED → /sign-in
 ▼ requireTenantSession ── tenantId da sessão, nunca do body
 ▼ requireModule("SIGNAL") ── sem TenantModule ACTIVE ou TRIAL vigente ──▶ FORBIDDEN
 ▼ getSignalRole ── sem SignalMember ──▶ FORBIDDEN, "peça a um administrador"
 ▼ requireSignalPermission ── papel não concede ──▶ FORBIDDEN, com quem concede
 ▼ requireInitiativeOwnership ── OWNER em iniciativa alheia ──▶ FORBIDDEN
 ▼ withTenantDb(ctx.tenantId)
```
*FIGURA 3 — ORDEM DOS PORTÕES (`lib/signal/guards.ts:19-120`). MÓDULO E PAPEL TÊM CACHE DE 5 MIN; O QUINTO PORTÃO DEPENDE DA LINHA.*

| ID | REQUISITO DE GUARD | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SG-01 | Toda action repete o guard; o layout só protege navegação | implementado | as 38 actions exportadas dos 12 arquivos abrem com `requireSignalContext` ou `requireSignalPermissionContext` |
| SG-02 | Módulo SIGNAL em `ACTIVE` ou `TRIAL`, com `expiresAt` vigente, e `SignalMember` — admin do tenant não herda | implementado | `packages/rbac/src/modules.ts:13-33`; `lib/signal/guards.ts:60-76` |
| SG-03 | Matriz sem curinga; negativa diz o que falta e quem concede | implementado | `packages/rbac/src/signal-matrix.ts:83-157` |
| SG-04 | Dono de iniciativa só escreve nas próprias | implementado | `guards.ts:100-120`, chamado em `actions/initiatives.ts:548`, `:707`; `actions/baseline.ts:130`, `:218`; `actions/evidence.ts:205` |
| SG-05 | Encerrar exige `signal.initiative.close`; cancelar, só `signal.initiative.write` | implementado | `actions/initiatives.ts:688-692`; o contrato só cita encerrar |
| SG-06 | Código de outro tenant responde "não encontrado" (422), nunca "sem permissão" | implementado | `initiatives.ts:475-482` |
| SG-07 | Troca de papel vale na requisição seguinte | ausente | `invalidateSignalRoleCache` sem chamador (`packages/rbac/src/signal-resolve.ts:12`, `:49-58`) |
| SG-08 | Papel e permissão vêm do Charter; persona é lente (Mapa) | ausente | **Gap.** `SignalRole` é ortogonal ao `MemberRole` (`signal.prisma:107-119`). Para fechar: o terceiro portão resolve o papel pelo Charter e a matriz do Signal vira lente sobre ele |

| PERMISSÃO | VIEWER | OWNER | ANALYST | ADMIN |
|---|:-:|:-:|:-:|:-:|
| `signal.read` | ✓ | ✓ | ✓ | ✓ |
| `signal.initiative.write` · `baseline.write` · `evidence.write` | | próprias | ✓ | ✓ |
| `signal.mapping.write` · `formula.write` · `alert.write` · `report.write` | | | ✓ | ✓ |
| `signal.initiative.close` · `report.freeze` · `connection.write` · `settings.write` · `member.write` | | | | ✓ |

A matriz do código é a do contrato (`contracts/server-actions.md:160-178`);
`formula.write` também cobre pontuar confiança, e `settings.write`, os pesos.

> **INVARIANTE CRÍTICA**
> O `tenantId` vem da sessão e entra no `where` e no `set_config` da transação
> (`packages/database/tenant-db.ts:20-33`). Em dev a RLS não é exercida: o app
> conecta como superuser com `BYPASSRLS` (`.claude/completions/2026-09-02-signal-fundacao.md:55-63`).
> Um vazamento na aplicação só seria barrado em produção, se lá o papel não ignorar RLS — não verificado.

---

## 5. Derivação de ROI e confiança

Todo número de tela sai de `lib/signal/*`: funções puras, chamadas na leitura,
com as réguas do tenant (sem `SignalSettings`, 60% e 1,5×).

> **INVARIANTE**
> ROI nunca sem versão da fórmula e confiança.

```text
ROI — lib/signal/roi.ts:57-98 · entradas da fórmula ACTIVE
  returned = Σ total das entradas RETURN        invested = Σ total das entradas COST
  multiple = returned ÷ invested se invested > 0; null ("—") se só há retorno; 0 se não há nada
  net      = returned − invested
  share(e) = e.total ÷ Σ do lado de e (0 se o lado soma 0)
  portfólio = Σ returned ÷ Σ invested das iniciativas ACTIVE, mesmas regras
Adoção — lib/signal/adoption.ts:31-73 · snapshot mais recente
  pct = activeUsers ÷ licensedUsers × 100 (0 se licensedUsers ≤ 0)
  deltaPoints = pct − pct do snapshot anterior (null com menos de 2)
Resultado — lib/signal/outcome.ts:40-115 · snapshot mais recente
  deltaPct = (atual − base) ÷ base × 100 (null sem número ou com base 0)
  melhora = −deltaPct se LOWER_IS_BETTER, senão deltaPct
  tom = neutro se null · vermelho se ≤ 0 · âmbar se < 10 · verde se ≥ 10
Confiança — lib/signal/confidence.ts:42-139
  exige Σ weight = 100 e 0 ≤ got ≤ weight (senão ConfidenceConfigError)
  score = Σ got · faixa = Alta ≥ 80 · Média ≥ 65 · Baixa > 0 · Sem dado = 0
  catálogo padrão: baseline.signed 30 · sources.fresh 25 · formula.reviewed 20 · sample.size 25
Veredito — lib/signal/verdict.ts:75-85 · valores crus, nunca arredondados
  usa = pct ≥ adoptionBar · rende = multiple ≠ null e multiple ≥ valueBar
  PROVEN = usa e rende · VANITY = usa sem render · PROMISE = rende sem uso · STOP = nenhum
  valor em risco = Σ invested das iniciativas VANITY ou STOP (lib/signal/portfolio.ts:128-133)
Alertas — lib/signal/alerts.ts:94-181 · só ACTIVE · disparo manual
  LOW   = snapshots cobrem as últimas lowAdoptionWeeks semanas, todos com pct < lowAdoptionPct
  WEAK  = pct mais recente ≥ adoptionBar e multiple ≠ null e multiple < weakRoi
  STALE = alguma fonte mapeada com health ≠ HEALTHY
  ordem WEAK, LOW, STALE; tipo já aberto não duplica; o que deixou de valer o sistema resolve
Saúde — lib/signal/health.ts:35-109
  errorMessage → DOWN · manual → HEALTHY · nunca sincronizou ou > staleHours → STALE · senão HEALTHY
  mapeamento: REVIEW humano vence · DOWN → BROKEN · STALE → STALE · senão ACTIVE
Congelamento — lib/signal/report-payload.ts:91-192
  bloqueia com fonte DOWN citada por evidência · páginas = 1 + max(1, ⌈iniciativas ÷ 6⌉)
```

Os pontos obtidos (`got`) entram à mão por `setConfidenceScores`, sem tela
(`actions/confidence.ts:148-218`). A migration semeia o catálogo só para quem já
tinha `SIGNAL` (`packages/database/prisma/migrations/20260902090000_signal_measure/migration.sql:713-742`);
os demais veem o padrão e o gravam no primeiro salvamento (`actions/confidence.ts:220-255`, `:281-308`).

**Como a invariante é garantida.** `ValueReading` recebe múltiplo, versão e
confiança juntos; sem fórmula ou com score 0, o múltiplo sai tachado com "sem
lastro" (`components/signal/verdict-badge.tsx:44-126`). A linha do relatório leva
os três, com múltiplo nulo sem fórmula ativa (`lib/signal/report-payload.ts:29-48`;
`app/(signal)/actions/reports.ts:145-150`). **Onde falha:** o card do sidebar
(`components/signal/shell.tsx:350`), a visão geral (`components/signal/screens/overview.tsx:62`,
`:226`, `:291`) e a matriz (`components/signal/matrix.tsx:172-181`) mostram múltiplo sem versão
nem confiança.

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SD-01 | Nenhum total vira coluna | implementado | `signal.prisma:4-22` |
| SD-02 | Múltiplo sem custo é "—", nunca "0,0×"; fórmula sem componente de custo é recusada | implementado | `lib/signal/roi.ts:111-118`; `app/(signal)/actions/roi.ts:149-154` |
| SD-03 | Versionar fórmula exige baseline assinado; a anterior vira `SUPERSEDED` na mesma transação | implementado | `actions/roi.ts:137-201` |
| SD-04 | Toda superfície com múltiplo mostra versão e confiança | parcial | ver "Onde falha" acima |
| SD-05 | Réguas do tenant em toda leitura, nunca constante local | implementado | `actions/initiatives.ts:115-123`; `actions/shell.ts:134-139` |
| SD-06 | Confiança reage à queda de fonte | ausente | a propagação não toca `SignalConfidenceScore` (`actions/connections.ts:198-251`); `evaluateConfidence` do contrato não existe |
| SD-07 | Iniciativa sem fórmula não é acusada | parcial | os alertas tratam como nulo (`actions/alerts.ts:165-168`); o veredito não: `computeRoi([])` dá 0 e cai abaixo da régua (`lib/signal/roi.ts:66-68`; `lib/signal/verdict.ts:80`) |
| SD-08 | Selo Medido, Estimado ou Declarado do Meridian por ganho, até o relatório (Mapa) | ausente | **Gap.** Faixas próprias Alta, Média, Baixa (`lib/signal/confidence.ts:32-53`), que o Meridian declara que o Signal não deve criar (`components/meridian/seams.tsx:15-22`). Para fechar: selo do Meridian em cada componente de ganho, propagado ao relatório |
| SD-09 | Fórmula governada: dono por métrica, retroatividade declarada, política de lacuna (Mapa) | parcial | `note` e `changedById` por versão (`signal.prisma:361-381`); sem dono por métrica nem retroatividade; lacuna é regra fixa (`report-payload.ts:117-122`) |
| SD-10 | Atribuição de ganho com fator e contrafactual (Mapa) | ausente | nenhum modelo; o desconto de atribuição só existe como texto (`data-model.md:114`) |

---

## 6. Interfaces

| INTERFACE | DIREÇÃO | O QUE PASSA | ESTADO |
|---|---|---|---|
| Scaffold → Signal (costura 1) | In | Baseline `nebuloz.signal.baseline/2`, idempotente por `content_hash` | ausente — **gap**: sem importador; o Signal cria baseline próprio. Para fechar: consumir o artefato e mostrar "aguardando promessa" sem ele |
| Cosmos → Signal (costura 2) | In | Árvore de portfólio, identidade, dono, status, custo planejado | ausente — **gap**: `SignalInitiative` sem chave para `Epic` ou `StrategicTheme`. Para fechar: pendurar valor no nó do Cosmos; status só por recomendação |
| Signal → Cosmos (costura 3) | Out | Recomendação com evidência, dono, prazo e selo; entrada do WSJF | ausente — veredito e ação sugerida não saem do Signal |
| Meridian → Signal (costura 4) | In | Escala Medido, Estimado, Declarado | ausente — **gap** (SD-08) |
| Signal → Scaffold (costura 5) | Out | Benefício final, variância, lição | ausente |
| Signal → Charter (costura 6) | Out | Ator, momento, entidade, antes/depois, motivo | implementado — `AuditLog` compartilhado, no formato do escritor do Charter (`app/(charter)/actions/_shared.ts:85-99`) |
| Meridian → Signal (avaliação, gap) | In | Avaliação de origem; gap promovido a `SIGNAL` | ausente — `targetEntityId` nulo (`packages/database/prisma/schema/meridian.prisma:101-104`) |
| Back-office · `@repo/provisioning` | In | `TenantModule{SIGNAL}` | parcial — não cria `SignalMember` nem `SignalSettings` (`packages/provisioning/src/modules.ts:52-60`) |
| `@repo/auth` · `@repo/rbac` · `@repo/database` · Upstash | In | Sessão, módulo, papel, `withTenantDb`; cache de 5 min | implementado; sem Redis, consulta direta |
| Fontes de dado | In | Sync, observação, adoção, resultado | ausente — `recordSync` só manual; sem webhook (`specs/003-signal-measure/plan.md:37`) |
| Export de relatório | Out | Payload congelado | parcial — JSON no navegador (`components/signal/screens/reports.tsx:139-153`); o contrato previa `{ url }` e PDF |

---

## 7. Requisitos não-funcionais

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SN-01 | `tenantId` da sessão em todo `where` | implementado | `withTenantDb(ctx.tenantId)` em toda action |
| SN-02 | RLS `ENABLE` + `FORCE`, com `USING` e `WITH CHECK`, nas 18 tabelas | implementado | `packages/database/prisma/migrations/20260902090000_signal_measure/migration.sql:679-710`; não exercida em dev |
| SN-03 | Trilha append-only na transação da escrita; se a trilha falha, a escrita falha | implementado | `app/(signal)/actions/_shared.ts:98-131`; trigger em `AuditLog`; rascunho de baseline sobrescrito não gera entrada (`actions/baseline.ts:137-162`) |
| SN-04 | Código legível atômico, sem queimar número em falha | implementado | `actions/_shared.ts:217-237` |
| SN-05 | Nenhum segredo em `SignalConnection.config` | implementado | por ausência: nenhuma action grava `config` (`actions/connections.ts:34-42`) |
| SN-06 | Visão geral abaixo de 1,5 s no p95 com 50 iniciativas; detalhe abaixo de 1 s | ausente | nunca medido (`specs/003-signal-measure/tasks.md:233`) |
| SN-07 | Cobertura de 80% ou mais | parcial | linhas 88,0%; funções 79,4%; branches 77,9% (`tasks.md:232`) |
| SN-08 | Piso de acessibilidade: skip link, 44 px, foco, contraste, movimento | implementado | `components/signal/signal.css:411`, `:594-640`; `shell.tsx:537`; axe não executado |
| SN-09 | Dicionário pronto para en-US | ausente | nenhum `SG_DICT`; textos fixos em PT-BR |
| SN-10 | Moeda da configuração em todo valor | parcial | `fmtBRL` fixa "R$" (`lib/signal/roi.ts:101-109`) |
| SN-11 | STALE dispara sem ação humana | ausente | nenhum job; só `recordSync`, `recomputeHealth` e `evaluateAlerts` manuais |

> **CUIDADO COM O TESTE VERDE**
> Os 416 testes passam, mas nenhum dos 14 arquivos de `__tests__/signal/integration`
> toca banco real: 12 trocam `withTenantDb` por mock (ex.: `reports.test.ts:12-21`),
> os outros dois mockam auth, RBAC e Prisma. Nenhum exercita transação, rollback
> ou RLS. Os E2E dependem do seed e pulam sem ele (`e2e/signal-journey.spec.ts:25`).

---

## 8. Restrições e premissas

- **Ingestão manual.** Sem agendador nem webhook, saúde e alertas só mudam quando
  alguém chama a action (`actions/connections.ts:291-487`; `actions/alerts.ts:288-363`).
- **Evidência não alimenta cálculo.** Adoção, resultado e ROI leem outras
  tabelas; o detalhe só conta observações (`actions/initiatives.ts:340`).
- **Período do relatório é rótulo.** O payload leva todas as iniciativas `ACTIVE`
  e `CLOSED`, sem filtro de período nem lista; `EXECUTIVE` e `PORTFOLIO` saem
  iguais (`actions/reports.ts:176-189`). O contrato previa `initiativeCodes[]`.
- **[inferido] O motivo de bloqueio não persiste.** O `update` de `blockedReason`
  roda na transação que o `throw` seguinte desfaz (`actions/reports.ts:335-347`).
- **[inferido] Mudar pesos pode quebrar a leitura.** Se um `got` gravado passar do
  novo peso, `computeConfidence` lança, e lista e detalhe não capturam
  (`actions/confidence.ts:235-242`; `actions/initiatives.ts:183-191`, `:379-387`).
- **[inferido] A casca quebra com `SCAFFOLD` contratado.** `MODULE_META` só conhece
  quatro módulos (`components/signal/shell.tsx:36-64`, `:462-489`). Não reproduzido.
- **Nenhuma action cria** `SignalMember` nem snapshot de adoção ou resultado (`SignalSettings` nasce ao salvar as réguas,
  `actions/settings.ts:154-158`). Só o seed monta um tenant usável (`packages/database/seed-signal.ts:1800-1937`).
- **Acoplamento de UI.** `signal.css` é a quarta cópia de `meridian.css`, dívida
  registrada (`components/signal/signal.css:1-14`); `components/signal/base.tsx:10-65` reexporta o Charter.
  Nenhum SDK de LLM em `app/(signal)`, `lib/signal` ou `components/signal`.
- **Ainda dizem que o Signal não existe:** `/produto` (`app/actions/produtos/index.ts:52-74`, com teste),
  `lib/scaffold/signal-export.ts:6-9`, `packages/database/prisma/schema/scaffold.prisma:553-555`,
  `meridian.prisma:101-104` e o [Back-office SRD](./backoffice-srd.md) §6.

---

## 9. Critérios de aceite

Critérios 1 a 8 vêm da spec (`specs/003-signal-measure/spec.md:142-151`); M1 a M3, do Mapa.

| # | CRITÉRIO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| 1 | Com `SIGNAL` e papel, `/signal` abre; sem módulo ou sem papel, cai em `/signal-indisponivel` | implementado | `app/(signal)/layout.tsx:21-33`; E2E não executado |
| 2 | Criar → assinar baseline → conectar → mapear → observar → detalhe coerente | parcial | pela UI para em "conectar"; adoção e resultado não têm action |
| 3 | Nenhuma tela mostra múltiplo sem versão da fórmula e confiança | parcial | SD-04 |
| 4 | Fonte caída: mapeamento `BROKEN`, evidência com ressalva, alerta `STALE`, confiança cai | parcial | os três primeiros (`actions/connections.ts:198-364`), o alerta só se a fonte estava `HEALTHY` (`:343-345`); a confiança não (SD-06) |
| 5 | Relatório congelado não muda com a fonte nem com a fórmula | implementado | `actions/reports.ts:308-414` |
| 6 | Mudança de baseline, fórmula, papel e status na trilha com de → para e autor | implementado | SN-03 |
| 7 | Nenhuma query cruza tenant; toda action repete o guard | implementado | SG-01, SN-01, SN-02; RLS não exercida em dev |
| 8 | Lint, cobertura de 80% e build verdes | parcial | funções e branches abaixo de 80%; `pnpm check` e `pnpm build` do monorepo falhavam por causas externas (`tasks.md:236-239`) |
| M1 | Sem baseline do Scaffold, "aguardando promessa", nunca zero | ausente | gap da costura 1 |
| M2 | Valor pendurado na iniciativa do Cosmos; o Signal só recomenda status | ausente | gap da costura 2 |
| M3 | Confiança na escala do Meridian em toda superfície e no relatório | ausente | SD-08 |

---

*Engineering draft. Documento companheiro: Signal PRD v1.0.*
