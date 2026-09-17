# Charter — FormField variant="group" (crítica de design, onda 5c)

**Data:** 2026-09-16 · **Branch:** `fix/charter-formfield-grupo`

Origem: crítica de design do Charter (governança de IA), persona Sam (leitor
de tela). A PR #211 consertou `TableRow`, `ModalHost` e `CheckRow` mas
deixou de fora `FormField` envolvendo `Segmented`/`RadioCards` — a proposta
ficou registrada no corpo da PR #211 e no completion de `fix/charter-a11y`
(`FormField({ variant: "group" })`, `<label>` → `role="group"`). Onda
paralela a 5a (`screens/`) e 5b — escopo restrito a `form-kit.tsx`,
`modals/*.tsx`, `modals-intake.tsx` e testes em `__tests__/charter/`.

## O que entrou

### Bloco 1 — `FormField` com variante de grupo

- `FormField` ganhou `variant?: "field" | "group"` (default `"field"`, API
  e comportamento existentes intactos). Com `"group"`, renderiza
  `<div role="group" aria-labelledby={useId()}>` no lugar do `<label>`.
  Optamos por `role="group"` em vez de `<fieldset>`: dentro do
  `display:grid; gridTemplateColumns:"1fr 1fr"` que vários modais usam
  (Exposição/Criticidade em `modals-intake.tsx`, Público/Re-certificação em
  `publish-track.tsx`), `<fieldset>` tem o quirk conhecido de não encolher
  abaixo do conteúdo quando é filho de grid/flex (`min-width` implícito),
  quebrando a coluna `1fr`; `<div role="group">` não tem esse problema.
  Custo: `biome-ignore lint/a11y/useSemanticElements` (mesmo padrão já usado
  em `CheckRow`, no mesmo arquivo, pela mesma razão de visual/semântica).
- Aplicado nos 6 call sites onde `FormField` envolve `Segmented`/
  `RadioCards` (grep de contexto confirmou 6, não os 3 que a PR #211
  contou — ela só cobriu `modals/*.tsx`; `modals-intake.tsx` tinha mais 3):
  `decision.tsx` (Decisão · RadioCards, 4 opções), `vendor-tier.tsx`
  (Situação · RadioCards), `publish-track.tsx` (Re-certificação ·
  Segmented), `modals-intake.tsx` (Classe de dado envolvida, Exposição,
  Criticidade da decisão · Segmented).
- Testes novos em `__tests__/charter/form-field-group.test.tsx`: `FormField`
  isolado (`getByRole("group", { name: "Classe de dado" })` +
  `within(group).getAllByRole("button")`) e um teste por modal alterado
  provando que o grupo carrega o nome do rótulo e os botões ficam dentro
  dele. RED confirmado antes da implementação: `Unable to find an
  accessible element with the role "group"` nos 5 testes que dependiam do
  grupo (o 6º, variante default, já passava).

### Bloco 2 — resíduos nos modais

- `publish-track.tsx:247` — placeholder `"ex: Dado de paciente e IA"` era
  resíduo healthtech que a PR #213 deixou passar; trocado por
  `"ex: Uso de IA generativa no atendimento"` (coerente com
  `TRACK_AUDIENCES` de `rules.ts`, que já tem "Operações · Atendimento").
  Teste em `modals-gating.test.tsx` (único motivo legítimo de tocar esse
  arquivo) atualizado de `/Dado de paciente/` para `/Uso de IA generativa/`.
- `modals-intake.tsx` importava `DataClass` do barrel transitório
  `./modals`; passa a importar direto de `./modals/_shared`, de onde o tipo
  vem. `modals.tsx` não foi tocado (outras ondas ainda o importam).
- Varredura por `paciente`/`clínic`/`PHI`/`BAA` em `modals/*.tsx` e
  `modals-intake.tsx` (copy visível, fora de comentário de código):
  - `decision.tsx:70` (`CONDITION_SUGGESTIONS`) e `decision.tsx:357`
    (placeholder de justificativa) citam **"BAA"** — **mantido**: é a
    regra de negócio real de `rules.ts` (`DATA_CLASS_RULE.RESTRICTED`:
    *"Proibido em ferramenta pública. Só ambiente dedicado com BAA."*, e
    `DATA_CLASS_LABEL.RESTRICTED`: *"Restrito (PII/PHI)"*), não resíduo do
    protótipo healthtech — trocar quebraria a consistência com a regra
    codificada (`rules.ts` está fora de escopo desta onda).
  - `modals-intake.tsx:79` cita **"paciente"** dentro de um comentário de
    bloco (`/** ... */` acima de `IntakeModal`) — **mantido**: não é copy
    visível.
  - `modals-intake.tsx:405` (hint de "Exposição") — `"Externo = visível a
    cliente ou paciente"` era exemplo solto sem respaldo em `rules.ts`
    (`EXPOSURE_OPTS` só tem "Interno"/"Externo") — **trocado** para
    `"Externo = visível a cliente ou usuário fora da empresa"`.

## O que ficou de fora

Nada do escopo do Bloco 1/2 ficou pendente. Fora de escopo (proibido
tocar nesta onda): `screens/*` (5a/5b), `modals.tsx` (barrel, ainda
consumido por outras ondas), `base.tsx`, `modal.tsx`, `charter.css`,
`rules.ts`, actions.

## Verificação

`vitest run` inteira (apps/app): 4187 passed, 20 skipped (pré-existentes),
0 falhas. `tsc --noEmit` limpo. `pnpm size:guard` verde sem `--update`
(`form-kit.tsx` 554 linhas; todos os `modals/*.tsx` alterados < 400;
`acima de 800 linhas: 29 · baseline: 33`, nenhum arquivo novo estourou o
teto). Build (`SKIP_ENV_VALIDATION=true pnpm --filter app build`):
"Compiled successfully in 26.4s"; falha posterior em "Collecting page
data" para `/api/cron/staleness-check` é pré-existente — confirmado por
`git diff --name-only origin/main...HEAD`, que só lista arquivos de
`apps/app/components/charter/` e `apps/app/__tests__/charter/`, nenhum
tocando `packages/database` ou `api/cron`. `pre-push` (`pnpm turbo test`)
rodou e passou antes do push. Sem `Co-Authored-By` nos commits (checado
com `git log --format=%B origin/main..HEAD | grep -ci co-authored` → 0).

## Commits

- `d9203141` — fix: FormField variant="group" para Segmented/RadioCards
- `b3572305` — fix: residuo healthtech no placeholder de trilha e import direto do barrel
