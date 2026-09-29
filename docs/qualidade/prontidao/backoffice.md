# Back-office — Prontidão para cliente externo

> Auditoria só leitura. Metodologia igual à usada no Charter/Scaffold/Signal
> (`docs/qualidade/gate-maturidade-carga.md`). Base: PRD/SRD do Back-office v2.0,
> `main` @ `ea512044` (PR #239, 2026-09-22). Produção verificada via Vercel API
> (projeto `cosmos-nebuloz-backoffice`, time `team_CjCBX0DGD7HIlBL4MRqQmNzS`):
> commit **`e2163289`** (PR #273, 2026-09-27), confirmado ancestral de
> `github.com/PAVincius/cosmos-nebuloz` `main` (`55489734`, 2026-09-28) via
> `git merge-base --is-ancestor`. **Achado desta auditoria, diferente do padrão
> visto no Charter:** o PRD/SRD já estão defasados em relação à produção — dois
> itens que documentam como "parcial"/"ausente" (B-20, parte de B-40/BN-06)
> foram corrigidos em produção um dia depois da data do documento (PR #247,
> 2026-09-23, `.claude/completions/2026-09-23-bo-seguranca-quatro-falhas.md`),
> e o próprio documento nunca foi atualizado para refletir isso.

## Veredito: **NÃO APTO**

Falha os três critérios do gate de maturidade (C1 não cumprido; C2 e C3 não
avaliados por falta de dado). O bloqueador mais duro não é um bug: é a
ausência total de rede de segurança automatizada — zero E2E do próprio
back-office, zero teste (dos 1746 que existem) rodando em CI — num painel que
já é produção real com escrita em dado de plataforma (provisionar/suspender
cliente, papel, trilha). Em produção há 7 tenants de cliente, nenhum
identificado como pagante (PRD §1, consulta de banco de 2026-09-22).

---

## 1. Gate de maturidade (C1/C2/C3)

Já computado em `docs/qualidade/gate-maturidade-carga.md:31` — reproduzido e
reverificado nesta auditoria:

| Critério | Resultado | Evidência |
|---|---|---|
| C1 — SC formal + E2E verde | ❌ Não cumprido | Zero ocorrência de "Success Criteria\|## SC" em `backoffice-prd.md`/`backoffice-srd.md` (grep, confirmado nesta auditoria). **Nenhum E2E existe em `apps/backoffice/e2e`** — a pasta só tem `fixtures/staff.ts` (confirmado: `find apps/backoffice -iname "*.spec.ts"` → vazio). O único E2E que toca o back-office mora em `apps/app/e2e/backoffice-charter-provisioning.spec.ts`, e o próprio PRD (B-14) diz que ele "não faz login com 2FA" e "nenhum workflow o roda". |
| C2 — Dogfood sem P0/P1 aberto | Não avaliado | `docs/qualidade/dogfood/` só tem `meridian/` (confirmado: `ls`). Sem pasta própria, não há como confirmar ausência de P0/P1. |
| C3 — Compliance | Não avaliado | `docs/compliance/` não tem nenhum arquivo do back-office (confirmado: `ls docs/compliance \| grep -i backoffice` → vazio). O painel lida com dado comercial de terceiro (leads, contatos de proposta, DPA de fornecedor em Empresa) — PRD §2, linha "Segurança e compliance internos". |

### Testes: existem, não rodam em CI

- **1746 testes unitários** em `apps/backoffice/__tests__` (172 arquivos), última corrida completa registrada em `2026-09-23-bo-seguranca-quatro-falhas.md:39` (1746/1746 passou, local).
- `apps/backoffice/package.json:10` só define `"test": "NODE_ENV=test vitest run"` — **não existe `test:coverage`**.
- `.github/workflows/ci.yml:263` roda só `pnpm turbo test:coverage` — sem script correspondente, o turbo pula o pacote silenciosamente. Não há nenhum outro passo `turbo test` no CI (confirmado: grep em todo `ci.yml`). **Os testes do back-office nunca rodam em pipeline algum.** Isso é o próprio requisito P0 **B-42** do PRD, que o documento já marca "ausente".
- `.github/workflows/dark-matter.yml` só roda `pnpm --filter app seed:e2e` — nenhum `playwright test`.

---

## 2. PRD/SRD × código

O PRD e o SRD (v2.0) já são, eles próprios, uma auditoria linha-a-linha (B-01 a
B-42, BG/BA/BN, todos com estado e evidência `arquivo:linha`). Esta seção não
repete as ~60 linhas de tabela — verifica se o documento ainda bate com o
código de produção e resume o que bloqueia "apto a cliente externo".

### 2.1 O documento está desatualizado em pelo menos 2 pontos

| Item do PRD/SRD | Estado no documento (2026-09-22) | Estado real verificado agora | Evidência |
|---|---|---|---|
| B-20 — "busca por slug não filtra `isSystem`" | parcial (gap citado) | **corrigido** | `app/actions/tenant-members.ts:50` → `where: { slug, isSystem: false }` (comentário na linha 45 confirma a intenção). Commit `a1b7ae09`/PR #247, 2026-09-23 — um dia após a data do PRD. |
| BN-06 — "`registrarAcesso` é action pública sem sessão nem teto" | ausente | **corrigido** (com uma lacuna remanescente, ver abaixo) | `app/actions/access.ts` não exporta mais `registrarAcesso` (comentário `:17-20` documenta a remoção); quem grava é `lib/registro-de-acesso.ts:90-135`, chamado por `app/api/auth/[...all]/route.ts`, com `assertDentroDoLimite("acesso", chave)` (`:112`) e `server-only` (`:1`). |
| B-40 / BN-01 (parte) — "recusa 'não é da equipe' não grava" | ausente/parcial | **ainda ausente** — só a parte de credencial inválida foi corrigida | `lib/staff-access.ts:38-43`: o caso `FORBIDDEN` (staff-check falhou) só devolve mensagem para a tela; não chama `accessLog.create`. `lib/registro-de-acesso.ts` só grava `RECUSADO` para 4xx de `/sign-in/email` (senha errada), não para "autenticou mas não é staff". |
| BN-01 (outra metade) — "`tenantPorSlug` não filtra `isSystem`" | parcial, citando 2 arquivos | **1 de 2 corrigido** | `tenant-members.ts:50` filtra; `app/actions/tenant-observability.ts` **continua sem `isSystem`** (grep confirma zero ocorrência). |

Conclusão: o PRD/SRD são uma boa base, mas **não podem ser lidos como
"correntes"** sem reconferir contra o código — ao contrário do que esta mesma
auditoria confirmou para o Charter. Isso por si é um risco de processo: quem
decidir "apto para vender" lendo só o documento vai errar em ambas as
direções (crédito por B-20/parte de BN-06 que já foi corrigido; e confiança
indevida se assumir que "parcial" cobre só o que está escrito).

### 2.2 O que bloqueia "apto a cliente externo" (do próprio PRD, reverificado)

| Requisito | Estado (reverificado) | O que falta |
|---|---|---|
| B-42 (P0) — testes do painel no CI | ausente, confirmado | Ver §1 — 1746 testes existem, zero rodam em pipeline. Bloqueador direto: qualquer regressão em provisionamento/guard só é pega manualmente. |
| B-32 (P0) — proposta ganha vira cliente sem redigitar | ausente, confirmado | `app/actions/leads.ts:67,142` só *lê* `tenantProvisionadoSlug`; nenhuma action grava `ACEITA`/`RECUSADA`. As 2 propostas em produção seguem `ENVIADA` (PRD §1). Bloqueia o próprio objetivo comercial do painel. |
| B-18 (P1) — prazo vendido vira vigência do módulo | ausente, confirmado | `contractModule` grava `expiresAt`/`seats` nulos (`app/(staff)/clientes/[slug]/module-form.tsx:77-81`). Sem isso, "renova em 60 dias" (critério de sucesso do PRD §6) não pode ser respondido. |
| B-41 (P1) — conceder/revogar staff sem SQL | ausente, confirmado | `packages/database/scripts/grant-staff-admin.sql` existe; concessão não é auditada. "Perder acesso de staff é uma ação, não um chamado" (critério de sucesso do PRD §6) — não atendido. |
| B-12 (P1) — suspender/arquivar/remover cliente sem SQL | ausente, confirmado | `Tenant` sem campo de status (`packages/database/prisma/schema/tenant.prisma:25-41`); remoção é SQL por decisão registrada no runbook, mas o próprio runbook chama isso de dívida. |
| BN-15 (implícito) — RLS efetiva | ausente, confirmado (mesmo padrão do Charter) | Conexão de app é superuser (ADR-0012); isolamento real é só `tenantId` no `where`. Mesmo risco "antes do segundo cliente" já registrado no Charter. |
| BN-07/B-13 — coletor de erro de produção | ausente, confirmado | `next.config.ts:1-7` só liga `withLogging`; sem `instrumentation.ts`. Sem isso, uma falha silenciosa em provisionamento não gera alerta. |
| §9 q.1 (Fechamento da venda) | questão aberta, sem dono nem prazo | Bloqueia B-32; decisão de produto, não de engenharia. |
| §9 q.4 (SQL por decisão ou dívida) | contradição documentada | Menu diz uma coisa (`components/nav.ts:243-245`), runbook diz outra (`docs/runbooks/acesso-ao-backoffice.md:60-64`). Isso é o tipo de inconsistência que trava uma auditoria de compliance externa. |

---

## 3. Specs e completions

- **Spec Kit:** o back-office **não tem pasta própria em `specs/`** (`ls specs/` sem match para backoffice/staff/comercial/venda). Todo o histórico de implementação vive em `.claude/completions/` — **21 arquivos** mencionam back-office (2026-09-02 a 2026-09-27) — e em ADRs (0009, 0012, 0013, 0014, 0017 citados no PRD/SRD), não em specs formais com tasks rastreáveis.
- **Completions relevantes:**
  - `2026-09-23-bo-seguranca-quatro-falhas.md` — 4 correções de segurança (PR #247), com pendências próprias registradas: `packages/auth/auth-events.ts` tem "a mesma classe" de falha do item 2 (ação sem sessão chamada pelo login) e ficou para tarefa separada, ainda sem completion encontrada; TOTP errado "continua sem linha na trilha"; better-auth "sem `rateLimit` explícito".
  - `2026-09-16-plano-piso-zero.md` — plano Diagnóstico inserido direto em produção, "sem script" (citado também no SRD §3). Prática que foge do próprio modelo "sem deploy" que o painel promete.
  - `2026-09-06-*` (funil, telas empresa, catálogo, growth-readiness) e `2026-09-02-scaffold-*` — sistema interno (funil, propostas, financeiro), sem pendência aberta explícita nos próprios arquivos.
- **E2E nunca executado com evidência fresca:** o único E2E que toca o back-office (`apps/app/e2e/backoffice-charter-provisioning.spec.ts`) não tem registro de execução recente encontrado em nenhuma completion, e o PRD já documenta que ele pula 2FA e não roda em CI.
- **Trabalho em disco, não commitado, tocando back-office nesta sessão** (`git status`): `apps/backoffice/app/actions/provisioning.ts`, `apps/backoffice/app/(staff)/clientes/[slug]/charter-bootstrap.tsx`, `apps/backoffice/__tests__/clientes-detalhe-somente-leitura.test.tsx` — fazem parte da spec 011 (bootstrap de cláusulas do Charter), não de um requisito de prontidão do back-office em si; não mudam o veredito.

---

## 4. Produção vs. local

- Deploy de produção (Vercel, projeto `cosmos-nebuloz-backoffice`): commit **`e2163289`**, merge do PR #273 (`claude/great-cori-herb4x`, "docs(runbooks): subir a memória dos agentes pelo Maestri"), 2026-09-27. Confirmado via `mcp__claude_ai_Vercel__list_deployments` (`target: production`, `state: READY`).
- `e2163289` é ancestral confirmado de `github.com/PAVincius/cosmos-nebuloz` `main` (`55489734`, 2026-09-28) — `git merge-base --is-ancestor` após `git fetch` direto do GitHub.
- O checkout local deste andar (Maestri floor, `.git` próprio) tem como base `ground/main` = `b988e762`, que **não é ancestral** de `github.com main` — divergência esperada da arquitetura de andares (o floor só aparece no Ground depois do land). Não afeta a leitura do que está em produção, que veio direto do GitHub.
- **Diferença entre o commit-base do PRD (`ea512044`, 2026-09-22) e a produção atual (`e2163289`, 2026-09-27):** 109 arquivos, 7205 inserções em `apps/backoffice` + 133 arquivos/11157 inserções somando `packages/provisioning` (a maior parte é seed de BPMN/processos, B-37, já "implementado" no PRD). Dentro dessa diferença estão as correções de B-20 e BN-06 detalhadas no §2.1 — **a produção está à frente do que o PRD/SRD descrevem**, não atrás.
- Nenhuma parte dessa diferença fecha C1 (SC/E2E) — as correções são de segurança pontual, não de cobertura de teste ou critério de sucesso formal.

---

## 5. O que falta — tabela

| Item | Evidência | Dono sugerido | Tamanho |
|---|---|---|---|
| Rodar os 1746 testes do back-office em CI (`test:coverage` ou task própria) | `package.json:10` sem script; `ci.yml:263` só roda `turbo test:coverage`, pacote pulado | dev | P |
| Escrever E2E próprio do back-office (login com 2FA, provisionar, contratar módulo) e SC formal no PRD | C1 do gate; `apps/backoffice/e2e` só tem fixture; PRD sem tabela de SC | dev + Norte (SC) | M |
| Atualizar PRD/SRD para refletir B-20 e a parte corrigida de BN-06 (PR #247) | §2.1 desta auditoria | Norte/dev | P |
| Fechar a lacuna de BN-01 em `tenant-observability.ts` (falta `isSystem: false`) | `app/actions/tenant-observability.ts` sem filtro, confirmado | dev | P |
| Gravar `RECUSADO` também para "autenticou mas não é staff" | `lib/staff-access.ts:38-43` não grava `AccessLog` nesse ramo | dev | P |
| Fechamento da venda (B-32): aceite grava `ACEITA`/`RECUSADA` e pré-preenche provisionamento | PRD §9 q.1; `app/actions/leads.ts:67,142` só lê | Norte (decisão) → dev | G |
| Prazo do módulo (`expiresAt`) sobrevive à troca de status (B-18) | `module-form.tsx:77-81`; `packages/provisioning/src/modules.ts:72-77` | dev | M |
| Abrir dogfood do back-office com P0/P1/P2 rastreados | Gate C2; sem pasta hoje | dev + Norte | G |
| Parecer de compliance dedicado (dado comercial de terceiro) | Gate C3; `docs/compliance/` sem arquivo | Lacre | M |
| Conceder/revogar staff sem SQL, com trilha (B-41) | `grant-staff-admin.sql`; sem auditoria | dev/Infra | M |
| `cosmos_app` sem `BYPASSRLS` (mesmo item do Charter) | ADR-0012 | dev/Infra | G (plataforma) |
| Coletor de erro de produção (B-13/BN-07) | `next.config.ts:1-7` sem `instrumentation.ts` | dev | P |
| Resolver a contradição menu × runbook sobre SQL "por decisão" vs. "dívida" (B-12, B-41) | PRD §9 q.4 | CEO/Norte | P (decisão) |

---

## Próximas 3 ações, em ordem

1. **Colocar os 1746 testes existentes para rodar em CI** — é o menor esforço
   com maior redução de risco: a suíte já existe e já passa; falta só o
   script `test:coverage` e o turbo enxergar o pacote. Sem isso, toda
   mudança em guard/provisionamento/trilha é validada só manualmente.
   *Dono: dev.*
2. **Escrever SC formal + E2E próprio do back-office** — fecha C1 do gate;
   hoje o único E2E que toca o painel mora em outro app, pula 2FA e não roda
   em lugar nenhum. *Dono: dev + Norte (SC).*
3. **Atualizar o PRD/SRD para bater com a produção (B-20, parte de BN-06) e
   decidir o fechamento da venda (B-32)** — o documento hoje subestima o que
   já foi corrigido e não decide o que falta para o objetivo comercial
   central ("proposta ganha vira cliente sem redigitar escopo"). *Dono:
   Norte/CEO.*

---

*Auditoria só leitura — nenhum código, schema ou dado de produção foi
alterado. Fontes: `docs/produto/backoffice-{prd,srd}.md`,
`docs/qualidade/gate-maturidade-carga.md`, `.claude/completions/*` (21 arquivos
mencionando back-office), leitura direta de `apps/backoffice/{lib,app}` e
`packages/provisioning/src`, `git log`/`git diff`/`git merge-base` contra
GitHub `main` e Vercel API (`list_deployments`), sem escrita em banco.*
