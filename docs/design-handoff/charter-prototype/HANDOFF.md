# Charter — handoff de continuação do port de UI

**Estado em 2026-07-30.** Build verde: `tsc` 0 erros, `biome` 0 erros, 31/31 testes,
`verify:charter` 33/35 (2 falhas de propósito — ADR-0012), 6/6 E2E dos fluxos
prioritários (§6).

Este documento existe porque a UI foi construída **na ordem errada** na primeira
tentativa: a partir do `SRD-Charter.md` (que descreve comportamento) em vez do
JSX do protótipo (que define a anatomia visual). O resultado compilava e passava
nos testes, mas não era o produto desenhado. **As 10 telas já foram refeitas
contra o JSX** — `case-detail.tsx` e `risk.tsx` foram as últimas, portadas contra
`charter-screens-2.jsx` (baixado do projeto de design via MCP `claude_design` e
agora arquivado neste diretório).

**Regra para quem continuar: abra o JSX do protótipo antes de escrever a tela.**
O SRD diz o que a tela precisa fazer; o JSX diz como ela é.

---

## 1. Como recuperar o protótipo

`charter-screens-2.jsx` e `charter-screens-3.jsx` estão neste diretório. Os
outros, se precisar, vêm do projeto de design via MCP `claude_design` (auth por
`/design-login`):

```
projectId: 691f7fe5-e623-458e-aa9f-92b8c46dbbd9
```

| Arquivo | Caminho no projeto | Cobre |
|---|---|---|
| `charter-screens-1.jsx` | `design_handoff_charter/prototype/charter-screens-1.jsx` | Dashboard ✅, Policy ✅ |
| `charter-screens-2.jsx` | *(neste diretório)* | Cases ✅, CaseDetail ✅, Risk ✅ |
| `charter-screens-3.jsx` | *(neste diretório)* | Vendors ✅, VendorDetail ✅, Onboarding ✅, Audit ✅, Settings ✅ |
| `charter-modal.jsx` | `design_handoff_charter/prototype/charter-modal.jsx` | kit de form ✅ (já portado) |
| `charter-data.jsx` | `design_handoff_charter/prototype/charter-data.jsx` | dados de referência (já no seed) |

Docs normativos do mesmo projeto: `SRD-Charter.md`, `DATA-MODEL.md`, `DESIGN.md`.

---

## 2. O que já está pronto

### Camadas fechadas (não mexer sem motivo)

- **Schema + migration** — 15 tabelas, RLS forced + policy em todas
- **Regras de domínio** — `apps/app/lib/charter/rules.ts`, isomórfico, 31 testes
- **Server actions** — `apps/app/app/(charter)/actions/*`
- **RBAC + entitlement** — `packages/rbac`, `apps/app/lib/charter/guards.ts`
- **Seed** — `pnpm --filter app seed:charter` · verificador `verify:charter`
- **ADRs** — `docs/adr/` (12, sendo 7 lacunas de spec)

### Infra de UI (nova, é a fundação do port)

| Arquivo | Contém |
|---|---|
| `components/charter/form-kit.tsx` | `FormField`, `TextInput`, `TextArea`, `Select`, `Segmented`, `RadioCards`, `CheckRow`, `Callout`, `FooterHint`, `Kbd`, `useDirty` |
| `components/charter/modal.tsx` | `ModalProvider`, `useModal`, `ModalShell`, `ModalSplit` — com confirmação de descarte |
| `components/charter/parts.tsx` | `RiskMiniMatrix`, `Heatmap`, `MitigationTable`, `AuditList`, `AUDIT_TYPE_META` |
| `components/charter/modals.tsx` | os 11 modais, fiéis ao protótipo |
| `components/charter/base.tsx` | `Eyebrow`, `BackLink`, `MetaCell`, `Tabs`, `FilterChips`, `Legend`, `BarRow`, `StatusDot`, `TableHead/Row`, `SkeletonCard`, `SmartEmptyState`, `ScreenError` |

### Telas já portadas

`dashboard.tsx`, `cases.tsx`, `case-detail.tsx`, `policy.tsx`, `risk.tsx`,
`vendors.tsx`, `vendor-detail.tsx`, `onboarding.tsx`, `audit.tsx`,
`settings.tsx` — as 10 telas do V1, todas contra o JSX.

`case-detail.tsx` usa `BackLink` (em `base.tsx`) para o botão de voltar,
`RiskMiniMatrix`/`MitigationTable`/`AuditList` de `parts.tsx`, e ganhou
`can.decide` em `getCase()` (mesmo padrão de `PolicyView.can` em `policy.ts`) —
o cliente não pode importar `@repo/rbac`, então o gate do botão "Registrar
decisão" vem resolvido do servidor. `getCase()` também passou a trazer
`vendorCode/vendorCategory/vendorRegion/vendorDpa/vendorRetention` para o card
de Fornecedor — antes só existiam em `getVendor()`.

`risk.tsx` usa o `Heatmap` de `parts.tsx`; o painel direito **alterna** entre
"Exposição por categoria" (padrão) e "Casos na célula" (com seleção), fiel ao
JSX — a versão anterior mostrava as duas coisas sempre e ainda tinha uma tabela
"N casos" e filtro de mitigação que não existem no protótipo; ambos saíram.
`getRiskBoard()` ganhou `dataClass` em cada `cases[]` — faltava para o badge de
classe de dado na lista da célula selecionada.

`VendorRow` ganhou `criticalMissing` (cláusulas críticas do tenant ausentes no
fornecedor) — é o que alimenta o KPI e o aviso na linha da lista.

---

## 3. Armadilhas já pagas — não repetir

**Nunca rodar `biome check --write --unsafe` neste código.** Duas vezes ele
introduziu bug de comportamento:

- trocou `!= null` por `!== null` em `count?: number` → badge renderizava vazio
  para `undefined`. Em `number | null` a troca é segura; em opcional, não.
- removeu `nonce` das deps de `useCharterData` → `reload()` parou de recarregar.
  Há um `biome-ignore` de uma linha protegendo isso. **Não remover.**

**`biome-ignore` só aceita uma linha.** Comentário de continuação com `//`
quebra a diretiva silenciosamente.

**Override de lint do Charter**: `biome.jsonc` tem um bloco para
`apps/app/components/charter/**` espelhando o do Cosmos — mas **sem nenhuma
isenção de a11y**, porque WCAG AA é requisito de contrato (NFR-2). Linha
clicável é `<button>` de verdade, grupo de filtro é `<fieldset>` com `<legend>`.

**Cliente não pode importar `@repo/rbac`** — o barrel puxa módulos `server-only`.
Permissão vem resolvida do servidor (ver `PolicyView.can`).

**Arquivo `"use server"` só exporta função async.** Constantes vão para
`*.constants.ts` — foi o que quebrou a Visão Geral inteira uma vez.

---

## 4. Divergências deliberadas do protótipo

Não "corrigir" sem ler o ADR:

| O quê | Por quê | ADR |
|---|---|---|
| Sem seletor de persona no topbar | Em produção seria escalada de privilégio | [0004](../../adr/0004-seletor-persona-fora-de-producao.md) |
| `maxClass` do fornecedor é derivado, não escolhido | O protótipo escreve à mão; FR-9.3 exige recalcular | [0003](../../adr/0003-derivacao-classe-maxima-fornecedor.md) |
| `GenerateDraftModal` não chama LLM | Falta decisão de provedor/DPA | [0008](../../adr/0008-geracao-rascunho-sem-provedor-llm.md) |
| Toggles de notificação não disparam nada | Job de SLA fora do V1 | [0011](../../adr/0011-notificacoes-e-job-sla-fora-do-v1.md) |
| `vendor-detail` sem "Solicitar cláusulas" / "Anexar contrato" | No protótipo só emitem toast; não há e-mail nem storage por trás. Portar como botão que não faz nada seria feature falsa | — |
| Lista de fornecedores sem coluna de score | O protótipo mostra score só no detalhe; a lista usa situação + cláusula ausente. Rótulo "maior = pior" (FR-8.3) vive no KPI do detalhe | — |
| `onboarding` sem "Reenviar pedido de aceite" | Sem canal de entrega no V1 (ADR-0011). A linha traz "Registrar", que é a ação que existe | [0011](../../adr/0011-notificacoes-e-job-sla-fora-do-v1.md) |
| `audit` sem KPI "tempo para montar pacote" | O protótipo mostra "< 1 min · antes: 3 dias" — número de pitch, não de tenant. No lugar: exportações registradas | — |
| `audit` — "Filtros avançados" abre/fecha a faixa de data + ator | No protótipo o botão é inerte; aqui ele controla os filtros que existem de verdade | — |
| `settings` sem toggles de SSO/MFA/contas de serviço e sem painel de integrações | Nada disso existe no schema nem no V1. O painel da direita explica por que os toggles de notificação não disparam | [0011](../../adr/0011-notificacoes-e-job-sla-fora-do-v1.md) |
| `settings` — campo Organização é somente leitura | Nome do tenant é da plataforma; `updateWorkspace` não o aceita | — |

---

## 5. Comandos

```bash
pnpm --filter app dev              # :3012
pnpm --filter app seed:charter     # tenant medcore
pnpm --filter app verify:charter   # 35 checagens (2 falham de propósito — ADR-0012)
pnpm --filter app test __tests__/charter
npx biome check apps/app/components/charter apps/app/app/\(charter\)
```

**Login** (tenant `medcore`, senha `charter123`):
`marina.alves@vanta.exemplo` (Compliance) · `diego.prado@` (CISO) ·
`ana.beatriz@` (People Ops) · `rafael.lima@` (Requester)

---

## 6. E2E

Os 5 fluxos prioritários estão cobertos, 6/6 testes verdes:

| Spec | Fluxo |
|---|---|
| `e2e/charter-intake.spec.ts` | Gate do intake (FR-4.4) + reavaliação ao vivo (FR-4.2) |
| `e2e/charter-policy-publish.spec.ts` | Bloqueio de publicação por nome (FR-2.3) |
| `e2e/charter-decision.spec.ts` | Decisão com restrições, zero condições não submete (FR-6.3) |
| `e2e/charter-default-deny.spec.ts` | Tenant sem `TenantModule CHARTER` cai em `/charter-indisponivel` |

Personas do Charter (`marina.alves@`/Compliance, `diego.prado@`/Security,
`ana.beatriz@`/HR, `rafael.lima@`/Requester) ganharam sessão própria em
`e2e/setup/auth.setup.ts`, mesmo padrão dos papéis SAFe — `pnpm seed:charter`
roda antes do login e o storageState de cada uma fica em
`e2e/fixtures/charter/{compliance,security,hr,requester}.json` (gitignored).
Rodar: `AUTH_TEST=1 pnpm exec playwright test e2e/charter-*.spec.ts` na
primeira vez (gera as sessões); depois, sem `AUTH_TEST`, reusa o que já está
em `e2e/fixtures/`.

**Armadilha paga**: `IntakeModal` recebe a lista de fornecedores como prop no
momento em que o modal abre — se o teste clica em "Novo caso de uso" antes de
`listVendors()` resolver, o modal congela com o select vazio pro resto do
teste. `page.waitForLoadState("networkidle")` antes de abrir o modal, não
depois.

Ainda fora: a11y (axe) sobre as 10 rotas do Charter, dark e light — mesmo
padrão de `a11y-screens.spec.ts`, não escrito ainda.
