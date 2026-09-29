# Postgres local (`cosmos-dev-db`, porta 5434)

Banco de dev/E2E do Prisma — `cosmos_dev`. Não confundir com:

- **Supabase local** (`docs/runbooks/supabase-local.md`): storage/auth só, portas
  `54320`-`54322`. Não toca `DATABASE_URL`.
- **`docker-compose.e2e.yml`**: stack completa (`cosmos-e2e-db` + app + Playwright)
  para rodar E2E dentro de container, mapeando `5432` e `5434`. Este runbook cobre o
  container avulso `cosmos-dev-db` (só `5434`), que é o que `apps/app/.env.local`
  aponta para o dia a dia (`DATABASE_URL=postgresql://postgres:postgres@localhost:5434/cosmos_dev`).

## Recriar do zero

```bash
docker stop cosmos-dev-db 2>/dev/null
docker rm -v cosmos-dev-db 2>/dev/null   # -v: também remove o volume anônimo

docker run -d --name cosmos-dev-db \
  -e POSTGRES_DB=cosmos_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5434:5432 \
  pgvector/pgvector:pg16
```

Confirme antes que a 5434 está livre e que ninguém mais depende do estado atual do
banco (E2E rodando, outro agente com uma sessão aberta) — este comando apaga todos os
dados. Espere ficar pronto:

```bash
for i in $(seq 1 20); do
  docker exec cosmos-dev-db pg_isready -U postgres -d cosmos_dev && break
  sleep 1
done
```

## Backup

**Não existe.** O volume é anônimo (criado sem `-v nome:/caminho`), fica preso ao
container e é destruído junto por `docker rm -v`. Isso é intencional para um banco de
dev/E2E — os dados são todos reconstituíveis via migration + seed (abaixo), nunca
dado real de cliente. Se algum dia precisar sobreviver a um `rm`, nomeie o volume
(`-v cosmos_dev_pgdata:/var/lib/postgresql/data`) — mas aí quem recriar precisa lembrar
de apagar esse volume também quando quiser um estado limpo de verdade.

## Migrations

Da raiz do repo:

```bash
pnpm migrate   # prisma format + generate + migrate deploy, contra packages/database/prisma
```

Confirme com `cd packages/database && npx prisma migrate status` — deve fechar sem
pendências.

## Seeds

Mesma ordem que `apps/app/e2e/setup/auth.setup.ts` roda antes da suíte E2E (array
`SEEDS`), da pasta `apps/app`:

```bash
pnpm seed:e2e            # tenant cosmos-dev (UNIVERSE) + todo o domínio Cosmos/SAFe
pnpm seed:charter        # opcional — ver nota abaixo
pnpm seed:meridian cosmos-dev
pnpm seed:catalogo-e2e   # tenant nebuloz-e2e-interno, isInternalTenant=true
```

Todos os scripts de seed têm guard de `DATABASE_URL` (`assertLocalDatabaseUrl` /
`LOCAL_DB_HOSTS`) e recusam rodar contra um host que não seja `localhost`/`127.0.0.1` —
nunca apontam para produção por engano.

**`pnpm seed:charter` (sem argumento) falha neste banco** — o script busca o tenant
`medcore`, que não existe em `cosmos_dev` local (só existe `cosmos-dev` e o
`__system__`). `auth.setup.ts` já trata isso como opcional (`GRUPOS_OPCIONAIS`): as
sessões do Charter simplesmente não são salvas, e o resto da suíte segue. Não é
necessário criar um tenant `medcore` fake para este runbook — se algum dia for
preciso, rode `pnpm seed:charter <slug-de-um-tenant-existente>`.

## Verificar

```bash
cd packages/database
cat <<'EOF' | npx tsx --no-warnings /dev/stdin
import dotenv from "dotenv"; dotenv.config({ path: "../../apps/app/.env.local" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@repo/database/generated/client";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter: new PrismaPg(pool) });
console.log("Tenant:", await p.tenant.count());
console.log("MeridianAssessment:", await p.meridianAssessment.count());
console.log("isInternalTenant=true:", JSON.stringify(
  await p.tenant.findMany({ where: { isInternalTenant: true }, select: { slug: true } })
));
await p.$disconnect(); await pool.end();
EOF
```

Depois dos quatro seeds obrigatórios (sem `seed:charter`), espere pelo menos: 3
`Tenant` (`cosmos-dev`, `nebuloz-e2e-interno`, `__system__`), `MeridianAssessment` > 0,
e um `Tenant` com `isInternalTenant=true` (`nebuloz-e2e-interno`).
