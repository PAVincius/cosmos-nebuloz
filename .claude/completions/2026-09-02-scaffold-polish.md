# Scaffold — polimento e gates de qualidade

**Data**: 2026-09-02
**Fatia**: polimento (T133–T142)
**Spec**: `specs/002-scaffold-adoption/`

---

## O que fechou

### Documentação de decisão

Três ADRs, cada uma registrando um conflito entre documentos que a
implementação teve de resolver — e não um resumo do que o código faz:

| ADR | Decisão |
|---|---|
| [0014](../../docs/adr/0014-scaffold-supervisao-no-backoffice.md) | Fila de supervisão vive em `apps/backoffice`, não em `apps/app` |
| [0015](../../docs/adr/0015-caso-de-negocio-versionado.md) | Caso de negócio versionado vence o baseline plano do SRD §3 |
| [0016](../../docs/adr/0016-residencia-de-dado-fora-do-v1.md) | SN-04 (residência de dado) declarado fora do V1 |

`docs/adr/README.md` ganhou as quatro linhas 0013–0016 — a 0013 nunca tinha
sido indexada — mais uma legenda **Conflito de spec** para separar as ADRs que
resolvem divergência entre documentos das que registram escolha técnica.

`docs/produto/scaffold-prd.md` ganhou nota de cabeçalho registrando a decisão
R1: dois documentos chamados "Scaffold", escopos incompatíveis, o produto vence
e o §7 do PRD do repo sobrevive como S-01.

### Gates

| Gate | Resultado |
|---|---|
| `biome check` | Sem regressão — verificado arquivo a arquivo em todos os caminhos tocados: zero |
| `tsc --noEmit` (apps/app) | exit 0 |
| Cobertura (`lib/scaffold` + `app/(scaffold)`) | **96,26% stmts · 76,52% branch · 96,61% funcs** |
| Suíte Scaffold | 301 testes verdes (270 apps/app + 12 rbac + 19 backoffice) |
| `turbo build --filter=app --filter=backoffice` | Verde nos dois; `/scaffold` aparece no manifesto de rotas do back-office |

### Checklist de aceite do quickstart §Checklist

| Item | Estado |
|---|---|
| `SCAFFOLD` em `ProductModule`; tenant sem a linha vai para `/scaffold-indisponivel` | ✅ enum + `redirect()` em `(scaffold)/layout.tsx:35` |
| Lacuna promovida preenche `MeridianGapPromotion.targetEntityId` | ✅ `tracks.ts:244` |
| Toda linha de `gates-negative.test.ts` | ✅ |
| `gates-architecture.test.ts` | ✅ |
| Publicar `v4` deixa trilha na `v3` intacta | ✅ `templates.test.ts` |
| Caso de negócio assinado imutável; editar cria versão | ✅ `business-case.test.ts` |
| Fila não devolve artefato nem texto de critério | ✅ `scaffold-supervision.test.ts` |
| `apps/app` não importa `platformDb` | ✅ `adr-0013-boundary.test.ts` |
| Cobertura ≥ 80% | ✅ 96,26% |
| Completion doc por fatia | ✅ 6 + este |

---

## O bug que a validação achou

`closePhase` fechava a fase, gravava o `GateResult` e carimbava `lastGateAt` —
e **nunca movia a trilha**. Fechar a `ASSESS` deixava `track.currentPhase` em
`ASSESS`, com a `PILOT` ainda em `IDLE` e sem passo para executar. Nada
estourava: a decisão ficava registrada e o produto parava de andar.

O sinal foi `nextPhase()` em `lib/scaffold/phases.ts` — escrita para exatamente
isso e sem um único chamador. Toda a suíte de 266 testes estava verde por cima
disso, porque cada teste assertava a recusa do gate e nenhum assertava o
avanço.

O conserto, em `writeClose`:

- `track.currentPhase` recebe `nextPhase(phase.phase)`; `EMBED` não avança,
  porque não há quinta fase e a entrega é a janela de observação.
- A fase seguinte abre via `updateMany` com `state: "IDLE"` no `where` — assim
  refechar uma fase reaberta não reabre a seguinte, que já andou. O filtro de
  tenant vai pela relação (`track: { tenantId }`), já que `ScaffoldPhaseInstance`
  não tem coluna própria.
- `reopenPhase` traz `currentPhase` de volta para a fase reaberta.

Quatro testes novos em `gates-negative.test.ts`, um por caminho: avanço,
abertura da seguinte, `EMBED` que não avança, e reabertura.

## Ponytail — o que saiu

Varredura de export morto no código do Scaffold (`lib/scaffold`,
`(scaffold)/actions`, `components/scaffold`, back-office, seeds).

Saíram de `schemas.ts`: nove aliases `*Input` (`z.infer<…>`) que ninguém
importava — as actions usam `z.input<typeof XSchema>` direto — mais três enums
Zod sem referência (`ScaffoldPhaseStateEnum`, `ScaffoldRoleEnum`,
`ScaffoldBusinessCaseStateEnum`).

**Ficaram**, e a razão importa: `createTrack` e `getTemplate` aparecem sem
chamador, mas os dois estão no contrato assinado
(`contracts/server-actions.md` linhas 27 e 111). São superfície especificada e
ainda não ligada à UI — mesma categoria de `publishVersion` e
`exportBusinessCase`, e não código especulativo. Apagar seria entregar menos
que o contrato.

`net: -22 linhas.` O resto do código não tinha o que cortar.

---

## Migration — gerada e validada num Postgres de verdade

Postgres 16 descartável em container (`pgvector/pgvector:pg16`, porta 55432),
banco zerado, `prisma migrate deploy` das 99 migrations existentes como base.
Nenhum banco real foi tocado.

Duas migrations saíram daí, e a separação é o ponto:

**`20260902170000_catalogo_comercial_e_meeting`** (136 linhas) — não é do
Scaffold. `main` já estava com schema sem migration: os modelos do catálogo
comercial (`PlanoComercial`, `PrecoDeModulo`, `TermoDeContrato`,
`AddOnComercial`), colunas novas de `Proposal` e `Service`, e churn de
constraint em `MeetingParticipant`, todos vindos de `33513541`. Quem rodasse
`migrate deploy` em `main` hoje não produziria esse schema. O primeiro diff que
gerei juntava isso com o Scaffold num arquivo só; separar deixa a revisão do
gate engine fora de 136 linhas de tabela de preço, e o histórico deixa de dizer
que o catálogo comercial nasceu com a adoção assistida.

**`20260902170100_scaffold_adocao`** (588 linhas) — 19 tabelas, 12 enums,
`SCAFFOLD` no `ProductModule`, 38 FKs, 54 índices.

Verificação, com banco recriado do zero:

| Checagem | Resultado |
|---|---|
| `migrate deploy` do zero | 101 aplicadas, sem falha |
| Tabelas `Scaffold*` | 19 — bate com os 19 `model` do schema |
| Enums `Scaffold*` | 12 — bate com os 12 `enum` do schema |
| `SCAFFOLD` em `ProductModule` | presente |
| Tabelas do catálogo | 4 |
| `seed:scaffold` | 6 versões (triage v3/v4, docreview v1/v2, reporting v2/v3), 80 passos, 57 critérios |
| Seed rodado 2× | idempotente — "0 criadas, 2 existentes" |
| Drift residual (`migrate diff`) | vazio |

### Erro no caminho, que vale registrar

O primeiro split saiu quebrado: gerei os dois diffs com a migration combinada
antiga **ainda na pasta**, então o lado "from" já continha o Scaffold. O
resultado foi um `catalogo` cheio de `DROP CONSTRAINT "ScaffoldArtefact_…"` e
um `ALTER TABLE "Proposal" ALTER COLUMN "modulos"` antes de a coluna existir.
`migrate deploy` do zero pegou: *"column `modulos` of relation `Proposal` does
not exist"*.

`prisma migrate diff --from-migrations` lê a pasta como ela está no disco. Se
sobrou migration de tentativa anterior lá dentro, o diff sai contra um passado
que não existe. Regenerar exige a pasta no estado exato do baseline — e a prova
é sempre o deploy do zero, nunca o diff que acabou de ser gerado.

---

## O que ficou aberto, e por quê

Dois itens dependem de coisa que este worktree não tem. Nenhum foi marcado
como feito.

**T133 — axe nas seis telas (SN-10).** Precisa do app rodando. O layout do
Scaffold consulta `TenantModule` antes de renderizar qualquer coisa, então sem
banco não há tela para auditar. O que o design já entrega e não foi verificado
por ferramenta: alvo de 44px em `@media (pointer:coarse)` e `generateMetadata`
na rota única.

**T124 — e2e `scaffold-track-lifecycle.spec.ts` (SC-001).** Mesmo motivo:
precisa de Postgres.

Fora do escopo dos gates, herdado das fatias e já registrado nos docs delas:
`publishVersion` e `exportBusinessCase` não têm gatilho de UI; edição de
métrica no detalhe de baseline é somente leitura; `SigningSheet` do protótipo
não foi portado; notificação de estagnação grava auditoria mas não envia.

---

## Nota sobre o gate de lint

O `biome check apps packages` do repo devolve ~1130 erros pré-existentes, e a
contagem varia entre execuções porque a saída é truncada. Comparar totais
antes/depois **não** funciona como prova de não-regressão — o diff de execuções
acusou arquivos que este trabalho nunca tocou (`apps/api/webhooks`,
`.design-ref/`).

A verificação que vale é por arquivo: rodar `biome check` em cada caminho
alterado, um a um. Todos deram zero. Vale lembrar disso na próxima fatia — o
caminho por totais custou duas rodadas de stash e não concluiu nada.

---

## Padrão que se repetiu, pela quarta vez

Três testes estáticos meus casaram regex com **comentário** em vez de código
(`adr-0013-boundary`, o de ST-03 em `templates`, e o de arquitetura de gates), e
um casou um `where` de leitura achando que era escrita. O conserto foi sempre o
mesmo: tirar comentários antes de aplicar a regex, e ancorar no ponto real de
escrita (`scaffoldPhaseInstance.update`) em vez de no literal do valor.

Um teste estático que lê o próprio comentário explicativo como violação não
está protegendo invariante nenhuma — está medindo prosa.
