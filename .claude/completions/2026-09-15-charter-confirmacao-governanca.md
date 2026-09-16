# Charter — confirmação nos momentos de alto risco (crítica de design, onda 2a)

**Data:** 2026-09-15 · **Branch:** `fix/charter-confirmacao-governanca` · **PR:** #209

Origem: crítica de design dual-agent do módulo Charter (snapshot em
`.impeccable/critique/2026-09-15T22-39-35Z__apps-app-components-charter.md`).
P1: o produto vende "aceite vira evidência" e fabricava evidência com um
clique; troca de papel de governança disparava no `onChange` do `Select`.

## O que entrou

- `settings`: trocar papel abre `ModalCard` (`settings-confirm-role.tsx`)
  nomeando pessoa, papel atual → novo e a consequência; auto-rebaixamento é
  dito explicitamente; cancelar/erro restaura o `Select`. O guard de servidor
  contra remover o último `COMPLIANCE` (`settings.ts:371-381`) **já existia**
  e cobria o autorrebaixamento — só foi conectado, não duplicado.
  `SettingsView` ganhou `activeUserId`.
- `onboarding`: aceite em nome de terceiro exige `justificativa` (zod
  `.trim().min(10)`) quando `ctx.userId !== ack.userId`; aceite próprio segue
  direto. Atribuição vai na trilha (`logCharterAudit` com "Registrado por X em
  nome de Y — {justificativa}"), **sem migration** em `CharterAcknowledgment`.
  Tela abre `ModalCard` com a consequência e `Textarea` obrigatória, botão
  gated de verdade.
- `policy-draft-preview`: os dois `<span opacity/pointerEvents>` viraram
  `GatedButton` + `FooterHint` visível. A prova de mutação mostrou que o span
  **nunca bloqueava**: o clique passava com `pointer-events:none`.

## Verificação

vitest 4067/0 · tsc limpo · `size:guard` verde sem `--update` · build
"Compiled successfully" (falha posterior em `/api/analytics/executive` é
pré-existente, fora do diff). Provas de mutação literais no corpo do PR.
