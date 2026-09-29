# Diário · Dogfood Meridian

Cada linha é uma operação em produção (`app.nebuloz.ai`), com o "vai" do CEO.

| Quando | Passo | "Vai" | Quem operou | Resultado | Evidência |
|---|---|---|---|---|---|
| 2026-09-25 14:00 | M1 — criar assessment pela carteira | CEO, 14:00 | CEO (consultor) | OK — criou **AS-112** (o código é gerado pelo sistema; não é `AS-NBZ-002`) | print da carteira + detalhe: pendente |
| 2026-09-25 16:47 | M2 — 10 atribuições (5 eixos × fundador + auditoria) no AS-112 | CEO | CEO (consultor) | FALHOU — 10 atribuições feitas, nenhum link copiado; sem botão de revogar, a coleta travou (P1 no `atrito.md`, corrigido no #253) | — |
| 2026-09-26 14:43 | M2-bis — revogar os 10 respondentes do AS-112 e atribuir de novo, copiando cada link | CEO, 14:43 | CEO (consultor) | FALHOU — 10 revogações e 10 atribuições feitas, links copiados mas não colados em lugar nenhum; perdidos de novo | — |
| 2026-09-26 14:56 | M2-ter — revogar e atribuir de novo, colando cada link em `~/Documents/links-as112.txt` (aberto no TextEdit antes) | CEO | CEO (consultor) | FALHOU — o arquivo e a janela do TextEdit ficaram sem nenhum link (verificado por contagem, sem ler os valores); terceira perda seguida. M2 suspenso até o "Reemitir link" (P0, `meridian-prd.md` §10) | — |

Pré-condição do M1/M2: deploy `dpl_Hs1rcL1Ys7e4nLtVEhtZNbL46WPp` READY, commit `86f8153f` (merge do #248).
Pré-condição do M2-bis: deploy `dpl_4QSbrS8MQjs3zF85o1LWVv3KXMJk` READY, commit `d846faed` (merge do #253).

## Rodadas locais (E2E, banco `cosmos_dev`, sem produção)

### 2026-09-29 · M1–M11 no local (a769a762) · QA

`AUTH_TEST=1 pnpm exec playwright test e2e/meridian- --grep-invert load` de dentro de `apps/app`: **14 passaram, 11 falharam**. M10 não rodou.

| Spec | Resultado | Causa (arquivo:linha) |
|---|---|---|
| `meridian-diagnose.spec.ts` guard de papel ×2, carteira, fila de revisão, gap register, benchmark (**M11**, coorte retida <5), escala de confiança, token inválido | passou | — |
| `meridian-reemitir-lote.spec.ts` (5 specs) | passou | — |
| `meridian-dogfood.spec.ts:257` respondente completa a bateria | passou | — |
| `meridian-reemitir-link.spec.ts:235` bloqueia reemissão | passou | — |
| `meridian-diagnose.spec.ts:62, 79, 97, 107` | falhou | `:66/:88/:99/:111` — `getByText("Vanta Saúde").first()` casa o `<span class="sr-only">Abrir assessment Vanta Saúde</span>` (`components/meridian/screens/assessments.tsx:376`), que não recebe clique (`<html>` intercepta) |
| `meridian-dogfood.spec.ts:323` consultora até promover | falhou | `:327` — mesma causa, com "Solaris Digital" |
| `meridian-collection-as112.spec.ts:38` | falhou | `:110` — clique em `{x:10,y:10}` do backdrop "Fechar modal" cai sob a faixa `<output>` "AMBIENTE LOCAL" (`app/environment-banner.tsx`, `position:fixed; top:0; z-index:9999`) |
| `meridian-reemitir-link.spec.ts:68` | falhou | `:159` — mesma causa da faixa de ambiente |
| `meridian-dogfood.spec.ts:162` M1/M2 | falhou | `:242` — "Concluir" do modal "Link de coleta gerado" fica `disabled` até o link ser copiado (`components/meridian/screens/tab-coleta.tsx:241`, `disabled={!copied}`, guarda do P1 AS-112); o spec não copia o link antes |
| `meridian-dogfood.spec.ts:456, 499, 515` M8 auditoria | falhou | `:472/:506/:521` — linhas `meridian.assessment.create`, `override.register`, `evidence.read` inexistentes na trilha. Provável cascata de M1/M2 e da consultora terem falhado (o seed apaga o domínio Meridian); não confirmado isoladamente |
| M10 `meridian-load` | não rodou | `pnpm seed:meridian:load techcorp-sa` → `Tenant "techcorp-sa" não encontrado` (`scripts/seed-meridian-load.ts:63`); o tenant só nasce em `scripts/seed-tenants.ts:140`, que o setup não roda |

Reset local (`apps/app/scripts/sql/meridian-reset.sql`, inteiro, `-v ON_ERROR_STOP=1`): exit 0, BEGIN…COMMIT, guarda de vínculo com Scaffold = 0. Antes → depois: GapPromotion 1→0, PlanItem 8→0, GapDependency 5→0, Gap 8→0, Evidence 2→0, Response 39→0, Override 1→0, AxisScore 10→0, Respondent 22→0, Assessment 13→0, BenchmarkContribution 5→0, BenchmarkCohort 3→0, Sequence 3→0. Mantidos: Template 1, Question 15, Membership 4. Schema `backup_meridian_20260929` criado no banco local.

### 2026-09-29 · M1–M11 no local, segunda rodada (7af22365) · QA

Após 889c91af (seletor por role, backdrop fora da faixa de ambiente, copiar o link antes de Concluir) e 0483f3ea (seed de carga cria `techcorp-sa`). Banco local `cosmos_dev`, `AUTH_TEST=1 pnpm exec playwright test e2e/meridian- --grep-invert load` de dentro de `apps/app`: **25 passaram, 0 falharam** (1,8 min). Inclui `meridian-collection-as112:38`, `meridian-reemitir-link:68/239`, `meridian-dogfood:162/262/328` e M8 (`:464/:507/:523`), que antes falhavam; M8 confirma que era cascata. M11 (benchmark <5 não mostra) em `meridian-diagnose.spec.ts:161`, passou.

M10 (`e2e/meridian-load`): **passou** — `/meridian` 525 ms com 200 assessments, `/meridian/registry` 273 ms com 2.000 gaps (orçamento SC-010: 2 s). O seed criou 200 assessments `LOAD-` no tenant `techcorp-sa` local.

Schema `backup_meridian_20260929` do banco local removido (`DROP SCHEMA … CASCADE`, só `cosmos_dev` em localhost:5434).
