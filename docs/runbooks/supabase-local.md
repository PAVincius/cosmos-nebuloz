# Supabase local (storage)

`packages/storage/src/index.ts` lê `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`. Sem as duas, cai no placeholder hardcoded
`http://localhost:54321` — que não está de pé em clone novo, então
`attachEvidence` (upload pro bucket `meridian-evidence`) falha por conexão
recusada. Este runbook sobe um Supabase local só pra isso: não é o projeto de
produção `aosdvvluokrbgpyqwoor`, nunca aponte pra ele por engano.

## Pré-requisito

CLI do Supabase, local ao usuário (não precisa de sudo nem Xcode Command Line
Tools atualizado — `brew install supabase/tap/supabase` pode travar nisso):

```bash
mkdir -p ~/.local/bin
curl -sSL -o /tmp/supabase.tar.gz \
  "https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz"
tar -xzf /tmp/supabase.tar.gz -C /tmp
mv /tmp/supabase ~/.local/bin/supabase
chmod +x ~/.local/bin/supabase
```

`~/.local/bin` precisa estar no `PATH` (já está via `.zshrc` neste setup).
Troque `darwin_arm64` por `darwin_amd64`/`linux_*` conforme a máquina.

## Subir

Da raiz do repo (`supabase/config.toml` já existe, criado por `supabase init`
com `project_id = "cosmos-nebuloz"`):

```bash
supabase start -x realtime,imgproxy,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes
```

Isso sobe só 4 containers — `db`, `auth`, `storage`, `kong` — em vez da stack
inteira. `storage-api` valida JWT com o mesmo segredo do `auth`, por isso
`auth` fica (sem ele, `supabase status -o env` não relata `SERVICE_ROLE_KEY`).
`postgres` nunca é excluível — é obrigatório e roda isolado do Postgres do
projeto (Prisma), sem tocar `DATABASE_URL`.

Portas usadas: `54321` (API/Kong), `54322` (Postgres do Supabase),
`54320` (shadow db do `db diff`). Nenhuma bate com o Postgres local do projeto
(`5432`/`5434`) — confira antes com `lsof -nP -iTCP:5432,5434 -sTCP:LISTEN`.

Confirme com:

```bash
docker ps --filter "name=supabase_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Apontar o app pro local

```bash
supabase status -o env > /tmp/supabase-status.env
```

De lá, `API_URL` vai pra `NEXT_PUBLIC_SUPABASE_URL` e `SERVICE_ROLE_KEY` pra
`SUPABASE_SERVICE_ROLE_KEY`, em `apps/app/.env.local` (git-ignorado — nunca
commitar). **Atenção**: `supabase status -o env` envolve os valores em aspas
duplas; `createClient` do `@supabase/supabase-js` rejeita URL com aspas
(`Invalid supabaseUrl`) — tire as aspas ao copiar.

```bash
API_URL=$(grep '^API_URL=' /tmp/supabase-status.env | cut -d= -f2- | tr -d '"')
SVC_KEY=$(grep '^SERVICE_ROLE_KEY=' /tmp/supabase-status.env | cut -d= -f2- | tr -d '"')
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SVC_KEY"
} >> apps/app/.env.local
```

A `ANON_KEY`/`SERVICE_ROLE_KEY` locais são o par JWT-demo padrão do Supabase
(o mesmo em qualquer instalação local — não é segredo de produção), mas trate
como se fosse: não printe no terminal nem cole em issue/PR.

## Provar que funciona

```bash
node -e "
import('@supabase/supabase-js').then(async ({createClient}) => {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await c.storage.createBucket('meridian-evidence', {public:false}).catch(()=>{});
  const path = 'smoke-test.txt';
  const up = await c.storage.from('meridian-evidence').upload(path, 'ok', {contentType:'text/plain', upsert:true});
  console.log('upload:', up.error ?? 'ok');
  await c.storage.from('meridian-evidence').remove([path]);
});
"
```

Sem `.env` carregado no shell, rode isso com `dotenv -e apps/app/.env.local --
node ...` ou de dentro de `packages/storage` (onde o pacote já resolve via
pnpm) passando as vars manualmente. Espera `upload: ok`.

## Parar

```bash
supabase stop
```

Mantém o volume do Postgres do Supabase entre `stop`/`start` (backup local);
`supabase stop --no-backup` descarta.

## O que isto não cobre

- Não substitui o Supabase de produção — RLS, políticas de bucket e limites
  reais só existem lá.
- `auth`/`gotrue` sobe só para assinar o JWT igual ao `storage-api`; login de
  verdade continua pelo Better Auth (`packages/auth`), não pelo Supabase Auth.
- Sem `seed.sql`: o bucket `meridian-evidence` não vem pré-criado — o próprio
  `ensureBucket` (`packages/storage/src/index.ts:21`) cria na primeira
  chamada, sem política de retenção (atrito P2 já registrado em
  `docs/qualidade/dogfood/meridian/atrito.md`).
