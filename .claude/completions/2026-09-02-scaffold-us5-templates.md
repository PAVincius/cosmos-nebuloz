# Scaffold — US5: biblioteca de templates (T083–T097)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

O método da Nebuloz como dado versionado, e a customização do cliente como
operação — não como fork.

- **`lib/scaffold/overlay-merge.ts`** — `applyOverlay` e `detectConflicts`,
  lógica pura.
- **Modelos** — `ScaffoldTemplateOverlay` (ops em JSON) e
  `ScaffoldOverlayConflict`. `ScaffoldTrack` ganhou `overlayId`: junto com
  `templateVersionId`, responde ST-04 em duas colunas.
- **Actions** — `listTemplates`, `publishVersion`, `saveOverlay`,
  `resolveConflict`, `getTemplate`.
- **Guard** — `assertOverlayResolved` em `seedTrack`: overlay com conflito
  pendente recusa a criação de trilha.
- **Tela** — `templates.tsx` com trilha de versões, contagem de trilhas por
  versão e conflitos como item de trabalho.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| `biome check` | 0 erros |
| Suíte `apps/app` | 3530 testes, 0 falhas |
| Testes novos | 36 (212 no Scaffold) |

TDD respeitado: `overlay-merge.test.ts` primeiro, RED confirmado, depois a
implementação.

## A decisão que define a fatia

**Overlay é lista de operações, não cópia da árvore.** Cópia seria fork, e fork
não sabe dizer o que mudou — publicar uma versão nova do método nunca chegaria
a quem customizou. Operação se reaplica: o que passa limpo sobrevive ao upgrade
(primeira metade de ST-02), o que colide vira conflito explícito (segunda
metade).

Merge de três vias em JSON resolveria mais casos e produziria conflitos que
ninguém sabe ler. Aqui o conflito é sempre *"esta operação, sobre esta chave,
por este motivo"* — legível por uma consultora, que é quem vai resolvê-lo.

**O caso da Vanta, do protótipo, é o teste literal**: o overlay afrouxa sobre a
v3 o mesmo critério de rollback que a v4 endureceu. Escolher automaticamente
seria decidir por alguém — quem afrouxou tinha razão comercial, quem endureceu
tinha razão de método. Por isso o resultado é conflito.

## Três regras negativas, e onde cada uma mora

Regra negativa é a mais fácil de quebrar sem perceber: nada falha na hora, e a
trilha do cliente muda debaixo dele semanas depois.

| Regra | Onde é sustentada |
|---|---|
| **ST-01** versão publicada é imutável | O modelo não tem `updatedAt` — testado lendo o schema. Republicar o mesmo rótulo recusa com `VERSION_IMMUTABLE` |
| **ST-02** overlay sobrevive ou levanta conflito | `detectConflicts`, com 9 casos cobertos |
| **ST-03** trilha em curso não é afetada | Teste estático: nenhuma chamada a `scaffoldStepInstance` sai de `templates.ts` |

**Publicar não falha por causa de conflito.** O método novo é decisão da
Nebuloz e não pode ficar refém da customização de um cliente. O que trava é a
criação de trilha nova com aquele overlay.

**`REMOVE` concordante não é conflito.** Se overlay e versão nova removeram a
mesma coisa, as duas pontas concordam — levantar conflito obrigaria alguém a
resolver uma discordância que não existe.

## Dois erros meus, e um deles é repetido

**Repeti o erro do teste de arquitetura da US2.** O teste estático de ST-03
casou o meu próprio comentário — a linha que *explica* a regra
(`scaffoldStepInstance.update` sai deste arquivo). Mesma causa, mesma correção:
remover comentários antes da busca. Duas vezes na mesma implementação; da
próxima, escrevo o `stripComments` antes da regex.

**Bug real na tela, pego antes de rodar.** `keepOverlay` passava `overlayId`
onde `resolveConflict` espera `conflictId` — a listagem nem expunha os ids de
conflito. `OverlayRow` passou a carregar `openConflictIds`, e a resolução da
lista percorre todos.

E um mock meu servia a duas consultas diferentes (`findUnique` por
`templateId_label` e por `id`), fazendo a checagem de duplicata disparar em toda
publicação. Virou `versionLookup()`, que discrimina pela forma do `where`.

## O que fica para a próxima fatia

- **US6 (T098–T111)** — supervisão em `apps/backoffice` e detecção de
  estagnação. É a fatia que finalmente sai de `apps/app`.
- **`publishVersion` não tem tela.** A action existe e está testada, mas o
  editor de template não foi portado — publicar hoje é chamada de código ou
  seed. O protótipo também não desenha esse editor.
- **A tela resolve conflito só como `keep_overlay`.** As outras duas resoluções
  descartam a customização do cliente, e isso não se faz num clique de lista.
- Migration real segue pendente: worktree sem `.env`.
