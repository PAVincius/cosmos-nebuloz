# Signal — medição de adoção e valor de iniciativas de IA

**Data**: 2026-09-02
**Spec**: [`specs/003-signal-measure/`](../../specs/003-signal-measure/)
**Origem**: projeto Claude Design `signal.html` (+ `charter-base.jsx`, `charter-modal.jsx`, `cosmos-icons.jsx`, `cosmos-kit.jsx`)
**Branch**: `claude/signal-html-implementation-636f46`

O quarto módulo da plataforma, ao lado de Cosmos, Charter e Meridian. Responde
uma pergunta que a maioria dos painéis de IA não responde: **o que foi comprado
está sendo usado, e o uso virou dinheiro?**

---

## A regra que organiza o módulo

> Adoção e resultado moram juntos. ROI nunca aparece sem versão de fórmula e
> confiança.

Ela não é uma diretriz de estilo — é estrutural. O componente `ValueReading`
(`components/signal/verdict-badge.tsx`) não aceita renderizar um múltiplo sem
receber `formulaVersion` e `confidence`, e o tipo `ReportInitiativeLine`
(`lib/signal/report-payload.ts`) carrega os três campos juntos. Um relatório
congelado com múltiplo e sem versão não compila.

O motivo é o vício que o produto existe para corrigir: adoção alta sozinha
permite celebrar uso que não virou dinheiro, e ROI sozinho permite defender um
número que ninguém consegue contestar.

---

## O que foi entregue

**90 das 93 tarefas · 10 telas · 416 testes**

As três que faltam são de verificação com a aplicação rodando (T090 desempenho,
T091 comparação visual) e T093, verde no que é do Signal e vermelho em falhas
herdadas — detalhe no fim deste documento.

| Camada | Onde |
|---|---|
| Schema | `packages/database/prisma/schema/signal.prisma` — 18 modelos, 13 enums |
| Migration | `packages/database/prisma/migrations/20260902090000_signal_measure/` — 742 linhas, DDL + RLS + seed de regras de confiança |
| Seed | `packages/database/seed-signal.ts` — 9 iniciativas, 6 conexões, 8 mapeamentos, 5 alertas, 4 relatórios |
| RBAC | `packages/rbac/src/signal-matrix.ts`, `signal-resolve.ts` — `SignalRole {VIEWER, OWNER, ANALYST, ADMIN}`, 13 permissões, sem curinga |
| Motor puro | `apps/app/lib/signal/` — roi, confidence, verdict, adoption, outcome, lifecycle, health, portfolio, alerts, report-payload, guards, errors |
| Actions | `apps/app/app/(signal)/actions/` — 13 arquivos |
| Telas | `apps/app/components/signal/screens/` — 10 |
| E2E | `apps/app/e2e/signal-{journey,tenant-isolation,a11y}.spec.ts` |

**As dez telas**: visão geral, iniciativas, detalhe da iniciativa, conexões,
mapeamento, evidências, alertas, relatórios, auditoria, configuração.

---

## Decisões revisadas durante a implementação

### 1. `invested` e `returned` saíram do schema

O `data-model.md` original tinha as duas como colunas. Foram removidas: são a
soma das entradas da fórmula ativa, e guardar o total ao lado das partes é
exatamente o defeito que o protótipo tinha (score de confiança 86 ao lado de
fatores somando 93). Tudo derivado na leitura: múltiplo, investido, retornado,
score, adoção, veredito.

### 2. O switcher de persona não foi portado

O protótipo trocava a ênfase da leitura por persona. Não foi portado porque a UI
prometeria um recorte que o servidor não aplica — e a primeira suspeita de quem
vê um seletor de persona é que existe dado escondido atrás da outra. O teste
`signal-tenant-isolation.spec.ts` trava a ausência.

### 3. `SignalRuleError` 422 / `SignalStateConflictError` 409 em módulo próprio

`safeAction` (usado no app inteiro) descarta o `code` do erro, então a regra
nomeada nunca chegaria à UI. Em vez de mexer no `_base.ts` de todo mundo, o
Signal tem `signalAction` local. E os erros vivem em `lib/signal/errors.ts` sem
nenhum import: qualquer arquivo que só precisasse do `instanceof` arrastava
`@repo/auth/server` → better-auth → Prisma.

### 4. `window.prompt` virou formulário

O motivo de encerramento de uma iniciativa é o texto que o comitê lê e que fica
na trilha para sempre. Uma caixa do navegador não tem contador, não tem rótulo,
não é estilizável e é ignorada por parte dos leitores de tela.

### 5. Múltiplo `0` de rascunho não é "não rende"

Bug real, pego pelo teste de limiares dos alertas: `computeRoi([])` devolve
múltiplo `0` para iniciativa sem nenhuma entrada de fórmula — isso é "rascunho",
não "retorno zero". Sem a tradução para `null` em `actions/alerts.ts`, a regra
WEAK acusaria de fracasso quem ainda nem lançou a primeira linha da conta.

### 6. As barras do portfólio vinham hardcoded

A tela de visão geral tinha `{ adoptionBar: 60, valueBar: 1.5 }` em cópia local.
As réguas são por tenant; uma cópia divergiria das que produziram os vereditos
exibidos ao lado. Hoje viajam no `PortfolioSummary`, com teste travando.

### 7. `listConfidenceRules` foi adicionada

A tela de configuração precisava LER os fatores e só havia `setConfidenceRules`.
Cai no catálogo padrão quando o tenant nunca configurou — devolver lista vazia
daria um formulário em branco cujo primeiro salvamento quebraria a soma 100.

### 8. Os E2E ficaram em `apps/app/e2e/`, não em `__tests__/signal/e2e/`

O `tasks.md` pedia o segundo caminho; o `playwright.config.ts` do repositório
tem `testDir: "./e2e"`. Seguir a tarefa deixaria três specs que o runner nunca
executa.

---

## Verificação

| Checagem | Resultado |
|---|---|
| `vitest run __tests__/signal/` | **416 passando**, 0 falhando |
| `tsc --noEmit` | limpo |
| `ultracite check` (árvore Signal) | zero erro |
| Cobertura (25 arquivos Signal) | **linhas 88,0%** · statements 87,5% · funções 79,4% · branches 77,9% |
| Motor puro (`lib/signal/*`) | 100%, exceto `report-payload.ts` 93,3% |
| Guards | 100% |
| Congelamento de relatório | `reports.ts` 90,4% |
| `pnpm --filter app build` | **verde** — `/signal/[[...seg]]` e `/signal-indisponivel` no manifesto |

Funções e branches ficaram pouco abaixo de 80%: o que falta é ramo de erro em
`initiatives.ts` (67,5% de linhas — o arquivo maior do módulo) e caminhos de
`evidence.ts`/`confidence.ts`. As linhas passam o piso; as duas outras dimensões
não.

### `pnpm check` e `pnpm build` no monorepo inteiro

Os dois falham, e nenhuma das falhas é deste trabalho:

- `pnpm check` — 2 erros `lint/suspicious/useAwait` em
  `apps/api/app/webhooks/payments/route.ts`, arquivo que este trabalho não
  tocou. A árvore do Signal passa com zero erro.
- `pnpm build` — `api#build` e `web:build` param em **variável de ambiente
  ausente** (chaves de `@repo/auth`, `BASEHUB_TOKEN`), não em código.
  `pnpm --filter app build` passa e emite as rotas do Signal.

### O que NÃO foi verificado, e por quê

- **Nenhuma tela foi vista rodando.** Isso exige sessão autenticada, e eu não
  digito senhas. A verificação foi: testes, `tsc`, lint, asserções no banco e
  logs de compilação do dev server.
- **T086–T088 (E2E) foram escritos, não executados.** Precisam de dev server +
  banco semeado + `AUTH_TEST=1`.
- **T090 (p95 com 50 iniciativas)** e **T091 (comparação com os screenshots do
  protótipo)** não foram executados — os dois exigem a aplicação rodando com
  sessão.

---

## Achados que extrapolam o módulo

1. **RLS não é exercitada em dev.** A aplicação conecta como `postgres`, que é
   `rolsuper` e `rolbypassrls`. As políticas do Signal estão corretas e nunca
   são aplicadas localmente — um bug de vazamento entre tenants na camada de
   aplicação não seria pego pelo banco em desenvolvimento.
2. **Meridian não tem RLS nenhuma** na migration dele. Charter e Cosmos têm.
3. **Quatro tabelas comerciais sem migration**: `PlanoComercial`,
   `PrecoDeModulo`, `TermoDeContrato`, `AddOnComercial` — existem no schema desde
   o commit `8cc7bde9`.

---

## O que ficou para a V1.5

- **Conectores reais.** `SignalConnection.kind` é texto livre e `config` é Json
  justamente para não hardcodar fornecedor. O que existe hoje é a ingestão
  manual e por mapeamento; falta o cliente de cada fonte e o cofre de
  credenciais (`integrations-vault`).
- **Benchmarking entre organizações** — comparar múltiplo por categoria contra
  uma base anônima.
- **Histórico de versões de mapeamento na tela.** As versões anteriores já ficam
  no banco e as observações apontam para elas; falta a tela que as mostra.
- **Exportação em PDF.** Hoje o `exportReport` devolve o `payload` congelado e a
  tela baixa JSON. O documento formatado sai do mesmo payload — nunca da tela.
