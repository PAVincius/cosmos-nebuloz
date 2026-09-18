# Charter — tipografia na escala do cosmos, barrel fora, polish (crítica de design, onda 6)

**Data:** 2026-09-18 · **Branch:** `fix/charter-tipografia-e-polish` · **PR:** ver descrição

Última onda antes da re-crítica. Modo Operate — refinamento preserva
identidade, copy e layout; nada de redesenho. Sem inspeção visual: não há
servidor nem sessão autenticada, tudo foi verificado por código e por teste
de regressão.

## Bloco 0 — barrel `modals.tsx` (`b8cdc019`)

`git grep -l -E 'from "(\.\./|\./)modals"' -- apps/app` vazio: nenhum
importador restava desde que as ondas seguintes inlinaram os imports.
Arquivo apagado com seu `biome-ignore noBarrelFile`; `tsc` limpo.

## Bloco 1 — `typeset`: 209 literais → 6 degraus (`c223abe2`)

O Charter é o **primeiro consumidor** da escala `--fs-*` de `cosmos.css`
(nem o kit usa). `components/charter/type-scale.ts` exporta `FS` com os seis
degraus; só `fontSize` de texto passa por ele — ícone, largura, entreletra e
entrelinha ficam em número.

Papéis: micro = eyebrow e carimbo mono em maiúsculas · nota = meta, hint,
legenda, contador · base = corpo, rótulo, tab, botão, input · forte =
número-chave e título de estado vazio · titulo = título de modal · display =
contagem grande e título "Em breve".

| Literal | n | Degrau | px | Δ |
|---|---|---|---|---|
| 9 | 1 | micro | 10 | +1 (abaixo do piso; `shell.tsx` carimbo do wordmark) |
| 10 | 8 | micro | 10 | 0 |
| 10.5 | 21 | micro | 10 | −0.5 |
| 11 | 16 | nota | 11.5 | +0.5 |
| 11.5 | 41 | nota | 11.5 | 0 |
| 12 | 33 | nota | 11.5 | −0.5 |
| 12.5 | 46 | base | 13 | +0.5 |
| 13 | 23 | base | 13 | 0 |
| 13.5 | 10 | base | 13 | −0.5 |
| 14 | 3 | forte | 15 | +1 — os três são ênfase (ver abaixo) |
| 15 | 3 | forte | 15 | 0 |
| 15.5 | 1 | forte | 15 | −0.5 |
| 17 | 1 | titulo | 19 | +2 — título de modal |
| 21 | 1 | display | 22 | +1 |
| 22 | 1 | display | 22 | 0 |

Regra: degrau mais próximo, empate para baixo. O mapa é monotônico
globalmente, logo dentro de cada arquivo também — nenhum ajuste foi
necessário. Caso especial: a ternária `mono ? 12.5 : 13` (`base.tsx:130`)
colapsa em `FS.base` (12.5 e 13 caem no mesmo degrau); por isso a contagem
de 12.5/13 acima é 46/23 e não 45/22.

Onde mudou mais de 0.5px (revisor olha primeiro):

1. `modal.tsx` título de modal 17 → `titulo` (19). Empate 15/19 resolvido
   pelo papel: é o único título do modal; o módulo cosmos usa 16.5/18 no
   mesmo lugar, e deixaria `titulo` sem consumidor.
2. `base.tsx` títulos de `SmartEmptyState` e `ScreenError` 14 → `forte`
   (15). Peso 700 sobre corpo 12.5→base: em base ficariam do mesmo tamanho
   do corpo, hierarquia só por peso — o que cosmos.css critica.
3. `parts.tsx` contagem mono 800 da célula da matriz de risco 14 → `forte`.

Também +1: `shell.tsx` 9→10 (carimbo do wordmark) e 21→22 ("Em breve").
`charter.css`: `font-size: 11.5px` do tooltip → `var(--fs-nota)`.

**Catraca:** `__tests__/charter/type-scale.test.ts` lê
`components/charter/**/*.{ts,tsx,css}` com `fs` e barra qualquer literal
numérico em `fontSize:`/`font-size:`; e `FS` só com os seis degraus que
`cosmos.css` declara. Red literal antes da migração: **210** (209 em
ts/tsx + 1 no CSS), listados por arquivo:linha. Mutação: `shell.tsx:266`
devolvido a `12.5` → `AssertionError: 1 literal(is) fora da escala --fs-*:
shell.tsx:266: 12.5`.

**Size guard:** `FS.nota` tem 3 caracteres a mais que `11.5`, e o biome
expandiu três `style={{ … }}` inline que passaram de 80 colunas —
`base.tsx` 1112→1117 e `policy.tsx` 943→948 estouravam a baseline.
Compensado por extração, sem `--update`: `BackLink` → `back-link.tsx`
(base.tsx 1112→1080, **1079** ao fim da onda; os três barrels de módulo —
meridian, scaffold, signal — reexportam da nova origem, telas não mudam) e
`DERIVED_RULES`/`VERSION_DISCIPLINE` → `screens/policy-copy.ts` (policy.tsx
943→**917**, movimento puro de copy estática).

## Bloco 2 — `polish`

**1. Detector** (`detect.mjs --json`): antes **1** achado,
`codex-grid-background` em `charter.css` — grid de 64px só no dark, decisão
comentada; falso positivo deliberado, fica. Depois: **1** (o mesmo).

**2. Estados de controle nos compartilhados** (`e14ee432`):

| Estado | Havia | Faltava / consertado |
|---|---|---|
| `:focus-visible` | anel global `.charter-root :focus-visible { outline: 2px solid var(--accent) }` | `CONTROL_STYLE` (base.tsx) e `inputStyle` (form-kit.tsx) tinham `outline: "none"` **inline** em input/textarea/select — inline vence CSS, foco de teclado invisível em todo formulário do Charter (e dos módulos que reusam `base`). Removido. A célula da matriz (`parts.tsx`) usava `outline` como anel de seleção com `"none"` fora dela — mesmo efeito; anel de seleção virou `box-shadow`. |
| `disabled` | `GatedButton` e `CheckRow` inline; kit `Button` sem nada | `charter.css` não tinha `.btn:disabled` (scaffold.css e signal.css têm; o kit promete "o CSS já cobre `.btn:disabled`"). Adicionado com os mesmos valores dos irmãos: opacidade 0.45 + `cursor: not-allowed`, `:disabled:active { transform: none }`. Não há token de opacidade no sistema — literal igual aos irmãos. |
| `loading` | nenhum componente compartilhado tem estado próprio | O único carregamento de botão no Charter é `disabled={pending}` em `Button` do kit (3 telas) — até aqui invisível; passa a ter feedback pela regra acima. |
| `:hover` | `.navitem:hover`, `.kpi:hover`, `.glossary-term:hover` | `.btn` não tem `:hover` em módulo nenhum (cosmos, scaffold, signal, charter) — decisão do sistema, não diverge; só `:active`. |

Catraca: `__tests__/charter/control-states.test.ts` — nenhum `outline:`
inline em `components/charter/**/*.tsx` e as duas regras no CSS. Red
literal: `base.tsx:562`, `form-kit.tsx:40`, `parts.tsx:200` + CSS sem
`.btn:disabled`.

**3. Cor semântica** (`0885b4a1`): fora de `charter.css`, 39 `rgba(var(--…-rgb), α)`
(tom via token, ok) e 4 literais. Trocado: backdrop do diálogo "Descartar
alterações?" `rgba(4,5,7,.55)` → `var(--scrim)` (o backdrop do modal
principal já usava o token). Ficam: três `box-shadow … rgba(0,0,0,.x)`
(modal, alertdialog, popover de módulos) — alfa de sombra, sem token no
sistema, mesmo literal que `cosmos/modal.tsx`.

**4. Código morto** (`66da89c6`): biome limpo em 42 arquivos; sem
`console.*`, sem TODO. `charter.css` perdeu 109 linhas herdadas do fork do
cosmos.css sem consumidor sob `.charter-root` (`git grep` em
components/charter, kit.tsx e app/(charter)): `.lift`, `.card-in` (+
`@keyframes charter-cardIn`), `.no-ecg`, `.block-hover`/`.block-remove`,
`.tree-chevron`, `[cmdk-item]` — só telas do módulo cosmos os usam — e três
`@keyframes` sem `animation:` (`emptyPulse`, `badgeFlash`, `toastIn`). Toda
classe restante tem ≥1 consumidor. `--hover-shadow` fica (paleta).

**5. Diff final**: 38 arquivos, +544/−417. Leitura completa filtrando
`fontSize`/import/reflow: nenhuma reformatação sem mudança, nenhuma
renomeação; nada revertido.

## Fora do escopo (relatado)

- `meridian.css` não tem `.btn:disabled` (scaffold, signal e agora charter
  têm) — por isso `GatedButton` mantém opacidade/cursor inline: é primitiva
  compartilhada e não pode assumir o CSS do módulo hospedeiro.
- `outline: "none"` inline existe em 10 arquivos do módulo cosmos
  (`entity-link-field`, `modal-form`, `command-palette`, telas) — mesmo
  defeito de foco, fora do Charter.
- Token de opacidade para `disabled` e de sombra para modal/popover: não
  existem em `cosmos.css`; criar é decisão de sistema, não de módulo.
- `scripts/file-size-baseline.json` ainda lista `modals.tsx: 2180` e os
  valores antigos de base/policy — o guard reporta como progresso; sem
  `--update` por regra da onda.
- Biome emite aviso `INTERNAL` de limite de tipos em
  `apps/backoffice/__tests__/propostas-linha-a11y.test.tsx` — pré-existente,
  fora do diff.

## Verificação

Ver seção final do corpo do PR (números). Sem verificação visual.
