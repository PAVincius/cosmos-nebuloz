# Charter — handoff de continuação do port de UI

**Estado em 2026-07-29.** Build verde: `tsc` 0 erros, `biome` 0 erros, 31/31 testes.

Este documento existe porque a UI foi construída **na ordem errada** na primeira
tentativa: a partir do `SRD-Charter.md` (que descreve comportamento) em vez do
JSX do protótipo (que define a anatomia visual). O resultado compilava e passava
nos testes, mas não era o produto desenhado. Oito telas já foram refeitas contra
o JSX; duas faltam — e as duas dependem de um JSX que não está neste diretório.

**Regra para quem continuar: abra o JSX do protótipo antes de escrever a tela.**
O SRD diz o que a tela precisa fazer; o JSX diz como ela é.

---

## 1. Como recuperar o protótipo

`charter-screens-3.jsx` está neste diretório. Os outros vêm do projeto de design
via MCP `claude_design` (auth por `/design-login`):

```
projectId: 691f7fe5-e623-458e-aa9f-92b8c46dbbd9
```

| Arquivo | Caminho no projeto | Cobre |
|---|---|---|
| `charter-screens-1.jsx` | `design_handoff_charter/prototype/charter-screens-1.jsx` | Dashboard ✅, Policy ✅ |
| `charter-screens-2.jsx` | `design_handoff_charter/prototype/charter-screens-2.jsx` | Cases ✅, **CaseDetail**, **Risk** |
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

`dashboard.tsx`, `cases.tsx`, `policy.tsx`, `vendors.tsx`, `vendor-detail.tsx`,
`onboarding.tsx`, `audit.tsx`, `settings.tsx` — usar como **referência de
estilo** para as duas restantes.

`BackLink` (em `base.tsx`) é o botão de voltar do protótipo; `case-detail.tsx`
deve usar o mesmo, não reimplementar.

`VendorRow` ganhou `criticalMissing` (cláusulas críticas do tenant ausentes no
fornecedor) — é o que alimenta o KPI e o aviso na linha da lista.

---

## 3. As duas telas que faltam

Ambas compilam e carregam hoje, mas com a estrutura antiga. **As duas dependem
de `charter-screens-2.jsx`, que não está neste diretório** — baixar do projeto
de design antes de começar (§1). O padrão do protótipo, presente em toda tela e
ausente nestas:

1. `PageHeader` com `eyebrow` (contagem + contexto) e `meta` (2–3 `Badge`)
2. Linha de **4 `KpiCard`** logo abaixo, com `SkeletonKpi` no loading
3. Grid assimétrico (`1.5fr 1fr`, `1.1fr 1fr`, `1.3fr 1fr`) — não colunas iguais
4. `SectionCard` com `icon`, `subtitle` e `action` (botão `variant="soft"`)

| Tela | O que falta |
|---|---|
| `case-detail.tsx` | `BackLink`; header com 4 badges; 4 KPIs (risco composto / classe / SLA / mitigações); abas **Visão geral · Risco · Mitigações · Trilha**; `RiskMiniMatrix` (já em `parts.tsx`); card de fornecedor com `Callout` de inelegibilidade; Declaração do caso em 6 `MetaCell` |
| `risk.tsx` | 4 KPIs; `Heatmap` de `parts.tsx`; painel direito que **alterna** entre "Exposição por categoria" e "Casos na célula" conforme a seleção; `MitigationTable` |

---

## 4. Armadilhas já pagas — não repetir

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

## 5. Divergências deliberadas do protótipo

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

## 6. Comandos

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

## 7. Só depois: E2E

Não existe nenhum teste E2E do Charter (`e2e/` não tem spec). **Escrever só
depois das duas telas restantes** — seletores mudariam junto com a estrutura.

Fluxos que valem cobertura, por ordem de valor:

1. **Gate do intake** — classe Restrito + fornecedor de teto Interno deve barrar
   a submissão nomeando o motivo contratual (FR-4.4). Já verificado à mão.
2. **Reavaliação ao vivo** — trocar classe de dado muda caminho, SLA e HITL no
   trilho (FR-4.2)
3. **Bloqueio de publicação** — modal lista bloqueadores por nome (FR-2.3)
4. **Decisão com restrições** — zero condições não submete (FR-6.3)
5. **Default deny** — tenant sem `TenantModule CHARTER` cai em
   `/charter-indisponivel`
