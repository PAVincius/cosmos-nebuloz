# Charter — painéis estáticos, skeletons e barrel (crítica de design, onda 5a)

**Data:** 2026-09-16/17 · **Branch:** `fix/charter-paineis-e-estados` · **PR:** ver descrição

Origem: crítica de design do módulo Charter. Decisão da onda 5: painéis
explicativos estáticos **colapsam** em telas de operação e ficam abertos em
política/conformidade (fora desta branch). Modo Operate — refinamento
preserva copy e tudo fora da lista.

Sessão caiu por infra no meio da execução; retomada continuou do estado
salvo em disco (working tree + commits já feitos), verificando cada pedaço
antes de aceitar como pronto.

## Item 1 — varredura de painéis estáticos (`185bb56f`)

Leitura de todo `SectionCard` em `dashboard.tsx`, `cases.tsx`, `vendors.tsx`,
`risk.tsx`, `vendor-detail.tsx` e `settings.tsx`, checando se o conteúdo tem
binding de dado (`.map` sobre `data.*`, `value={...}` de estado) ou é prosa
fixa.

| Painel | Tela:linha | Colapsado/mantido | Por quê |
|---|---|---|---|
| "Entrega ainda não ligada" | `settings.tsx:632` | **Colapsado** (`DisclosurePanel`) | Prosa fixa sobre ADR-0011 (notificações/SLA fora do V1) — nenhum valor de `data` |
| Fila de revisão / Saúde da política | `dashboard.tsx:323,486` | Mantido (`SectionCard`) | `.map` sobre `data.queue` / `data.policy.sections` |
| Exposição por categoria / Alertas | `dashboard.tsx:591,633` | Mantido | `.map` sobre `data.categoryExposure` / `data.alerts` |
| Registro de casos | `cases.tsx:239` | Mantido | `.map` sobre `rows` |
| Registro de fornecedores | `vendors.tsx:225` | Mantido | `.map` sobre `rows` |
| Mapa de calor / Exposição por categoria | `risk.tsx:180,218` | Mantido | `Heatmap`/`.map` sobre `data.heatmap`/`data.categories` |
| Rastreador de mitigações | `risk.tsx:318` | Mantido | `MitigationTable` sobre `mitigations` |
| Cláusulas exigidas / Postura contratual / Casos vinculados | `vendor-detail.tsx:290,367,417` | Mantido | `.map` sobre `data.library`/`POSTURE_CELLS(data)`/`data.linkedCases` |
| Perfil organizacional / Dados e retenção | `settings.tsx:120,186` | Mantido | formulário com `value={v.*}` |
| Matriz de permissões / Membros / Sem papel | `settings.tsx:262,408,492` | Mantido | `.map` sobre `data.permissions`/`data.members`/`data.unassignedMembers` |
| Eventos notificados | `settings.tsx:578` | Mantido | `.map` sobre `data.notifications` |

Único achado nas seis telas: o painel de settings. `audit.tsx` e
`onboarding.tsx` já tinham sido resolvidos no commit anterior (`c293917a`).
Teste: `settings-screen.test.tsx` — painel "Entrega ainda não ligada" nasce
com `aria-expanded="false"`.

## Item 2 — skeletons (`ed5ae905`)

`settings.tsx:65` e `vendor-detail.tsx:490` eram um retângulo genérico único
(`<div className="skeleton" style={{height: ..., borderRadius: 14}} />`) no
estado de loading — sem a forma do skeleton do resto do produto. Trocados
por `<div className="fade-in"><SkeletonCard /></div>`, mesmo idioma de
`policy.tsx` e `case-detail.tsx` (não tocados).

Testes: `settings-screen.test.tsx` e `vendor-detail-screen.test.tsx` —
com o fetch nunca resolvendo, o container não tem `[style*="height: ...px"]`
e tem mais de um `.skeleton`.

## Item 3 — KPI `hint` de casos vinculados (`ed5ae905`)

`vendor-detail.tsx` juntava todos os códigos de caso vinculado no `hint` do
KpiCard "Casos de uso vinculados" com `.join(" · ")` — com muitos casos
(ex.: 12) o card estoura. `linkedCasesHint` trunca em 3 códigos +
`"e mais N"`; o total continua no `value` do card (não se perde).

Teste (`vendor-detail-screen.test.tsx`): fornecedor com 12 casos vinculados
→ `hint` não contém `"UC-004"` e contém `"e mais 9"`. Mutação (remover o
truncamento, voltar ao `.join(" · ")` puro) derruba o teste: sem o limite,
`findByText(/e mais 9/)` nunca aparece → timeout, teste falha. Confirmado
manualmente restaurando a linha antiga e rodando o arquivo isolado.

## Item 4 — barrel (`f368c93a`, mais `vendor-detail.tsx` em `ed5ae905`)

Sete telas (`audit`, `case-detail`, `dashboard`, `onboarding`, `risk`,
`vendor-detail`, `vendors`) importavam modais do barrel transitório
`../modals`. `audit.tsx` e `onboarding.tsx` já importavam direto (trabalho
anterior). As outras cinco passam a importar de `../modals/<arquivo>`:

| Tela | Import antes | Import depois |
|---|---|---|
| `vendor-detail.tsx` | `VendorTierModal` de `../modals` | `../modals/vendor-tier` |
| `case-detail.tsx` | `DecisionModal, MitigationModal` de `../modals` | `../modals/decision`, `../modals/mitigation` |
| `dashboard.tsx` | `ExportPackageModal` de `../modals` | `../modals/export-package` |
| `risk.tsx` | `MitigationModal` de `../modals` | `../modals/mitigation` |
| `vendors.tsx` | `ClauseLibraryModal, NewVendorModal` de `../modals` | `../modals/clause-library`, `../modals/new-vendor` |

`modals.tsx` **não foi apagado** — `policy.tsx` (fora do escopo desta
branch, onda 5b/5c) ainda importa dele. `tsc --noEmit` prova que os tipos
batem; testes das telas tocadas seguem verdes.

## Fora do escopo (relatado, não corrigido)

- `policy.tsx` ainda usa o barrel `../modals` — arquivo proibido nesta
  branch (pertence a outra onda em paralelo).
- `dashboard.tsx` está em 764 linhas (teto do size guard é 800); nenhuma
  mudança desta branch adicionou linha a ele (só trocou uma import), então
  não precisou de extração.

## Verificação

- `vitest run` (apps/app, suíte inteira): **4191 passed · 20 skipped · 0
  failed** (417 arquivos passaram, 4 skipped).
- `tsc --noEmit` (apps/app): sem erros.
- `pnpm size:guard` (raiz, sem `--update`): verde — "Nenhum arquivo novo
  acima do teto, nenhum grande cresceu" (29 arquivos acima de 800, baseline
  33 — a catraca já tinha baixado por outro trabalho, não mexemos nela).
- Build (`SKIP_ENV_VALIDATION=true pnpm --filter app build`):
  `✓ Compiled successfully in 8.6s`. Falha posterior em "Collecting page
  data" para `/api/cron/staleness-check` é pré-existente — nenhum arquivo
  desta branch (`git diff --name-only origin/main...HEAD`) toca rotas de
  API ou o módulo de cron.

## Commits

1. `c293917a` — DisclosurePanel + audit/onboarding (já existia antes desta
   sessão).
2. `185bb56f` — item 1: painel de settings colapsado.
3. `ed5ae905` — itens 2 e 3: skeletons de settings/vendor-detail + hint
   truncado do KPI + barrel de `vendor-detail.tsx`.
4. `f368c93a` — item 4 (restante): barrel de case-detail/dashboard/risk/
   vendors.
