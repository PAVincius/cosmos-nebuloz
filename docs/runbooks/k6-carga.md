# k6 — teste de carga (spec 007)

Ferramenta usada pelo cenário de carga do Meridian (SC-011,
`specs/007-gate-maturidade-carga/`). O script em si (`k6/meridian-pi-planning.js`)
é outra tarefa (T006); este runbook cobre só instalar o k6 e rodar qualquer
script desta pasta com segurança.

**Nunca contra produção** — ver guard abaixo.

## Instalar

```bash
brew install k6
k6 version   # confirma: deve imprimir uma versão, ex. "k6 v2.3.0"
```

## Como rodar

O alvo é sempre um servidor **local**, que sobe só durante a rodada e é
derrubado ao final — nunca deixe um `pnpm dev` esquecido rodando na porta
3012 (já aconteceu de o CEO cair num `localhost:3012` esquecido aberto, duas
vezes).

```bash
# 1. Sobe o app local (processo dedicado, numa aba que você vai fechar depois)
pnpm dev   # app em :3012

# 2. Em outra aba, roda o script k6 contra ele
BASE_URL=http://localhost:3012 k6 run k6/meridian-pi-planning.js

# 3. Assim que terminar, derruba o servidor do passo 1
#    Ctrl+C na aba de cima, ou, se ficou em background:
lsof -ti:3012 | xargs kill
```

O passo 3 não é opcional nem "faço depois" — é o hábito exato que já causou
incidente. Rodar o k6 e sair sem derrubar o `pnpm dev` deixa a porta aberta
pro próximo acesso acidental.

## Guard contra produção

Todo script desta pasta (`k6/*.js`) precisa recusar rodar contra um host de
produção, mesmo padrão de `assertLocalDatabaseUrl`
(`apps/app/scripts/seed-meridian.ts`): parseia o host de `BASE_URL` e decide
por uma allowlist explícita — nunca aceita o host cru sem checar.

Bloqueados sempre (mesmo que alguém tente apontar `BASE_URL` pra lá):
- `app.nebuloz.ai`, `backoffice.nebuloz.ai` — e qualquer `*.nebuloz.ai`.
- qualquer `*.vercel.app` — produção também é servida por trás de um alias
  `.vercel.app`, e distinguir "preview" de "produção" só pelo nome do host é
  frágil; mais simples e mais seguro bloquear a família inteira.

Permitido: `localhost`, `127.0.0.1`, `::1`. Staging/preview não são alvo
suportado por este guard — validar contra um ambiente que não seja local é
decisão separada, tomada caso a caso, nunca um `BASE_URL` alternativo por
conta própria.

Pseudocódigo do guard, pra T006 implementar (k6 roda em Goja, sem Node — nada
de importar código do monorepo, só isto, auto-contido no próprio script):

```js
const BLOCKED_HOST_SUFFIXES = [".nebuloz.ai", ".vercel.app"];
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function assertLocalTarget(baseUrl) {
  const host = new URL(baseUrl).hostname;
  const blocked = BLOCKED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
  );
  if (blocked || !ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `k6 recusa rodar: BASE_URL aponta pra "${host}", não localhost/127.0.0.1/::1.`
    );
  }
}
```

## Desinstalar / atualizar

```bash
brew upgrade k6   # nova versão
brew uninstall k6 # remover
```
