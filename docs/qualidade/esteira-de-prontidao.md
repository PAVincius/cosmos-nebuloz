# Esteira de prontidão — do roteiro de dogfood ao veredito

Como levar **um produto** da Nebuloz (Meridian, Scaffold, Signal, Charter, Cosmos, back-office) do "não sei" a um parecer de prontidão para cliente externo, sem começar do zero. Foi feito a partir do Meridian (`docs/qualidade/prontidao/meridian.md`, dogfood de 2026-09-29, k6 do respondente) e serve igual para os outros cinco.

Este documento é o **como**. O **porquê** e a ordem dos produtos estão em `docs/qualidade/2026-09-23-plano-dogfood-esteira.md` (Meridian → Scaffold → Charter → Cosmos → Signal; back-office fora do plano original) e a regra de maturidade em `docs/produto/regra-maturidade-e-carga.md`.

## O que sai no fim

| Entrega | Onde | Modelo |
|---|---|---|
| Roteiro de dogfood do produto | `docs/qualidade/dogfood/<produto>/roteiro.md` | `docs/qualidade/dogfood/_roteiro-modelo.md` |
| Diário e atritos das rodadas | `docs/qualidade/dogfood/<produto>/diario.md`, `atrito.md`, `evidencias/<data>/` | idem (fim do modelo) |
| Script de carga | `apps/app/load/k6/<produto>-<fluxo>.js` (**único lugar** dos scripts k6; a lib comum está em `apps/app/load/k6/lib/`) | `apps/app/load/k6/README.md` |
| Parecer de prontidão com veredito | `docs/qualidade/prontidao/<produto>.md` | `docs/qualidade/prontidao/_modelo.md` |

## Três regras antes de começar

1. **Só marque como cumprido o que tem fonte** (arquivo, teste, comando, commit, parecer). Sem fonte é "não avaliado", que conta como não apto na prática.
2. **Local é livre; produção é leitura.** Tudo até o passo 9 roda no local. Escrita em produção só no passo 10, com "vai" do CEO **por operação** (nada de "vai" geral) e conferindo o alvo antes. Sessões `<app>-prod` do agent-browser são só leitura (open, snapshot, screenshot, get, read).
3. **Uma coisa por vez.** Um `next dev` por vez e só na porta 3012 (back-office na 3013); Playwright um spec por vez; nada de suíte inteira (`pnpm test`, `turbo test`) fora do hook do push. A máquina satura (Biome e testes já caíram por memória).

## Passo 0 — Ambiente local (uma vez por produto)

```bash
cd /Users/azos/web-office/my/cosmos-nebuloz
git fetch github main
git worktree add -b qa/<produto>-prontidao /Users/azos/web-office/my/wt-<produto> github/main
cd /Users/azos/web-office/my/wt-<produto>
pnpm install --frozen-lockfile --prefer-offline       # ~30 s; os hooks de commit e push precisam do node_modules
M=/Users/azos/web-office/my/cosmos-nebuloz
ln -sf $M/apps/app/.env.local apps/app/.env.local     # aponta o app para o banco local (cosmos_dev, localhost:5434)
ln -sf $M/packages/database/.env packages/database/.env
(cd packages/database && npx prisma generate)
(cd packages/database && DATABASE_URL=postgresql://postgres:postgres@localhost:5434/cosmos_dev npx prisma migrate deploy)
cd apps/app && pnpm seed:e2e && pnpm seed:<produto> ...   # ver a tabela de seeds abaixo
```

- **Confira o alvo antes de qualquer comando que escreve**: `DATABASE_URL` tem de ser `localhost`. O disco também: dois `next dev` e um `next build` chegaram a deixar menos de 1 GiB; apague `apps/app/.next` ao fim de cada rodada.
- **Storage** (upload de evidência, entregável): o Supabase local tem de estar de pé (`docker ps` mostra `supabase_*_cosmos-nebuloz`; `docs/runbooks/supabase-local.md`). O `.env.local` já aponta para `127.0.0.1:54321`.
- Os hooks do repositório rodam Biome no commit e `turbo test` no push (~2,5 min, precisa do banco local). Nunca `--no-verify`.

| Produto | Seeds locais (em `apps/app`, salvo indicação) | Contas de teste (senha local do seed) |
|---|---|---|
| Meridian | `pnpm seed:e2e`; `pnpm seed:meridian cosmos-dev`; carga: `pnpm seed:meridian:load` | `marina.duarte@nebuloz.exemplo` (consultora, `meridian123`) |
| Scaffold | `pnpm seed:e2e`; `pnpm seed:scaffold-e2e`; em `packages/database`: `pnpm seed:scaffold`, `pnpm seed:modelos` | `admin@cosmos.local` (consultor) e `po@cosmos.local` (dono do processo), `Cosmos@2026!` |
| Charter | `pnpm seed:e2e`; `pnpm seed:charter cosmos-dev` | `admin@cosmos.local` (Compliance), personas do seed (`charter123`) |
| Signal | `pnpm seed:e2e`; em `packages/database`: `pnpm seed:modelos` | `admin@cosmos.local` (ADMIN do Signal); outros papéis por `Configurações` |
| Cosmos | `pnpm seed:e2e` (papéis SAFe: `ste`, `rte`, `po`, `sm`, `dev`, `member` `@cosmos.local`) | `Cosmos@2026!` |
| Back-office | `pnpm seed:tenants`, `pnpm seed:admin`; app na 3013 (`apps/backoffice`) | ver `docs/runbooks/backoffice-dev.md` |

Os nomes de seed mudam: confira em `apps/app/package.json` e `packages/database/package.json` antes de rodar. O `seed:e2e` **apaga** os dados do tenant `cosmos-dev` antes de recriar; o `globalSetup` do Playwright roda os seeds sozinho e também reseta as sessões.

## Passo 1 — Gate de maturidade: o que precisa estar de pé

O gate tem três critérios (regra de maturidade e carga, Norte/CEO, 2026-09-26):

- **C1 — SC formal verde no E2E.** Existe um Success Criterion escrito no PRD (não basta ter suíte), cobrindo a jornada da persona principal, e o E2E correspondente passou, com data.
- **C2 — Dogfood sem P0/P1 aberto.** Nenhum P0/P1 sem resolução; todo P2 aberto tem dono **e** data.
- **C3 — Compliance quando aplicável.** Se o produto coleta dado de terceiro, há parecer do Lacre e as condições dele para o estágio atual estão cumpridas.

Resultado: **apto** (três cumpridos), **não apto** (lista os que falharam) ou **não avaliado** (falta evidência; conta como não apto). A carga "de verdade" só vale como validação depois de C1 e C2.

Comece lendo: `docs/produto/<produto>-prd.md` e `-srd.md`, o `specs/NNN-<produto>/spec.md`, `.maestri/knowledge/<produto>/note.md`, o `.claude/completions/` recente e `docs/qualidade/dogfood/<produto>/` (se existir). Liste os SC do PRD; se **não há SC formal**, o primeiro item das condições é escrevê-los (Regua escreve, Norte aprova).

## Passo 2 — Roteiro de dogfood

Copie `docs/qualidade/dogfood/_roteiro-modelo.md` para `docs/qualidade/dogfood/<produto>/roteiro.md` e preencha um passo por tela ou ação, na ordem que o cliente faria, começando "do zero" (nada criado à mão) e terminando no que o próximo produto consome. Todo SC precisa de pelo menos um passo. Marque em cada passo se escreve em produção.

## Passo 3 — E2E dos SC (local)

```bash
cd apps/app                     # o comando falha ("No projects matched") se rodar da raiz do worktree
AUTH_TEST=1 pnpm exec playwright test e2e/<produto>- --grep-invert load --reporter=list
AUTH_TEST=1 pnpm exec playwright test e2e/<produto>-load --reporter=list     # carga do seed, separado
npx vitest run __tests__/<produto>          # testes de unidade, sempre por arquivo ou pasta
npx tsc --noEmit                            # em apps/app
```

- Um spec por vez em máquina saturada. Cada falha vira item com causa (arquivo e linha) e dono; **QA não corrige código de produto**.
- **Não crie arquivo de teste temporário dentro de `e2e/`** (o hook trava). Se precisar de uma cópia descartável, avise antes e apague uma vez só, no fim.
- Primeiro teste de uma rodada pode estourar o timeout de 30 s por compilação a frio do `next dev`: rode de novo com o cache quente antes de chamar de defeito.
- Registre no parecer (C1): o comando, o resultado (`N/N`), o hash e a data.

## Passo 4 — Dogfood no navegador (local)

```bash
# sobe o app (um de cada vez) e abre a sessão do Portal do produto, que o CEO acompanha ao vivo
cd apps/app && npx next dev --port 3012 &
bash .maestri/portal/abrir.sh <meridian|scaffold|signal|charter|cosmos|backoffice> local
export AGENT_BROWSER_SESSION=<produto>-local
agent-browser snapshot -i                   # refs @eN; refaça o snapshot depois de cada mudança de tela
agent-browser fill 'input[type="email"]' "<conta>"; agent-browser click 'button[type="submit"]'
agent-browser screenshot docs/qualidade/dogfood/<produto>/evidencias/<data>/<passo>.png
```

Execute o roteiro passo a passo, registrando no `diario.md` (seção "Rodada local · <data>") o que viu, e cada tropeço em `atrito.md` com severidade, tela, passo de reprodução e dono. Dicas que já custaram tempo:

- `fill` **não preenche** `input type=date` nativo: foque o campo e envie as teclas (`agent-browser press 3 0 1 1 2 0 2 6`).
- Usar `find role button click --name "..."` sobrevive melhor a mudança de refs do que `@eN`.
- Erro de build do Next aparece como diálogo "Build Error": conte com `agent-browser snapshot | grep -c 'Build Error'` depois de abrir cada rota.
- Um teste que leu ou criou dado de uma seed some no próximo `seed:e2e`; anote o id do que criou antes.
- Papel só-leitura e papel sem permissão também são passos do roteiro: entre com cada papel e confira que o botão fica desabilitado **com motivo** e que a recusa do servidor não derruba a tela.

## Passo 5 — Acessibilidade e teclado (telas e modais novos)

```bash
agent-browser a11y --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa --json > /tmp/axe-<tela>.json
```

Meta: 0 violações nas telas e modais que o produto entregou (abra o modal **antes** de rodar). `color-contrast` costuma vir "incomplete" quando o fundo é gradiente: registre como "não verificado, conferir manual", não como verde. Em modal, confira à mão: foco entra e fica preso (Tab cicla), Esc fecha, foco volta ao botão de origem, todo controle tem rótulo. Fica de fora do parecer se o produto ainda não tem tela.

## Passo 6 — Carga (k6, local)

Fluxo de carga e criação do script: `apps/app/load/k6/README.md`. Hoje há dois exemplos prontos: `meridian-responder.js` (onda de respondentes) e `meridian-concorrencia.js` (SC-011, dois cenários: consultores e respondentes); não crie scripts fora de `apps/app/load/k6/`. Em resumo:

```bash
cd apps/app
npx tsx load/k6/prepare-<produto>-<fluxo>.ts 50
k6 run --vus 1 --iterations 1 load/k6/<produto>-<fluxo>.js       # fumaça: todos os checks verdes e o dado gravado
k6 run -e SUMMARY_FILE=/tmp/k6-<produto>.json load/k6/<produto>-<fluxo>.js
```

Rode contra `next dev` **e** contra `next build && next start -p 3012` (o build de produção local ocupa ~3 GiB em `.next`; confira o disco). O parecer registra as duas linhas e diz, sempre, que o resultado **não mede a infraestrutura de produção**. Carga em produção não é permitida pelos scripts (a trava recusa `*.nebuloz.ai`).

## Passo 7 — Compliance

Peça o parecer ao Lacre com: o fluxo (quem é titular, que dado coleta, onde guarda), os arquivos, o que o roteiro faz em produção e a retenção. O parecer devolve **condições por estágio** (dogfood interno vs. cliente externo). Copie cada condição para o parecer de prontidão com estado (cumprida, pendente), dono e se bloqueia. Produto que não coleta dado de terceiro marca C3 como "não se aplica" e diz por quê. Nunca redija o parecer de compliance no lugar do Lacre.

## Passo 8 — Produção × local (só leitura)

Registre o que muda a leitura do veredito e **como você sabe**:

- Deploy e logs: Vercel (projetos `cosmos-nebuloz-app`, `cosmos-nebuloz-backoffice`, `cosmos-nebuloz-api`, `nebuloz-web`) pelo conector; PRs e commits pelo `gh`. Cite o que viu (hash do deploy, status).
- Dependências de infra (Inngest, Storage, chaves): runbooks em `docs/runbooks/` e pareceres; se você não viu no próprio lugar, escreva "não conferi" e a fonte.
- Diferença entre `github/main` e o `main` local: rode `git rev-list --left-right --count github/main...main`; commits e documentos só locais não estão no ar nem no PR.
- **Sem credencial de produção**: não vasculhe variáveis de ambiente; "vai" do CEO não dá acesso a segredo.

## Passo 9 — O parecer

1. Copie `docs/qualidade/prontidao/_modelo.md` para `docs/qualidade/prontidao/<produto>.md` e preencha tudo (evidências dos passos 3 a 8).
2. Veredito separado: dogfood interno e cliente externo.
3. Tabela de condições: cada uma verificável, com dono, "bloqueia?" e tamanho.
4. Commit em PT-BR no formato convencional, **sem** trailer `Co-Authored-By` (`docs(qualidade): prontidão do <produto> para cliente externo`).
5. `git push -u github docs/prontidao-<produto>` (roda o hook; leva ~2,5 min) e `gh pr create --base main` com o resumo do veredito, os PRs de que depende e o teste (hook verde).
6. Derrube o servidor e apague `apps/app/.next` no fim; remova os symlinks de `.env` do worktree.

## Passo 10 — Produção (só com "vai" do CEO, por operação)

Roda **depois** do parecer apontar as condições de infra e compliance resolvidas (passo 8) e só se o roteiro marcar o passo como escrita em produção. Não é do agente decidir o momento.

### Antes de cada rodada em produção (pré-condição, R3 do pre-mortem)

O parecer de prontidão e os pareceres do Lacre falam de commits específicos (a retenção de 90 dias, o aviso ao respondente, uma correção). Um parecer "cumprido" sobre código que **não está no ar** não vale. Antes de **cada rodada** (não só da primeira):

1. **O commit está em `github/main`?** `git fetch github main && git merge-base --is-ancestor <hash-citado> github/main && echo sim`. Hash que só existe no `main` local não está no ar (já aconteceu: o aviso com os 90 dias do Meridian).
2. **O deploy de produção contém esse commit?** Pela Vercel (conector ou painel), pegue o deployment mais recente do projeto do produto com alvo production e estado READY, leia o **sha** do commit dele, e prove: `git merge-base --is-ancestor <hash-citado> <sha-do-deploy> && echo sim`. Registre no diário o `dpl_...`, o sha e a resposta.
3. **Se qualquer resposta for "não", a rodada não começa.** Peça ao dono levar o commit ao ar (PR mergeado e deploy READY) e repita as duas conferências.
4. Confirme também as dependências de infra que o parecer exige (chaves e jobs, por exemplo: o endpoint de funções responde 200) pela fonte que o seu papel enxerga, e anote "não conferi" o que não enxergar.

### Respondente externo de confiança (produtos com titular sem conta)

O dogfood só de agentes e perfis sintéticos não exercita o caminho que o cliente vai viver: convite chegando a uma pessoa de fora, aviso ao titular, link, envio e eliminação. Para esses produtos, inclua na rodada de produção **uma pessoa externa de confiança, com e-mail real**, que aceite participar:

- Combine antes, por escrito, que os dados são reais, para que servem e por quanto tempo ficam (o que o aviso na tela diz); a Nebuloz é operadora, o titular é a própria pessoa.
- Ela é titular real: o convite, a resposta e a **eliminação a pedido** entram no roteiro (pedido de eliminação dela, conferência de que sumiu). Confirme com o Lacre que o aviso e o texto do convite estão de acordo antes de enviar.
- Use só dado que ela concorde em fornecer; evidência de teste sem informação sensível.
- Registre no diário que a participante é real (sem colar o e-mail no repositório: use "respondente externo A").

Para cada operação:

1. Antes: confira o alvo (URL do deploy e, quando for banco, o host do `DATABASE_URL`), o estado do deploy (READY, hash) e que o nome do recurso novo não coincide com um existente.
2. Peça o "vai" **daquela** operação, dizendo o que escreve, quantos registros, se é reversível e o que fazer se falhar.
3. Só então opere (o CEO, ou o agente com o "vai" registrado). Uma operação por vez; espere o resultado antes de pedir a próxima.
4. Registre no `diario.md`: quando, passo, "vai" (quem e hora), quem operou, resultado (OK ou FALHOU, sem apagar a falha), evidência.
5. Afirme estado de produção ("no ar", "migration aplicada", "mergeado") só depois de ver no próprio lugar (PR no GitHub, deploy na Vercel, banco), citando o que viu.

### O que é só local e o que exige "vai"

| Atividade | Local | Produção, leitura | Produção, escrita ("vai" por operação) |
|---|---|---|---|
| Seeds, E2E, vitest, tsc | ✅ | — | nunca |
| Dogfood, axe, teclado | ✅ | — | passos do roteiro marcados "Escreve em prod: Sim" |
| k6 | ✅ (localhost) | — | contra infra real só com "vai" e alvo que não seja produção (ver o plano da condição 9) |
| Ver deploy, logs, PR, runbook | — | ✅ | — |
| Migration em produção | nunca pelo QA | conferir estado | só a Infra, depois do QA, um por vez no canvas |
| Reset de dados, DROP de backup, mudança de chave (Inngest etc.) | nunca pelo QA | conferir estado | Infra/Pilar com "vai" do CEO |

## Onde cada produto costuma parar (para dimensionar)

Estado conferido em 2026-09-29; confira de novo antes de planejar.

| Produto | Já existe | Costuma faltar |
|---|---|---|
| Meridian | PRD com SC-001..010, roteiro, diário, E2E `meridian-*`, k6 do respondente, parecer do Lacre | condições do parecer de compliance e infra em produção (`prontidao/meridian.md`) |
| Scaffold | E2E `scaffold-track-lifecycle`, parecer de prontidão de 2026-09-29 (`prontidao/scaffold.md`) | SC formal no PRD, dogfood registrado, compliance |
| Signal | E2E `signal-*` | SC formal no PRD, dogfood, compliance, criar o script k6 |
| Charter | E2E `charter-*` | SC formal no PRD, dogfood, compliance (dado de fornecedor), script k6 |
| Cosmos | E2E amplo (`portfolio-*`, `epic-drilldown`, etc.) | SC formal no PRD, dogfood, script k6 |
| Back-office | app na 3013 | E2E, SC formal, dogfood, compliance (é painel de staff) |

Ordem sugerida: seguir a esteira (Meridian, Scaffold, Charter, Cosmos, Signal) e deixar o back-office por último; cada produto herda o roteiro e o k6 do anterior como exemplo.
