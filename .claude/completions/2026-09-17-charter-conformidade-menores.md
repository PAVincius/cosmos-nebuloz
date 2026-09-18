# Charter — observações menores de conformidade (crítica de design, onda 5b)

**Data:** 2026-09-17 · **Branch:** `fix/charter-conformidade-menores`

Origem: crítica de design do Charter (snapshot em
`.impeccable/critique/2026-09-15T22-39-35Z__apps-app-components-charter.md`),
lista de observações menores da tela de conformidade + resíduos que as ondas
anteriores deixaram. Onda paralela a 5a (`screens/*`) e 5c (`form-kit`,
`modals/*`) — escopo restrito a `compliance*.tsx`, uma linha de `policy.tsx`
e `scripts/seed-charter.ts`.

## O que entrou

- **Extração pura** de `ImportQuickAddForm` para `screens/compliance-import.tsx`
  (`compliance.tsx` 1026 → 806; estava na baseline do size:guard e não podia
  crescer).
- **Import de exigências**: clicar "Importar exigências" renderizava o
  formulário abaixo de todo o mapa sem nada visível mudar. Agora faz
  `scrollIntoView({ block: "start" })` e move o foco para o primeiro campo.
- **Delimitador**: o parse por `|` quebrava citações como "§ 4 | 5". Passa a
  aceitar **tab** (o que sai de colar do Excel/Sheets — é assim que a
  compliance lead tem essa lista) com `|` como fallback só quando a linha não
  tem tab; hint e placeholder dizem "cole do Excel".
- **Banner "Há uma versão nova"** era `<div>` cru → `Callout`; "1 removida"
  concorda em número.
- **Vazio** "Este conjunto não tem exigências." → `SmartEmptyState` com CTA
  "Importar exigências para este conjunto".
- `policy.tsx` importa `DiffModal`/`PublishVersionModal` direto de
  `../modals/*` (barrel `modals.tsx` é transitório; some quando o último
  caller inlinar).
- `scripts/seed-charter.ts` deixa de semear "IA clínica"/"Clínico": usa
  `VENDOR_CATEGORIES`, `TRACK_AUDIENCES` e `INTAKE_DEPARTMENTS` de
  `lib/charter/rules.ts`. A lista local `DEPARTMENTS` (que duplicava a
  constante, com "CX", "Legal", "Growth", "People Ops") virou
  `INTAKE_DEPARTMENTS` inteira.

## size:guard sem `--update`

Dois arquivos da baseline cresceram e foram encolhidos em vez de registrar
exceção: `compliance-screen.test.tsx` (900 → 944 com os dois testes novos)
teve os builders `set`/`vigenciaPadrao`/`row`/`map` movidos como bloco puro
para `compliance-screen.fixtures.ts` (885); `seed-charter.ts` (1514 → 1522)
perdeu a lista duplicada (1510).

## Verificação

vitest suíte inteira 0 falhas · `tsc --noEmit` limpo · `pnpm size:guard`
verde sem `--update` · build "Compiled successfully" (falha posterior em
"Collecting page data" de rota de api/cron é pré-existente, fora do diff) ·
pre-push `pnpm turbo test` 13/13.
