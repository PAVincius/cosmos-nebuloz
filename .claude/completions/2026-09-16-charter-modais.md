# Charter — modais: split, gating real, controles mortos (crítica de design, onda 4a)

**Data:** 2026-09-16 · **Branch:** `fix/charter-modais` · **PR:** ver descrição

Origem: crítica de design do módulo Charter, lote dos modais. Modo Operate —
refinamento preserva identidade, copy e tudo fora da lista. Três blocos, um
commit cada.

## Bloco 0 — split puro (`2112c961`)

`modals.tsx` (1733 linhas, 9 modais) vira um arquivo por modal em
`components/charter/modals/<nome>.tsx`; `DataClass` (e, até o bloco 1,
`GatedAction`) em `modals/_shared.tsx`. `modals.tsx` é **barrel transitório**
que só re-exporta — os nove importadores (`./modals` / `../modals`) não mudam
nesta onda; inlinar cada import é follow-up de uma linha por caller, e aí o
barrel some. Cada bloco movido é idêntico ao original (`diff -u` contra `HEAD`
vazio para os 10 arquivos), salvo cabeçalho e imports.

## Bloco 1 — gating real (`412a7ebe`)

`GatedAction` era `<span style={{pointerEvents:"none"}}>` com o motivo no
`title`: não impedia Tab+Enter, `fireEvent.click` disparava a action, motivo
só no hover. Todas as confirmações viram `GatedButton` (`disabled` real) e o
motivo é texto visível no rodapé, no lugar da dica enquanto trava.

| Modal | Gate (preservado) | Extra no mesmo lote |
|---|---|---|
| Decision | justificativa ≥ 12 · condição se restrito | — |
| Mitigation | ação > 8 · prazo | **Dono** entra no `ready` |
| PublishVersion | resumo ≥ 12 · sem seção bloqueando | — |
| VendorTier | justificativa ≥ 12 | **tier igual ao atual** trava ("Escolha um tier diferente do atual") |
| NewVendor | nome > 2 | — |
| PublishTrack | nome > 3 · ≥ 1 seção | — |
| ExportPackage | período · ≥ 1 artefato | — |
| Intake | título > 5 · objetivo > 15 · elegível | **Responsável** entra no `ready` |

`GatedAction` apagado. Não havia `pointerEvents` fora dele em `modals.tsx`.

## Bloco 2 — controles mortos e defaults que mentiam (`e7669e54`)

| Modal | Era | Virou |
|---|---|---|
| PublishVersion | checkboxes Notificar / Exigir re-aceite fora do `onSubmit` | removidos; texto "Aceites das trilhas vinculadas serão invalidados de imediato — N trilhas · N pessoas" |
| ExportPackage | período fixo `2026-04-01→2026-06-30` | últimos 90 dias a partir de hoje (data local), editável |
| NewVendor | região "UE (Frankfurt)", retenção "Zero" por omissão | "Não declarada" (`""` → `undefined` → `null`); detalhe já mostra "Não declarada" / "—" |
| NewVendor / Intake / PublishTrack | "IA clínica", "Clínico", "Clínico · Operações" inline | `VENDOR_CATEGORIES`, `INTAKE_DEPARTMENTS`, `TRACK_AUDIENCES` em `lib/charter/rules.ts`, sem nada clínico |
| Decision | "Aprovar com restrições" pré-selecionado | sem seleção; "Registrar decisão" travado com "Escolha o veredito" |
| Decision | rodapé "Você · —" quando `getSettings` falha | só "Você" |
| Intake | "Início pretendido" descartado | `IntakeSubmit.launchTarget?: string` (a action já aceita e grava) |
| Intake | "Plano de revisão humana" descartado (sem coluna) | removido; migration é decisão de produto pendente |
| todos | `<Kbd>esc</Kbd>` só em Mitigation/Publish | em todos — `ModalHost` fecha todos com Esc |

`GatedButton` **não** ganhou prop: `base.tsx` está na baseline do size guard e
não pode crescer. A cor do veredito no botão de decisão vem de `--accent`
redefinido no escopo do botão (`decision.tsx`).

## Bloco 3 — `cases.tsx` repassa `launchTarget`

`screens/cases.tsx` montava o `submitCase` campo a campo e descartava o
`launchTarget` que o intake passou a emitir. Liberado pela coordenação, entra
na própria PR: teste de tela (`cases-screen-launch-target.test.tsx`) que abre
o intake, preenche "Início pretendido", submete e asserta `submitCase` com
`launchTarget: "2026-11-01"`; mutação (linha removida) derruba o teste.

## Fora do escopo (relatado)

- `scripts/seed-charter.ts` ainda semeia "IA clínica"/"Clínico" — dado de
  demonstração, não UI.
- `scripts/file-size-baseline.json` não foi baixado (`modals.tsx` saiu da
  lista); `--update` mexeria no JSON que outra onda pode tocar.

## Verificação

vitest 4142/0 (406 arquivos; +46 testes) · tsc limpo · biome limpo nos
arquivos tocados · `size:guard` verde sem `--update` (`modals.tsx` caiu
abaixo de 800; nenhum arquivo novo acima) · build "Compiled successfully" +
TypeScript OK (falha posterior em "Collecting page data" de
`/api/compliance/soc2-export`, módulo de `packages/auth/server`, é
pré-existente e fora do diff). Provas de mutação literais no corpo do PR.
