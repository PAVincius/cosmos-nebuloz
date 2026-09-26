# Revogar respondente na aba Coleta (P1 AS-112)

**Data**: 2026-09-26
**Commits**: `4f0821eb` (docs), `28d72cfd` (feat + testes), `023139ae` (completion),
`5fad9132` (fix: X/Esc/backdrop também gated — review da Morgana)
**Origem**: Morgana → decisão do CEO, P1 achado em produção (AS-112): CEO atribuiu os 10
respondentes mas não copiou nenhum link; sem botão de revogar, a coleta travou.

## O quê

`apps/app/components/meridian/screens/tab-coleta.tsx`:

1. Botão "Revogar" por respondente ativo, chama a action **existente**
   `revokeRespondent` (`actions/collection.ts:111`) — não mudei a action.
2. Confirmação num modal (`RevokeConfirmModal`) antes de revogar — é irreversível.
3. `byAxis` agora separa `list` (todos, pra render) de `active` (não-REVOKED, pra
   cobertura). Respondente `REVOKED` continua listado — riscado, rótulo "Revogado",
   sem botões de ação — mas não conta para "sem dono" nem para "Eixo sem
   respondente", então "Atribuir respondente" volta a ficar óbvio no eixo.
4. Causa raiz do P1: `AssignRespondentModal` — "Concluir" agora fica desabilitado
   até o consultor clicar em "Copiar" ao menos uma vez; o aviso de "só aparece
   agora" ganhou destaque visual (fundo âmbar).

Sem mudança em `actions/collection.ts` — `closeCollection` já ignorava `REVOKED`
na cobertura de eixo antes desta tarefa (teste já existente,
`__tests__/meridian/collection.test.ts:279`, "ignora respondente revogado ao
medir cobertura de eixo").

## Testes

`__tests__/screens/meridian-tab-coleta.test.tsx` (RTL):
- fluxo completo: clicar Revogar → confirmar no modal → `revokeRespondent`
  chamada com o id certo.
- `REVOKED` aparece riscado + rótulo "Revogado", sem botão de Lembrar/Revogar,
  e o eixo continua "sem dono" (fixture com os outros 4 eixos cobertos, pra
  não ambiguar a asserção).
- "Concluir" desabilitado até clicar "Copiar" (teste novo) + teste original
  do link ajustado pra clicar "Copiar" antes de "Concluir".

`npx vitest run __tests__/screens/meridian-tab-coleta.test.tsx
__tests__/meridian/collection.test.ts` — 17 passam.

## Review da Morgana — causa raiz continuava aberta

Ela apontou (correto): `onClose={finish}` no `ModalShell` do passo do link
deixava X, Esc e clique no backdrop fecharem direto, sem checar `copied` —
só o botão "Concluir" era gated. Corrigido em `5fad9132`:

- X e Esc agora passam pela mesma confirmação local ("Fechar sem copiar o
  link?" / "Voltar e copiar" / "Fechar mesmo assim"). Esc é interceptado em
  fase de captura no `document` (`e.stopPropagation()`), antes de chegar no
  listener em `window` que o `ModalHost` do Charter usa pra Esc — sem isso,
  Esc chegava lá primeiro e fechava sem perguntar.
- Clique no backdrop não dá pra interceptar do componente (é um `<button>`
  irmão, fora da árvore do conteúdo) — usei `useDirty`/`markDirty`
  (`components/charter/form-kit.tsx`, já documentado como consumido por
  cosmos/meridian/scaffold/signal; primeiro uso de fato no Meridian) pra
  marcar o modal como "sujo" e acionar a confirmação de descarte que o
  `ModalHost` já tem pronta — mensagem genérica ("Descartar alterações?"),
  não a mesma do X/Esc, mas resolve o mesmo risco. Não toquei em
  `components/charter/modal.tsx` (Charter, fora da minha alçada).
- Bônus pedido: `copied` só vira `true` quando `clipboard.writeText`
  resolve de verdade; se falhar, seleciona o texto do input e mostra aviso
  — o evento `onCopy` nativo do input cobre o Ctrl+C manual.

Testes novos (RTL): Esc sem copiar não fecha nem chama `onAssigned`; X sem
copiar pede confirmação e só fecha em "Fechar mesmo assim"; clipboard falho
seleciona+avisa e libera "Concluir" só depois do `onCopy` manual.
20/20 passam (`__tests__/screens/meridian-tab-coleta.test.tsx` +
`__tests__/meridian/collection.test.ts`).

## Obstáculo

`biome check --write` direto via Bash deu OOM neste ambiente (memória livre
muito baixa no momento) — não consegui rodar manualmente. O hook de pre-commit
(lint-staged) rodou `biome check --write` com sucesso na hora do commit e
formatou os dois arquivos; testes revalidados depois, passam.

## Fora do escopo

Não toquei em `actions/collection.ts` nem em `closeCollection` — cobertura de
REVOKED já estava correta e testada.
