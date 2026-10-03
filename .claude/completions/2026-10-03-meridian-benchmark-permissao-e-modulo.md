# Meridian: permissão do `withdrawContribution` e miolo fora de `use server` (achados 11 e 7 do Vigia)

Branch `fix/meridian-benchmark-permissao-e-modulo`, a partir de github/main (e45be667, já com #367 e #368).

## 11 (MÉDIO) `withdrawContribution` sem checagem de papel
Só pedia `requireMeridianContext`: VIEWER e REVIEWER retiravam o consentimento de benchmark e apagavam a contribuição de qualquer assessment do tenant. Agora exige `assessment.manage` (só CONSULTANT na matriz), a mesma permissão de criar o assessment com o opt-in ligado. Teste por papel com o guard real (sessão, módulo e papel mockados no limite, matriz real): VIEWER, REVIEWER e quem não tem papel são recusados sem tocar em assessment, contribuição, coorte nem trilha; CONSULTANT retira, apaga e deixa a trilha. A action não tem chamador na UI hoje, então nada de tela muda.

## 7 (BAIXO) `contributeInTx` e `runScoringInTx` exportadas de arquivo `use server`
Todo export assíncrono de arquivo `"use server"` vira endpoint. As duas recebem um cliente de transação e o contexto do ator: não são ações. Foram para módulos sem `"use server"`, com `import "server-only"`:
- `app/(meridian)/actions/_benchmark-core.ts`: `contributeInTx` e `recalculate` (que `withdrawContribution` também usa).
- `app/(meridian)/actions/_scoring-core.ts`: `runScoringInTx`, `AxisScoreOut`, `deriveGapIfMissing` e `derivedFrom`.
`benchmark.ts` e `scoring.ts` ficam só com ações; `collection.ts` importa `runScoringInTx` do módulo novo. Teste de arquitetura (`use-server-architecture.test.ts`): nenhum arquivo `"use server"` do Meridian exporta função cujo primeiro parâmetro é `db`; os módulos de miolo existem e não são `use server`. Os mocks dos testes de coleta e scoring apontam para os caminhos novos.

## Verificação
- Testes novos, vermelhos antes (as duas recusas por papel falhavam; a guarda achava exatamente as duas funções): `benchmark-withdraw-roles.test.ts` (5) e `use-server-architecture.test.ts` (3).
- `vitest` de meridian, screens, lib e components: 1212 passando; biome limpo; `tsc` sem erro fora do `@repo/rbac` velho do checkout principal (30 erros fixos de Scaffold, do ambiente).

## Fora do escopo
- A guarda de arquitetura cobre só o Meridian. Os outros produtos (`(scaffold)`, `(charter)`, `(cosmos)`) não foram varridos por funções exportadas de `use server` que recebem `db`. Vale o Vigia olhar.
