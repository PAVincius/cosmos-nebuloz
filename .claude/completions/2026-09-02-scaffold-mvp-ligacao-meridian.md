# Scaffold — MVP: Setup + Foundational + US1 (T001–T030)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

A ligação que faltava. `MeridianGapPromotion.targetEntityId` era nulo para
`SCAFFOLD` porque o produto de destino não existia no repositório; agora ele
aponta para uma `ScaffoldTrack` com as quatro fases instanciadas e os passos
copiados da versão pinada do template.

- **Schema** — `packages/database/prisma/schema/scaffold.prisma`: 9 enums e 10
  modelos (membership, sequence, settings, template/versão/passo/critério,
  trilha, fase, passo instanciado). `ProductModule += SCAFFOLD`.
- **RBAC** — `packages/rbac/src/scaffold-matrix.ts` + `scaffold-resolve.ts`:
  cinco papéis, nove permissões, sem coringa.
- **Guard triplo** — `apps/app/lib/scaffold/guards.ts`: sessão → módulo → papel.
- **Rota** — `app/(scaffold)/` com layout guardado, rota única `[[...seg]]` e
  `generateMetadata`; `/scaffold-indisponivel` distingue as duas recusas.
- **Actions** — `actions/tracks.ts`: `createTrackFromGap`, `createTrack`,
  `listTracks`, `getTrack`, `cancelTrack`.
- **Seed** — `pnpm --filter @repo/database seed:scaffold`: três arquétipos,
  sete versões, quatro fases cada.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` em `apps/app` | 0 erros |
| `biome check` nos arquivos tocados | 0 erros (1 warning pré-existente, alheio) |
| Suíte `apps/app` | 348 arquivos, 3350 testes, 0 falhas |
| Suíte `packages/rbac` | 7 arquivos, 79 testes, 0 falhas |
| Testes novos | 44 (32 em `__tests__/scaffold`, 12 em rbac) |

## Decisões tomadas durante a implementação

**Acoplamento Meridian → Scaffold invertido em relação ao que a task descrevia.**
T029 dizia que `promoteGap` chamaria `createTrackFromGap`. Não faz: uma
promoção não pode falhar porque o outro produto não foi contratado, nem exigir
que quem promove tenha papel de Scaffold. `promoteGap` registra a intenção;
`createTrackFromGap` (lado Scaffold) aterrissa e preenche `targetEntityId`. O
que entrou do lado do Meridian foi só o guard de revogação: revogar promoção
com trilha `ACTIVE`/`STALLED` falha nomeando a trilha.

**Guard em `lib/scaffold/guards.ts`, não em `actions/_shared.ts`.** A task
apontava `_shared.ts`; o Meridian real usa `lib/<produto>/guards.ts` para o
guard e `actions/_shared.ts` para auditoria e sequência. Segui o código, não o
plano — os dois arquivos existem, com essa divisão.

**`ScaffoldSequence` e `ScaffoldSettings` não estavam em `data-model.md`.**
A primeira é necessária para os códigos legíveis (`TR-104`) e espelha
`MeridianSequence`; a segunda guarda o limiar de estagnação, que US6 vai ler.

**`overlayId` removido dos schemas.** Aceitar um campo que o servidor ignora em
silêncio é pior que não ter o campo. Entra em US5, junto da tabela.

**Ordem TDD invertida nesta fatia.** A constituição §III manda teste antes de
implementação. Aqui a implementação veio primeiro, porque os testes tipam
contra o client Prisma gerado e o schema precisava existir para o arquivo de
teste compilar. Não é justificativa suficiente para repetir: em US2 a máquina
de gate é lógica pura em `lib/scaffold/gate-machine.ts`, sem dependência de
schema, e ali o teste vem antes — é a fatia em que isso mais importa.

## Correções de integração

Adicionar `SCAFFOLD` ao enum quebrou dois `Record<ProductModule, …>`
exaustivos (`produto/page.tsx`, `actions/produtos/index.ts`) e a asserção de
ordem em `__tests__/actions/produtos.test.ts`. O type system fez o trabalho:
os três foram atualizados, e o Scaffold entrou no catálogo entre Meridian e
Signal.

`biome.jsonc` ganhou `app/(scaffold)/actions/**` na isenção de `useAwait` e
`components/scaffold/**` no bloco de componentes — mesmos motivos já escritos
ali para Charter e Meridian. A11y continua ligada nos dois casos (SN-10).

## Achado que virou correção de teste

A primeira versão de `adr-0013-boundary.test.ts` proibia o pacote
`@repo/provisioning` inteiro e casava com comentários. Acusou seis arquivos, e
nenhum era violação real: `apps/app` importa `provisionTenant` e
`POLICY_SECTIONS` legitimamente, e dois dos matches eram os comentários que
explicam por que a fila de supervisão *não* usa `platformDb`. O teste agora
casa só o binding `platformDb` em declaração de import, com comentários
removidos antes da busca.

## O que fica para a próxima fatia

- **US2 (T031–T048)** — gate engine. É onde o produto passa a valer.
- `TODO(US4 · T082)` em `cancelTrack`: recusar cancelamento de trilha com caso
  de negócio assinado sem decisão explícita sobre a apuração do Signal.
- Migration real (`db push` / SQL) não rodou: o worktree não tem `.env`. O
  schema foi validado (`prisma validate`) e o client gerado.
