# Signal — fundação (Fases 1 e 2)

**Data**: 2026-09-02 · **Branch**: `claude/signal-html-implementation-636f46`
**Spec**: [`specs/003-signal-measure/`](../../specs/003-signal-measure/) · **Tarefas**: 35 de 93

Porta do `signal.html` (Claude Design `691f7fe5`) para o monorepo, como quarto
módulo da plataforma. Este doc cobre a fundação: banco, papéis, guards, motor de
cálculo e casca. As 10 telas e as ~30 server actions de domínio ficam para as
Fases 3–9.

## Entregue

| Camada | Onde |
|---|---|
| Schema | `packages/database/prisma/schema/signal.prisma` — 18 modelos, 13 enums |
| Migration | `prisma/migrations/20260902090000_signal_measure/` — DDL + RLS + seed do catálogo de confiança |
| Seed | `packages/database/seed-signal.ts` — 9 iniciativas, 6 conexões, 8 mapeamentos, 5 alertas, 4 relatórios |
| RBAC | `packages/rbac/src/signal-matrix.ts` + `signal-resolve.ts` — 13 permissões × 4 papéis |
| Guards | `apps/app/lib/signal/guards.ts` — 5 portões, erros 403/409/422 |
| Auditoria | `apps/app/app/(signal)/actions/_shared.ts` — trilha transacional, `nextCode` atômico |
| Motor puro | `apps/app/lib/signal/{roi,confidence,verdict,adoption,outcome}.ts` |
| Casca | `apps/app/components/signal/` + `app/(signal)/` + `app/signal-indisponivel/` |

**Verificação**: 159 testes do Signal + 83 do RBAC verdes · `tsc --noEmit` sem
erro · lint limpo · migration aplicada e asseverada no banco · rotas compilam e
o guard redireciona.

## Decisões que divergiram do plano

**1. `invested`, `returned` e `score` deixaram de ser colunas.**
Ao transcrever o protótipo para as fixtures, 2 dos 8 casos não fechavam com as
próprias listas: a IN-031 tinha `returned` 379.200 contra componentes somando
421.760 (o desconto de atribuição de 70% aplicado uma vez no mapeamento MP-04 e
de novo no total), e a IN-014 tinha `score` 86 contra fatores somando 93.
Guardar o total ao lado das partes é o que permite essa divergência existir — e
é exatamente o que este produto existe para impedir. Agora tudo é derivado.

**2. O switcher de persona não foi portado.**
No handoff ele trocava a lente de leitura. Sem regra de ordenação especificada,
seria um controle que não muda nada; e se mudasse o que a pessoa *pode ver*,
seria escalada de privilégio por dropdown. O Meridian deixou o dele de fora pelo
mesmo motivo. O papel real aparece no topbar. Registrado em `ui-contract.md` §3.

**3. O tom do resultado virou regra declarada.**
O `outcome.tone` do protótipo não é reproduzível (−7% ficou vermelho, −8% ficou
âmbar) — era cor de narrativa. A regra implementada é: piorou → vermelho;
melhorou < 10% → âmbar; ≥ 10% → verde; sem número comparável → neutro.

**4. `pnpm migrate` não faz `db push`.**
O `CLAUDE.md` diz que sim; o script real é `format + generate + migrate deploy`.
O repo trabalha com arquivos de migration. Vale corrigir o `CLAUDE.md`.

## Três achados fora do escopo desta feature

**A. RLS não é exercida em desenvolvimento.**
O app local conecta como `postgres`, que é `rolsuper` **e** `rolbypassrls`. As
policies do Signal estão corretas e completas (`ENABLE` + `FORCE` + `USING` +
`WITH CHECK`, verificado por asserção nas 18 tabelas), mas **nenhuma delas é
aplicada localmente**. Consequência prática: um bug de cross-tenant no código da
aplicação não seria pego pelo banco em dev — só em produção, se lá o papel não
for superuser. O Princípio I da constituição ("RLS força isolamento no banco")
não é verificável no ambiente onde se desenvolve. Vale checar qual papel a
aplicação usa em produção e, em dev, criar um papel sem `BYPASSRLS`.

**B. As tabelas do Meridian não têm RLS.**
A migration `20260829120000_meridian_diagnose` não contém `ENABLE ROW LEVEL
SECURITY` para nenhuma tabela `Meridian*`. O Charter tem (bloco no
`20260728120000_charter_module`), o Cosmos tem (`20260603000001`). O Meridian
ficou de fora. Em produção, com papel não-superuser, isso significa que as
tabelas de diagnóstico dependem só do código para isolamento.

**C. Quatro tabelas no schema sem migration.**
`PlanoComercial`, `PrecoDeModulo`, `TermoDeContrato` e `AddOnComercial` existem
em `comercial.prisma` mas nenhuma migration as cria — vieram do commit
`8cc7bde9 feat(comercial)`. Apareceram no diff do banco e foram deliberadamente
excluídas da migration do Signal, junto com dois `DROP CONSTRAINT` em
`MeetingParticipant` que o mesmo diff trazia.

## O que falta

- **Fase 3 (US1)** — iniciativa + baseline · 8 tarefas
- **Fase 4 (US2)** — detalhe com adoção, resultado, ROI, confiança e veredito · 10 tarefas · **fecha o MVP**
- **Fases 5–9** — portfólio, fontes, alertas, relatórios, auditoria · 32 tarefas
- **Fase 10** — E2E, axe, cobertura · 8 tarefas

## Nota de verificação

A casca **não** foi verificada visualmente. O servidor sobe, as rotas compilam e
o guard redireciona para o login, mas ver a sidebar, o card de portfólio e o
chip de fontes renderizados exige uma sessão autenticada — e preencher senha não
é algo que eu faça. Quem for validar: suba `pnpm --filter app dev`, entre com o
usuário do `seed-admin`, e abra `/signal`.
