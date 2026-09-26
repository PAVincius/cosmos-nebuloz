# Back-office de dev (ambiente separado do Meridian)

CEO decidiu em 2026-09-24: o laboratório de usabilidade do Meridian precisa
de um back-office rodando fora de produção — branch, banco e deploy
próprios. Produção (`aosdvvluokrbgpyqwoor`) não é tocada em nenhum passo.

## Arquitetura alvo

- **Repo**: GitHub `PAVincius/cosmos-nebuloz`, branch `dev` criada a partir de
  `main`.
- **Banco**: projeto Supabase novo `nebuloz-dev` — nasce vazio, migrations do
  repo aplicadas por cima, depois seed mínimo.
- **Deploy**: projeto Vercel novo `cosmos-nebuloz-backoffice`
  (time `team_CjCBX0DGD7HIlBL4MRqQmNzS`), root directory `apps/backoffice`,
  **Production Branch = `dev`** (não `main`) — publica em
  `dev.backoffice.nebuloz.ai`.
- O projeto Vercel de produção existente **não muda**: continua com `main` e
  com o banco de hoje.

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
(`cosmos-nebuloz-backoffice`), não uma branch de deploy dentro do projeto de
produção existente. A prova de fato só é possível depois que o projeto
existir e tiver rodado o primeiro build — passo 8.

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
`nebuloz-dev` → região perto da Vercel → senha do banco forte, guardada em
cofre. Depois: Project Settings → Database → Connection string → copiar a
URI de **sessão direta** (porta `5432`, sem `pgbouncer=true`).

**CLI**, se preferir terminal:

```bash
supabase login
supabase orgs list                 # pegar org-id
supabase projects create nebuloz-dev --org-id <ORG_ID> --region <REGIAO> --db-password <SENHA_FORTE>
```

A senha do banco só existe onde foi gerada — a CLI não devolve depois.

**Não tocar o projeto `aosdvvluokrbgpyqwoor`.**

### 3. Migrations no banco dev — CEO roda, ou eu (se me passar a URL)

Pelo caminho do deploy, nunca `prisma migrate resolve --applied` — isso
marca migration como aplicada sem rodar; mascara schema divergente, que é o
incidente exato que motivou `deploy-migrations.mts` existir (ver comentário
no topo do arquivo).

```bash
cd cosmos-nebuloz   # raiz do repo, branch dev, pnpm install já rodado
VERCEL_ENV=production \
DATABASE_URL="<URI de sessão, porta 5432, do nebuloz-dev>" \
pnpm --filter @repo/database migrate:deploy
```

`VERCEL_ENV=production` é necessário para passar pela mesma checagem que o
build da Vercel vai usar — sem ela, `decidirMigration` não tem prova de que
é produção nem de preview com branch efêmero, e pula de propósito.
`migrate:deploy` troca pooler (6543) por sessão (5432) sozinho se receber a
URL errada (`urlDeMigration`), mas passar a de sessão direto evita depender
disso e evita o advisory lock preso em pgbouncer transaction mode.

Prefiro que este passo rode com você (CEO) segurando a connection string —
ela não precisa aparecer para mim em nenhum momento. Se preferir que eu
rode, me passe a URI e eu confirmo aqui só o resultado, nunca o valor.

### 4. Seed mínimo — CEO roda, ou eu, mesma condição do passo 3

```bash
cd packages/database
DATABASE_URL="<mesma URI de sessão>" \
BETTER_AUTH_SECRET="<qualquer string de 32+ chars>" \
BETTER_AUTH_URL="https://dev.backoffice.nebuloz.ai" \
node --import tsx/esm ../../apps/app/scripts/seed-admin.ts
```

Cria só o essencial para logar: um tenant (`COSMOS Dev` / `cosmos-dev`) e um
usuário admin (`admin@cosmos.local` por padrão — sobrescreva com
`E2E_EMAIL`/`E2E_PASSWORD` se quiser credenciais próprias do laboratório).
Não usar `seed:safe` (`seed-safe-full.ts`) nem `seed:scaffold`/`seed:regulacao`
aqui — são seeds de cenário de produto, não "vazio + mínimo" que o CEO pediu.

### 5. Projeto Vercel `cosmos-nebuloz-backoffice` — CEO (token/acesso ao time)

Time: `team_CjCBX0DGD7HIlBL4MRqQmNzS`. A integração MCP da Vercel caiu nesta
sessão e não há CLI instalada aqui — se você gerar um token pessoal
(vercel.com/account/tokens, escopo mínimo, revogável depois), eu sigo os
passos 5–8 sozinho. Senão, os cliques exatos:

1. vercel.com → time `team_CjCBX0DGD7HIlBL4MRqQmNzS` → **Add New… → Project**.
2. Import Git Repository → `PAVincius/cosmos-nebuloz` (se não aparecer,
   "Adjust GitHub App Permissions" para dar acesso ao repo).
3. **Root Directory**: `apps/backoffice` (botão Edit, digitar o caminho).
4. Framework Preset: Next.js — detecta sozinho pelo `apps/backoffice/vercel.json`
   já commitado neste runbook.
5. **Não clicar em Deploy ainda.** Antes: Project Settings → Git →
   **Production Branch**: trocar de `main` para `dev`. É isso que faz só
   este projeto tratar `dev` como produção (ver "Por que Production Branch
   = dev" acima) — o projeto de produção real não muda.
6. Project Name: confirmar `cosmos-nebuloz-backoffice`.

### 6. Env vars do projeto novo — CEO, ou eu com o token

Em **Production** deste projeto (que só builda a partir de `dev` — nunca
vaza para o projeto de produção real):

| Var | Valor |
|---|---|
| `DATABASE_URL` | URI de sessão (5432) do `nebuloz-dev` — a mesma do passo 3 |
| `BETTER_AUTH_SECRET` | segredo novo, 32+ chars (`openssl rand -hex 32`) — não reusar o de produção nem o de `apps/app/.env.local` |
| `BETTER_AUTH_URL` | `https://dev.backoffice.nebuloz.ai` |

Se o build reclamar de outra env var ausente, o erro aponta o `keys.ts` do
pacote (`packages/rate-limit`, `packages/observability` etc.) — adicionar
ali, mesma tabela.

**Confirme antes de salvar**: nenhum valor aqui vem do projeto de produção
existente. Se `DATABASE_URL` apontar para o host de `aosdvvluokrbgpyqwoor`,
pare — é o erro que este runbook existe para evitar.

### 7. Domínio `dev.backoffice.nebuloz.ai` — CEO (DNS de nebuloz.ai)

No projeto novo → Settings → Domains → Add → `dev.backoffice.nebuloz.ai`,
target **Production**.

- Se `nebuloz.ai` já está delegado à Vercel (outro projeto do mesmo time já
  usa o apex ou um wildcard), ela resolve o subdomínio sozinha.
- Senão, aparece um registro **CNAME**: `dev.backoffice` →
  `cname.vercel-dns.com.` — criar no provedor de DNS onde `nebuloz.ai` está
  registrado. Propagação: minutos a ~1h.

### 8. Primeiro deploy e prova do risco nº1 — eu, depois de 5–7 prontos

```bash
git push origin dev   # ou qualquer commit novo em dev — dispara o build
```

Na aba Deployments do projeto novo → build em andamento → Logs. Dois sinais
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
- Mudar o Production Branch do projeto de produção existente para `dev`, ou
  vice-versa — são dois projetos Vercel deliberadamente separados.
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
