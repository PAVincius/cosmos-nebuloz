# Cosmos — Prontidão para cliente externo

> Auditoria só leitura. Metodologia igual à usada no Charter/Scaffold/Signal
> (`docs/qualidade/gate-maturidade-carga.md`). Checkout desta auditoria:
> `58700ffa` (2026-09-27), 4 commits à frente do deploy de produção verificado
> abaixo (`e2163289`, mesmo dia) — nenhum deles muda regra de governança,
> guard ou métrica do Cosmos (ver §4).

## Veredito: **NÃO APTO**

Falha C1 do gate de maturidade (sem SC formal e sem evidência de E2E verde
recente) e C2 é não avaliado (sem dogfood próprio). C3 é **não aplicável**
(Cosmos não coleta dado de pessoa física de terceiro fora do tenant cliente —
mesmo raciocínio do próprio gate). Diferente do Charter, o Cosmos **não tem
um bloqueador funcional único e óbvio** que impeça uso por cliente pagante —
o guard de tenant, o RBAC e o contrato `Result<T>` estão implementados e
testados; o que falta é **evidência fresca** (E2E nunca reexecutado, PRD sem
SC mensurável) e **fechamento de achados de segurança já diagnosticados**
(parte já corrigida, ver §2).

---

## 1. Gate de maturidade (C1/C2/C3)

Já computado e citado em `docs/qualidade/gate-maturidade-carga.md:30` —
reproduzido aqui, não reavaliado do zero.

| Critério | Resultado | Evidência |
|---|---|---|
| C1 — SC formal + E2E verde | ❌ Não cumprido | `grep -n "Success Criteria\|## SC" docs/produto/cosmos-{prd,srd}.md` → 0 ocorrências (reconfirmado nesta auditoria). E2E existe e é o mais amplo dos 6 produtos — ~30 specs relevantes (`portfolio-budgets`, `portfolio-cache`, `portfolio-governance`, `portfolio-kanban`, `portfolio-okrs`, `portfolio-roadmap`, `portfolio-strategy-map`, `portfolio-tags`, `portfolio-themes`, `portfolio-wsjf`, `art-detail`, `epic-drilldown`, `teams`, `rbac-roles`, `risks`, `dependencies`, `solution-trains`, `workflows`, `integrations`, `copilot`, `bpmn-canvas`, `analytics-dashboards`, `lpm`, `po`, `rte`, `sm`, `devops`, `demo1/2/3-*`, `linear-cosmos-sync`) — mas **sem SC no PRD contra o qual medir "verde"** e **sem execução recente registrada** (ver §3). |
| C2 — Dogfood sem P0/P1 aberto | Não avaliado | `docs/qualidade/dogfood/cosmos/` não existe (só `docs/qualidade/dogfood/meridian/`, confirmado com `ls`). |
| C3 — Compliance | **Não aplicável** | Cosmos é planejamento/execução SAFe sobre dado do próprio tenant (épico, time, portfólio); não coleta dado de pessoa física de terceiro fora da organização cliente — mesmo edge case do `specs/007-gate-maturidade-carga/spec.md`. O parecer de segurança de IA relevante (não é o C3 do gate, mas cobre o Copilot) existe: `docs/compliance/2026-08-06-owasp-llm-top10-cosmos.md` — ver §2. |

### E2E: escritos, amplos, sem corrida registrada para este gate

- 57 arquivos `*.spec.ts` em `apps/app/e2e/`; ~30 tocam telas ou fluxos do
  Cosmos diretamente.
- Nenhum workflow de CI roda Playwright: `.github/workflows/ci.yml` não
  menciona `playwright`/`e2e`; `.github/workflows/dark-matter.yml` só roda
  `pnpm --filter app seed:e2e` (semeia dado, não executa a suíte) — confirmado
  por leitura completa do arquivo nesta auditoria. Mesmo padrão já registrado
  para o Charter.
- Busca em `.claude/completions/*.md` por `"playwright test"` não retornou
  nenhuma corrida citando specs do Cosmos por nome — as três ocorrências que
  existem (`2026-07-30-charter-e2e.md`, `2026-07-28-isolamento-tenant.md`,
  `2026-09-26-login-generico-us3-us4.md`) são de outros produtos/fluxos
  transversais. Não há evidência escrita de quando a suíte do Cosmos rodou
  pela última vez de ponta a ponta.

---

## 2. PRD/SRD × código

O PRD (`cosmos-prd.md`) já registra, na própria seção "Evidência" (§1), três
achados concretos de 2026-07-23: `dashboard.tsx` misturando KPI fabricado com
real, `wsjf.ts` fixando `prev = rank`, e métrica de fluxo dependendo de
`StateTransitionHistory` gravado depois das telas que o leem. Verificado nesta
auditoria:

| Item do PRD/SRD | Estado | Evidência |
|---|---|---|
| `wsjf.ts` `prev = rank` morto | **Corrigido** | `apps/app/app/(cosmos)/actions/wsjf.ts:111-115` — comentário explícito: campo `prev`/`ai` removido da tabela flat de propósito; o delta real vive em `getWsjfRebalancePreview`/`applyWsjfRebalance`, escopado por coluna de ciclo de vida, não fake no ranking global. |
| KPI fabricado ao lado de KPI real | Parcialmente verificado | `KpiCard` (`.claude/completions/2026-09-23-cosmos-lacunas-visuais.md:22`) hoje só aceita número e formata — string verbatim não passa mais por ele; WSJF médio de backlog vazio mostra "—", não "0.0". Não confirmado por varredura própria de `dashboard.tsx` linha a linha nesta auditoria (566 linhas, não lido integralmente) — risco residual de constante em tela não tocada por aquela sessão. |
| Empate "sem sinal" como categoria (CM-07, RESTRIÇÃO DURA §4) | Não verificado por teste automatizado encontrado | A frase existe só em prosa (`DESIGN.md:230,475`); busca por componente dedicado (`SemSinal`/`NoSignal`) não achou nenhum em `.tsx`. Pode estar implementado ad hoc por tela (não descartado), mas nenhum teste evita regressão — diferente da alegação do PRD §6 ("verificado por teste"). |
| `withSecureAction` em toda escrita (CG-01, critério de aceite §9) | Testado | `apps/app/__tests__/rbac/with-secure-action.test.ts`, `apps/app/__tests__/lib/actions/with-secure-action.test.ts`. |
| `tenantId` no `where`, nunca no filtro pós-consulta (CN-01) | Amplamente testado, não 100% | 101 arquivos de teste em `apps/app/__tests__` afirmam `tenantId` no `where`. Não é o mesmo que "toda consulta" — é amostra, não cobertura exaustiva verificada nesta auditoria. |
| CN-12 "283 arquivos de teste unitário e 41 specs E2E hoje" | **Divergente (defasado)** | Contagem real hoje: 462 arquivos `*.test.ts*` em `apps/app` (não 283) e 57 specs E2E (não 41). O SRD subestima a cobertura atual — não é um risco, é um dado desatualizado que vale corrigir no próprio SRD. |
| Copilot: guard de autorização, prompt injection, quota (owasp-llm parecer) | **Maioria corrigida** | Ver tabela abaixo. |

### Segurança do SAFe Copilot — `docs/compliance/2026-08-06-owasp-llm-top10-cosmos.md`

| Achado | Estado hoje | Evidência |
|---|---|---|
| CRÍTICO-1 — guard de VIEWER morto (papel não chega no tool) | **Corrigido** | `apps/app/app/api/copilot/chat/route.ts:126` passa `ctx.role`; `apps/app/app/actions/safe-copilot/tools.ts:4,35` usa `hasPermission(role, "feature:write")` do `@repo/rbac`. |
| ALTO-1 — `role` de mensagem livre (`system` injetável) | **Corrigido** | `apps/app/app/actions/safe-copilot/chat-request.ts` — `PAPEL_DE_MENSAGEM = ["user", "assistant"] as const`, `system`/`tool` excluídos por comentário explícito. |
| ALTO-2 — regras do produto como `role: "user"` | **Corrigido** | `apps/app/app/actions/safe-copilot/prompts/index.ts:260-273` — bloco `system` próprio com `cacheControl: ephemeral` preservado; contexto do tenant desceu para `user` (dado, não instrução). |
| ALTO-3 — array de mensagens sem teto | **Corrigido** | `chat-request.ts` — `MAX_MENSAGENS = 50` com justificativa (quota conta interação, não token). |
| MÉDIO-1 — rate limit falha aberto sem Redis | **Corrigido** | Extraído para `apps/app/app/actions/safe-copilot/rate-limit-gate.ts`; `route.ts:35-44` trata `"indisponivel"` como **503** explícito, não deixa passar em silêncio. |
| MÉDIO-2 — prompt/resposta completos no Langfuse (dado do tenant pra terceiro) | **Parcial** | Subprocessador registrado em `docs/compliance/dpa-fornecedores.md:40,121-137` — mas DPA está **"a assinar"** (linha 40, 381), entidade contratante (Langfuse vs. ClickHouse) ainda em aberto. Fluxo de dado documentado, contrato não fechado. |
| MÉDIO-3 — `packages/ai` sem `server-only` | **Corrigido** | `import "server-only"` presente em `packages/ai/lib/models.ts`, `router.ts`, `langfuse.ts`, `keys.ts`. |
| MÉDIO-4 — back-office sem rate limiting | **Parcial** | `apps/backoffice/lib/rate-limit.ts` existe e é usado em `provisioning.ts:16` (a action mais sensível) — mas não há `middleware.ts`/`proxy.ts` cobrindo o painel inteiro; a recomendação original (teto global) não foi implementada, só a ação mais crítica. |

Nenhum dos itens **CRÍTICO/ALTO** ficou aberto — é a leitura mais favorável
desta auditoria. O que resta é dívida de contrato (MÉDIO-2) e cobertura
parcial de rate limit num produto vizinho (MÉDIO-4), nenhum dos dois
bloqueador para o Cosmos em si.

### Dívidas citadas no próprio parecer, ainda não reavaliadas aqui

- `pnpm audit` na `main`: doc de 2026-08-06 cita 3 críticos/133 altos — não
  re-executado nesta auditoria (só leitura de código); `pnpm-lock.yaml` foi
  tocado por último em 2026-09-27, então o número pode ter mudado para
  melhor ou pior.
- `@repo/safe-engine` com cobertura 72,22% contra piso de 80% — vitest.config
  do pacote declara `80` como threshold (`packages/safe-engine/vitest.config.*`),
  ou seja, o CI deveria falhar se isso ainda for verdade; não executado aqui
  para confirmar se já fecha.

---

## 3. Specs e completions

- **Spec Kit**: Cosmos **não tem pasta própria em `specs/`** (as 11 pastas
  existentes são de outros produtos/iniciativas — Meridian, Scaffold, Signal,
  login, catálogo, conta, gate de carga, Charter). Todo o histórico de
  implementação do Cosmos vive em `.claude/completions/` sem tasks
  rastreáveis formais.
- **Completions relevantes** (`2026-05-31-ux-lab-cosmos.md`,
  `2026-07-19-cosmos-6-screens.md`, `2026-07-19-cosmos-kanban-vertical.md`,
  `2026-09-23-cosmos-lacunas-visuais.md`): nenhuma deixa task explicitamente
  aberta como pendência bloqueante — a mais recente (2026-09-23, design
  visual) lista 4 "achados que ficaram fora" (hover do KPI, decimal com ponto
  fora do padrão em 3 lugares, sidecar `.impeccable/design.json` desatualizado,
  548 `fontSize` literais em telas não tocadas) — tudo cosmético, nada de
  regra de negócio ou segurança.
- **Dogfood**: `docs/qualidade/dogfood/cosmos/` não existe — confirmado.

---

## 4. Produção vs. local

- Deploy de produção Vercel (projeto `cosmos-nebuloz-app`, time
  `team_CjCBX0DGD7HIlBL4MRqQmNzS`): commit **`e2163289`** (PR #273,
  2026-09-27, `docs(runbooks): subir a memória dos agentes pelo Maestri` —
  confirmado via `list_deployments`, `state: READY`, `target: production`).
- Checkout local desta auditoria: `58700ffa`, 4 commits à frente de
  `e2163289` (`git rev-list --left-right --count ground/main...HEAD` → `0 4`
  — nenhum commit exclusivo de `ground/main`; local contém tudo que está em
  produção).
- **Diferença em caminhos do Cosmos entre local e produção: 4 arquivos, ~50
  linhas** — `apps/app/app/(cosmos)/layout.tsx`,
  `apps/app/app/actions/auth/resolve-active-account-destination.ts`,
  `apps/app/app/actions/onboarding.ts`, `apps/app/components/cosmos/shell.tsx`
  — todos da feature transversal de conta ativa (spec 009/010), não de guard,
  RBAC ou métrica do Cosmos.
- **Conclusão**: PRD/SRD descrevem com precisão o que está em produção hoje.
  Working tree local não tem mudanças não commitadas em caminho do Cosmos
  (as modificações do `git status` no início desta sessão são de Charter e
  back-office, fora de escopo).

---

## 5. O que falta — tabela

| Item | Evidência | Dono sugerido | Tamanho |
|---|---|---|---|
| SC formal no PRD (Success Criteria mensurável por altitude — portfólio/ART/time/analytics) | `gate-maturidade-carga.md:30`; grep sem ocorrência em `cosmos-prd.md` | Norte/Regua (spec) | M |
| Reexecutar os ~30 e2e do Cosmos e registrar data/resultado (evidência fresca para C1) | Nenhuma corrida registrada em `.claude/completions/`; sem CI automático (`ci.yml`, `dark-matter.yml`) | dev | M |
| Abrir dogfood do Cosmos (`docs/qualidade/dogfood/cosmos/`) com P0/P1/P2 rastreados, dono e data | Gate C2; sem pasta hoje | dev + Norte | G |
| Fechar DPA do Langfuse (entidade contratante Langfuse vs. ClickHouse) | `dpa-fornecedores.md:40,121-137` — "a assinar" | Lacre/CEO | M |
| Rate limit global no back-office (hoje só `provisioning.ts`) | `owasp-llm-top10-cosmos.md` MÉDIO-4; `apps/backoffice/lib/rate-limit.ts` usado em 1 de N actions sensíveis | dev | M |
| Verificar `pnpm audit` (3 críticos/133 altos em 2026-08-06) contra estado atual | `owasp-llm-top10-cosmos.md:235`; lockfile mudou desde então (2026-09-27) | dev/Infra | P |
| Confirmar cobertura de `@repo/safe-engine` (72,22% citado vs. piso 80% no config) | `owasp-llm-top10-cosmos.md:236`; `packages/safe-engine/vitest.config.*` | dev | P |
| Teste automatizado para "sem sinal nunca vira zero/constante" (CM-07, RESTRIÇÃO DURA §4 do PRD) | Nenhum componente `SemSinal`/`NoSignal` encontrado; alegação de "verificado por teste" não confirmada | dev | M |
| Auditar `dashboard.tsx` linha a linha (566 linhas) por KPI fabricado remanescente | PRD §1 "Evidência" cita o arquivo; sessão de 2026-09-23 corrigiu `KpiCard` mas não confirma varredura completa desta tela | dev | P |
| Corrigir CN-12 do SRD (283/41 → 462/57, contagem real hoje) | Divergência confirmada nesta auditoria | dev/doc | P |

---

## Próximas 3 ações, em ordem

1. **Escrever SC formal no PRD e reexecutar os ~30 e2e existentes com data** —
   fecha C1; a suíte já existe e é a mais ampla dos 6 produtos, só falta o
   critério contra o qual medir e uma corrida recente registrada. *Dono:
   Norte/Regua (SC) + dev (rerun).*
2. **Fechar o DPA do Langfuse** — único item de segurança de dado ainda
   genuinamente aberto (contrato "a assinar"); os 7 achados técnicos do
   OWASP-LLM já foram corrigidos. *Dono: Lacre/CEO.*
3. **Abrir dogfood do Cosmos com P0/P1/P2 rastreados** — fecha C2; sem isso,
   não há como confirmar ausência de bloqueador real antes de expor a um
   cliente pagante, mesmo com o código já testado nesta profundidade.
   *Dono: dev + Norte.*

---

*Auditoria só leitura — nenhum código, schema ou dado de produção foi
alterado. Fontes: `docs/produto/cosmos-{prd,srd}.md`,
`docs/qualidade/gate-maturidade-carga.md`,
`docs/compliance/2026-08-06-owasp-llm-top10-cosmos.md`,
`docs/compliance/dpa-fornecedores.md`, `.claude/completions/*cosmos*`,
`git log`/`git diff` contra o remoto `ground` (produção) e `list_deployments`
via Vercel MCP, sem escrita em banco.*
