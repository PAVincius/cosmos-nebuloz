# Scaffold — as mutações ganham botão

**Data**: 2026-09-16
**Branch**: `feat/scaffold-ui-wiring`
**Origem**: `/code-review-graph:review-delta` sobre o Scaffold, 13 dias depois do merge do #168

---

## O achado

O review não achou bug de código. Achou um produto **inacionável**.

Das 28 server actions do Scaffold, as cinco telas chamavam 13 — todas de
leitura mais `setStepState`, `acknowledgeCharterPolicy`, `saveDraft`,
`submitForSignature`, `newVersionFromSigned`, `resolveConflict` e
`exportHandoverPack`. As outras 15 tinham **zero chamadores fora de testes**:

| Sem botão | Consequência |
|---|---|
| `closePhase` `overridePhase` `reopenPhase` | o gate engine — "o produto", nas palavras do SRD — não fechava |
| `createTrackFromGap` `createTrack` | promoção do Meridian gravava `targetEntityId` nulo; trilha nenhuma nascia |
| `signBusinessCase` `contestBusinessCase` | caso ia para AWAITING e ficava; sem assinatura, SG-04 nunca soltava a ASSESS |
| `attachArtefact` `readArtefact` `cancelTrack` | passo dizia qual artefato esperava e não havia como anexar |
| `exportBusinessCase` | contrato do Signal existia como action, não como arquivo |
| `evaluateGate` `publishVersion` `saveOverlay` `getTemplate` | ver "deliberadamente fora" |

301 testes verdes por cima, porque cada action era testada isolada. A suíte
provava que o servidor recusava pelo motivo certo; nenhum teste perguntava se
existia um botão que chegasse até ele.

O `GatePanel` era a imagem disso: renderizava os critérios com `met: false`
fixo e "Sem decisão registrada". Nunca poderia dizer outra coisa.

---

## O que foi ligado

Seis commits, uma fatia cada, um teste de tela por fatia.

**Gate engine** (`gate-panel.tsx`, extraído de `track-detail.tsx`). Em
GATE_READY ou BLOCKED, cada critério vira checkbox nativo e "Fechar gate"
chama `closePhase` com os fatos e o dono do processo como aprovador. Recusa
SG-02 fica **no painel** — não derruba a tela — a fase recarrega já em
BLOCKED, e só então "Registrar override" aparece, pré-preenchido com as chaves
que faltaram. Não há caminho para dispensar critério sem antes ter tentado
fechar com ele. Fase fechada oferece "Reabrir". Uma correção de leitura no
caminho: `phase.result` é topo de pilha append-only e o painel dizia "fechado"
para fase reaberta; quem manda agora é o estado.

**Promoção → trilha** (`new-track-modal.tsx`, portfólio). `listTracks` devolve
promoções pendentes e membros; o portfólio lista as pendentes num card
"Aguardando trilha" e tem "Nova trilha" no cabeçalho. Um modal só: template
com versão publicada (os sem versão não aparecem — ST-01), dono, consultor.
Com promoção chama `createTrackFromGap` levando `gapId` e `promotionId`; sem,
`createTrack`.

**Assinar e contestar** (`baseline-detail.tsx`). Em AWAITING, dois botões.
Assinar mostra o que está sendo assinado e pede o nome. Contestar pede quem,
papel, objeção (mínimo 20) e o que precisa mudar.

**Cancelar e anexar** (`track-detail.tsx`). Cancelar com justificativa; com
caso assinado, obriga a decisão sobre a apuração do Signal antes de o servidor
recusar. Anexar é `<input type="file">` por passo; a URL assinada faz PUT
direto no storage. Artefato existente é botão que pede URL de leitura
auditada e abre em aba nova.

**Exportar** (`baseline-detail.tsx`). "Exportar v2" no card do Signal, só com
versão assinada. Baixa `<código>-signal-v2.json`.

---

## Deliberadamente fora

**`evaluateGate`** é dry-run. `setStepState` já move OPEN↔GATE_READY ao
concluir o último passo requerido, e `closePhase` avalia ao fechar. Um botão
"Avaliar" seria um botão que não muda nada.

**`publishVersion`, `saveOverlay`, `getTemplate`** são autoria de método. A
US5 da spec é biblioteca + resolução de conflito, e é isso que a tela faz;
nenhuma task pede editor de versão, o `SCREEN_MANIFEST` do design não tem
scaffold, e `getTemplate` devolve o mesmo shape da lista — passos e critérios
nunca chegam ao cliente. Versão entra por `seed:scaffold`. Um editor de quatro
fases × N passos × critérios × overlay é a maior fatia das cinco e a menos
frequente; construí-lo sem desenho seria inventar o método na tela.

---

## Gates

| Gate | Resultado |
|---|---|
| Suíte Scaffold | 288 (era 276) — 21 arquivos |
| Suíte inteira do app | ver PR |
| `tsc --noEmit` | exit 0 |
| `biome check` nos arquivos tocados | zero |
| Chamadores fora de testes | 11 de 15 ligadas; 4 deliberadamente fora |

---

## Ponytail

`track-detail.tsx` foi de 1048 para 1566 linhas nas fatias; `GatePanel` saiu
para arquivo próprio (310 linhas), a tela voltou a 1264. Ainda acima de 800 —
já estava antes desta branch — mas o que era meu não a deixou pior.

Três atos com justificativa (override, reabrir, cancelar) viraram tabela
`MODAL_COPY` em vez de três ternários aninhados no JSX.

Dois pontos que ficaram, com razão:

- `ARCHETYPE_LABEL` duplicado entre `portfolio.tsx` e `new-track-modal.tsx`.
  Três entradas. Importar tela dentro de modal inverte a dependência; um
  `lib/scaffold/archetypes.ts` para três strings é arquivo demais.
- `approverId` é sempre `track.ownerId`. O schema permite outro, a tela não
  oferece. Um seletor entra quando houver caso real de outra pessoa assinar.

---

## O que aprendi

Cobertura de action não é cobertura de produto. A pergunta que faltava na
suíte anterior era "existe um botão?", e ela só é respondível por grep de
chamador ou por teste de tela. Os cinco testes de tela desta branch fazem a
segunda coisa; a auditoria de chamadores no início fez a primeira.

O worktree anterior foi reciclado por disco cheio (76 GB em `.claude/worktrees`,
24 worktrees). Tudo commitado sobreviveu; nada fora de commit foi perdido
porque não havia. Vale limpar antes da próxima branch grande.
