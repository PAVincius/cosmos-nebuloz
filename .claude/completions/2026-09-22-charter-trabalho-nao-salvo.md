# Charter — trabalho digitado não é mais descartado sem perguntar (onda 7b)

**Data:** 2026-09-22 · **Branch:** `fix/charter-trabalho-nao-salvo`

Origem: crítica de design do Charter, P0 "trabalho não salvo". O módulo já
tinha construído a proteção — `DirtyCtx` (form-kit) + `ModalHost.tryClose` +
o `alertdialog` "Descartar alterações?" de `modal.tsx` — e ela só valia
**dentro de modal**. Os três lugares onde se escreve o texto que vira
registro de auditoria editam **em página**, e lá não havia nada.

## Os três pontos de perda

1. **`screens/policy.tsx`** — o corpo da seção se edita num `Textarea` com
   `draft`/`setEditing`. Clicar noutra seção da lista rodava
   `setSelId(s.id); setEditing(false)` e o texto sumia. "Cancelar" descartava
   calado; trocar de aba também.
2. **`screens/settings.tsx`** (aba Workspace) — `industry`, `geo`, `posture`,
   `employees` e `retention` vivem em `useState` com um único "Salvar" no
   fim. Ir para "Papéis e permissões" apagava os cinco.
3. **`screens/vendor-detail.tsx`** — `assigned` com flag `dirty` (cláusulas em
   edição, que decidem o teto de classe de dado). O `BackLink` e as linhas de
   caso vinculado chamavam `router.push` direto.

## Por que escopado ao Charter

O review sugeriu elevar `DirtyCtx` acima do `ModalProvider`. `DirtyCtx` mora
em `form-kit.tsx`, consumido por **cosmos, meridian, scaffold e signal** —
mudar a API dele espalharia risco por quatro módulos para resolver um
problema de três telas. `components/charter/use-unsaved-guard.tsx` resolve no
lugar certo, sem dependência nova e sem mexer em assinatura de nada fora do
Charter. `DirtyCtx`, `form-kit.tsx` e `modal.tsx` ficaram intocados.

## O guarda

`useUnsavedGuard({ dirty, what })` devolve `guard(acao)`:

- enquanto `dirty`, registra `beforeunload` (F5 / fechar aba) e **remove** no
  cleanup;
- `guard(acao)` roda `acao` direto se limpo; se sujo, abre `DiscardChangesModal`
  via `useModal().open(...)` (as três telas já montam `ModalProvider`) e só
  executa no confirmar.

Copy alinhada ao `alertdialog` de `modal.tsx` — "Descartar alterações?",
nomeando o que se perde, Cancelar (secondary) / Descartar (danger). Molde de
`screens/settings-confirm-role.tsx` e `screens/policy-confirm-reopen.tsx`.

**Falso positivo de "sujo"** é o ponto delicado: a comparação é sempre contra
o valor que o **servidor** entregou, nunca "o usuário tocou no campo".
Digitar e desfazer não pergunta — há um teste para isso em cada uma das três
telas.

- `policy.tsx`: `editing && draft !== editBase.body`, com `editBase` capturado
  ao entrar em edição.
- `settings.tsx`: `workspaceDirty(data?.workspace, rascunho)` — função pura,
  `null` no rascunho = campo intocado. Confirmar o descarte também **zera** os
  cinco `useState`, senão o rascunho ressuscitaria ao voltar para a aba e o
  botão "Descartar" teria mentido.
- `vendor-detail.tsx`: o `sameSet(assigned, data.clauseCodes)` que já existia.

## size:guard sem `--update`

`policy.tsx` está na baseline (941) e não podia crescer. O guarda somou 12
linhas; o editor de seção saiu para `screens/policy-section-editor.tsx`
(extração pura, sem mudança de comportamento) e o arquivo caiu de **916 para
890** linhas. `settings.tsx` 684 → 744 e `vendor-detail.tsx` 516 → 524, ambos
com folga até 800.

## Verificação

`vitest run` suíte inteira 0 falhas · `tsc --noEmit` limpo · `pnpm size:guard`
verde sem `--update` · build "Compiled successfully" (falha posterior em
"Collecting page data" de rota `api/cron` é pré-existente e fora do diff).

## O que ficou de fora

- `screens/case-detail.tsx` também tem `BackLink` e editor em página, mas está
  no escopo de outra onda — não foi tocado.
- O botão "Ver histórico" de `policy.tsx` só aparece fora do modo de edição,
  então não precisa de guarda; a troca de aba pelos `Tabs`, que é o caminho
  real de saída durante a edição, está guardada.
