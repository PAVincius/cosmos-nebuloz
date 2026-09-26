# Back-office de dev (ambiente separado do Meridian)

CEO decidiu em 2026-09-24: o laboratório de usabilidade do Meridian precisa
de um back-office rodando fora de produção — branch, banco e deploy
próprios. Produção (`aosdvvluokrbgpyqwoor`) não é tocada em nenhum passo.

> **NUNCA alterar o projeto Vercel `prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N`**
> (nome `cosmos-nebuloz-backoffice`, domínio `backoffice.nebuloz.ai`) — é o
> projeto de **produção** real, confirmado via Vercel MCP
> (`list_projects`/`list_project_domains`, time
> `team_CjCBX0DGD7HIlBL4MRqQmNzS`). O projeto novo deste runbook tem nome e
> `projectId` diferentes — todo passo abaixo que mexe em Vercel cita o
> `projectId` alvo explicitamente. Se um passo não citar `projectId`, pare
> antes de executar.

## Arquitetura alvo

- **Repo**: GitHub `PAVincius/cosmos-nebuloz`, branch `dev` criada a partir de
  `main`.
- **Banco**: projeto Supabase novo `nebuloz-dev` — nasce vazio, migrations do
  repo aplicadas por cima, depois seed mínimo. Mesma região do projeto de
  produção (`aosdvvluokrbgpyqwoor`).
- **Deploy**: projeto Vercel novo **`cosmos-nebuloz-backoffice-dev`** (nome
  diferente do projeto de produção `cosmos-nebuloz-backoffice`, de propósito
  — ver aviso acima), time `team_CjCBX0DGD7HIlBL4MRqQmNzS`, root directory
  `apps/backoffice`, **Production Branch = `dev`** (não `main`) — publica em
  `dev.backoffice.nebuloz.ai`.
- O projeto Vercel de produção existente (`prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N`)
  **não muda**: continua com `main`, domínio `backoffice.nebuloz.ai` e o
  banco de hoje.

### Por que Production Branch = `dev`, e não Preview

`packages/database/scripts/deploy-migrations.mts` roda em todo `build`
(`turbo.json`: `build.dependsOn` inclui `@repo/database#migrate:deploy`).
Quem decide se migra é `decidirMigration`
(`packages/database/scripts/migration-target.ts`):

- `VERCEL_ENV=production` + `DATABASE_URL` presente → migra, sempre.
- `VERCEL_ENV=preview` → só migra se `DARK_MATTER_DB_HOST` bater com o host
  de `DATABASE_URL` (prova de que é o branch efêmero Neon daquele PR — ver
  `.github/workflows/dark-matter.yml`).
- Qualquer outro caso → pula. Nunca migra por ausência de sinal.

O back-office de dev não é um PR e não tem branch efêmero Neon — é um banco
Supabase fixo. Fazer o projeto Vercel novo tratar `dev` como Production
Branch entrega `VERCEL_ENV=production` só para os builds desse projeto, e as
migrations rodam pelo caminho normal, sem mexer em `decidirMigration` nem em
`migration-target.ts`. Um PR aberto contra esse projeto novo (branch
diferente de `dev`) cai em preview sem `DARK_MATTER_DB_HOST` — pula
migrations, seguro por padrão.

### Sobre o risco nº1 (build de `dev` usando `DATABASE_URL` de produção)

Esse risco só existiria se o projeto novo herdasse env var do projeto de
produção — e a Vercel não compartilha env var entre projetos diferentes. É
por isso que a decisão do CEO é um projeto Vercel **separado**
(`cosmos-nebuloz-backoffice-dev`, `projectId` próprio), não uma branch de
deploy dentro do projeto de produção existente
(`prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N`). A prova de fato só é possível depois
que o projeto existir e tiver rodado o primeiro build — passo 8.

## Passo a passo

### 1. Branch `dev` no GitHub — feito

Criada a partir do `main` atual via API do GitHub (Git Data API, sem tocar
nenhum worktree local — este ambiente tem vários papéis do Maestri com
clones divergentes, e um `git push` de um worktree desatualizado arriscaria
sobrescrever trabalho de outro papel).

```
refs/heads/dev → e80052cdd76d157198ca67f53201e850ebf92f12  (= main, 2026-09-26)
```

### 2. Projeto Supabase `nebuloz-dev` — CEO

Precisa de conta/organização Supabase com permissão de criar projeto (em
vários planos, cartão associado à org). Não há login de nuvem Supabase neste
ambiente — só a CLI local usada para o storage do E2E
(`docs/runbooks/supabase-local.md`, que é Docker local, não nuvem).

**Dashboard** (mais simples): app.supabase.com → New Project → nome
`nebuloz-dev` → **região**: a mesma do projeto de produção
(`aosdvvluokrbgpyqwoor` — confira em Project Settings → General → Region do
projeto de produção e use a mesma aqui) → senha do banco forte, guardada em
cofre. Depois: Project Settings → Database → Connection string → copiar a
URI de **sessão direta** (porta `5432`, sem `pgbouncer=true`).

**CLI**, se preferir terminal:

```bash
supabase login
supabase orgs list                 # pegar org-id
supabase projects create nebuloz-dev --org-id <ORG_ID> --region <REGIAO, igual à de produção> --db-password <SENHA_FORTE>
```

A senha do banco só existe onde foi gerada — a CLI não devolve depois.

**Não tocar o projeto `aosdvvluokrbgpyqwoor`.**

**Segredo, sem colar no chat**: grave a connection string direto em
`packages/database/.env.dev` (git-ignorado — ver `.gitignore`):

```
DATABASE_URL="<URI de sessão, porta 5432, do nebuloz-dev>"
```

Eu leio esse arquivo para rodar os passos abaixo e nunca imprimo o valor —
só confirmo o resultado (host aplicado, migrations rodadas etc.).

### 3. Migrations no banco dev — CEO roda, ou eu, lendo `.env.dev`

Pelo caminho do deploy, nunca `prisma migrate resolve --applied` — isso
marca migration como aplicada sem rodar; mascara schema divergente, que é o
incidente exato que motivou `deploy-migrations.mts` existir (ver comentário
no topo do arquivo).

```bash
cd cosmos-nebuloz   # raiz do repo, branch dev, pnpm install já rodado
set -a; source packages/database/.env.dev; set +a
VERCEL_ENV=production pnpm --filter @repo/database migrate:deploy
```

`VERCEL_ENV=production` é necessário para passar pela mesma checagem que o
build da Vercel vai usar — sem ela, `decidirMigration` não tem prova de que
é produção nem de preview com branch efêmero, e pula de propósito.
`migrate:deploy` troca pooler (6543) por sessão (5432) sozinho se receber a
URL errada (`urlDeMigration`), mas guardar a de sessão em `.env.dev` já
evita depender disso e evita o advisory lock preso em pgbouncer transaction
mode.

### 4. Seed mínimo — CEO roda, ou eu, mesma condição do passo 3

```bash
cd packages/database
set -a; source .env.dev; set +a
BETTER_AUTH_SECRET="<qualquer string de 32+ chars>" \
BETTER_AUTH_URL="https://dev.backoffice.nebuloz.ai" \
node --import tsx/esm ../../apps/app/scripts/seed-admin.ts
```

Cria só o essencial para logar: um tenant (`COSMOS Dev` / `cosmos-dev`) e um
usuário admin (`admin@cosmos.local` por padrão — sobrescreva com
`E2E_EMAIL`/`E2E_PASSWORD` se quiser credenciais próprias do laboratório).
Não usar `seed:safe` (`seed-safe-full.ts`) nem `seed:scaffold`/`seed:regulacao`
aqui — são seeds de cenário de produto, não "vazio + mínimo" que o CEO pediu.

### 5. Projeto Vercel `cosmos-nebuloz-backoffice-dev` — eu, com "vai" do CEO por operação

Time: `team_CjCBX0DGD7HIlBL4MRqQmNzS`. O MCP da Vercel está conectado nesta
sessão e já enxerga esse time — não preciso de token pessoal. Ainda assim,
cada escrita abaixo (criar projeto, trocar Production Branch, setar env var,
domínio) é uma operação em infra compartilhada: paro e peço "vai" antes de
cada uma.

1. `create_project` — nome **`cosmos-nebuloz-backoffice-dev`** (nunca
   `cosmos-nebuloz-backoffice`, que já existe e é
   `prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N` — ver aviso no topo), Root Directory
   `apps/backoffice`, `gitRepository` apontando pra
   `PAVincius/cosmos-nebuloz`. Anoto o `projectId` novo assim que criado e
   passo a citá-lo em todo passo seguinte.
2. **Antes de qualquer deploy**: trocar Production Branch de `main` para
   `dev` **só no `projectId` novo** (ver "Por que Production Branch = dev"
   acima). Confirmo o `projectId` no pedido de "vai" pra não repetir o erro
   já flagrado (trocar isso no projeto de produção redirecionaria
   `backoffice.nebuloz.ai` pra branch `dev`).

Se preferir fazer pelo dashboard em vez de eu rodar via MCP, os cliques são
os mesmos: vercel.com → time → Add New… → Project → Import
`PAVincius/cosmos-nebuloz` → Root Directory `apps/backoffice` → **antes de
clicar em Deploy**, Project Settings → Git → Production Branch `dev` →
confirmar nome do projeto `cosmos-nebuloz-backoffice-dev`.

### 6. Env vars do projeto novo — eu, lendo `.env.dev`, com "vai" do CEO

Em **Production** do `projectId` novo (nunca do
`prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N` de produção):

| Var | Valor |
|---|---|
| `DATABASE_URL` | URI de sessão (5432) do `nebuloz-dev` — lida de `packages/database/.env.dev` (passo 2), nunca colada no chat |
| `BETTER_AUTH_SECRET` | segredo novo, 32+ chars (`openssl rand -hex 32`) — não reusar o de produção nem o de `apps/app/.env.local` |
| `BETTER_AUTH_URL` | `https://dev.backoffice.nebuloz.ai` |

Se o build reclamar de outra env var ausente, o erro aponta o `keys.ts` do
pacote (`packages/rate-limit`, `packages/observability` etc.) — adicionar
ali, mesma tabela.

**Confirme antes de salvar**: nenhum valor aqui vem do projeto de produção
existente. Se `DATABASE_URL` apontar para o host de `aosdvvluokrbgpyqwoor`,
pare — é o erro que este runbook existe para evitar.

### 7. Domínio `dev.backoffice.nebuloz.ai` — CEO (DNS de nebuloz.ai)

No `projectId` novo (nunca no de produção) → Settings → Domains → Add →
`dev.backoffice.nebuloz.ai`, target **Production**.

- Se `nebuloz.ai` já está delegado à Vercel (outro projeto do mesmo time já
  usa o apex ou um wildcard), ela resolve o subdomínio sozinha.
- Senão, aparece um registro **CNAME**: `dev.backoffice` →
  `cname.vercel-dns.com.` — criar no provedor de DNS onde `nebuloz.ai` está
  registrado. Propagação: minutos a ~1h.

### 8. Primeiro deploy e prova do risco nº1 — eu, depois de 5–7 prontos

```bash
git push origin dev   # ou qualquer commit novo em dev — dispara o build
```

Na aba Deployments do `projectId` novo (nunca o de produção) → build em
andamento → Logs. Dois sinais
confirmam o risco nº1 resolvido:

1. O `prisma migrate deploy` (dentro de `migrate:deploy`) imprime
   `Datasource "db": PostgreSQL database ...` — o host tem que ser o do
   `nebuloz-dev`, nunca o de `aosdvvluokrbgpyqwoor`.
2. O build termina sem `deploy-migrations: DATABASE_URL ausente` nem
   `pulando` — se aparecer, alguma env var do passo 6 está errada ou faltando.

Eu confirmo isso pelo log assim que o deploy acontecer e reporto o
resultado.

## Nunca fazer

- `prisma migrate resolve --applied` no banco dev.
- Copiar `DATABASE_URL`/`DIRECT_URL` do projeto de produção para o projeto
  novo, mesmo "só para testar".
- Chamar o projeto novo de `cosmos-nebuloz-backoffice` — esse nome já existe
  (`prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N`, produção). O nome certo é
  `cosmos-nebuloz-backoffice-dev`.
- Mudar o Production Branch do projeto de produção existente
  (`prj_IKWTHf8Un5SD8z7X8BDQwdSIrs4N`) para `dev`, ou vice-versa — são dois
  projetos Vercel deliberadamente separados.
- Colar connection string do `nebuloz-dev` no chat — grava em
  `packages/database/.env.dev` (passo 2).
- Adicionar o project ID novo em `VERCEL_PROJECT_IDS`
  (`.github/workflows/dark-matter.yml`) — o back-office de dev usa um
  Supabase fixo, não o branch efêmero Neon por PR. Misturar os dois sistemas
  de ambiente derrota o propósito deste runbook.

## O que isto não cobre

- Rotação/cofre do `BETTER_AUTH_SECRET` e da senha do Postgres do
  `nebuloz-dev` — mesma prática de qualquer segredo de produção, fora do
  escopo aqui.
- Backup do banco de dev — descartável para laboratório de usabilidade; se
  passar a guardar dado que importa, é decisão nova, não coberta aqui.
- CI (`ci.yml`) contra o banco de dev — este runbook cobre só o deploy da
  Vercel; testes automatizados continuam no Postgres efêmero deles.
