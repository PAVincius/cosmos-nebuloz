# Auth: rate limit com contador no Postgres (Vigia 03/10, achado 12, ALTO)

**Branch:** `fix/auth-rate-limit-compartilhado` · **Data:** 2026-10-03

## Problema
`rateLimit` do better-auth em `packages/auth/server.ts` não tinha storage: o contador ficava na memória da instância. Em serverless cada instância contava sozinha (e cada cold start zerava), então login, 2FA e cadastro não tinham freio real.

## Mudança
- `packages/auth/rate-limit-storage.ts` (novo): `createAuthRateLimitStorage()` entrega o `customStorage` do better-auth. O `consume(key, rule)` atômico (é o que o better-auth usa quando existe) incrementa a linha do contador de `@repo/rate-limit` (`RateLimitBucket`, upsert atômico, janela fixa). Um limiter por janela/máximo, prefixo `auth:<janela>s`. `get`/`set` são no-op de contrato.
- Se o Postgres falhar, **libera** e loga `log.error` (o login depende do mesmo banco, e quem causa erro de banco não é o atacante). Decisão a confirmar com o dono; o contrário (fail-closed) travaria o login inteiro numa indisponibilidade do contador.
- `server.ts`: `customStorage` + regras de janela longa, por IP e rota: `/sign-in/email` 15 por 5 min; `/two-factor/*` 8 por 5 min (6 dígitos = 1 milhão de combinações, por isso o mais apertado); `/sign-up/email` 10 por 1 h; `/reset-password*` 10 por 15 min; `/request-password-reset` 3 por 15 min (já existia). As regras embutidas (3 por 10 s em sign-in/up) continuam valendo nas rotas sem regra própria.
- `packages/auth/package.json`: `@repo/rate-limit` e `@repo/database` (este já era importado por `server.ts` sem estar declarado). Lockfile: só as duas entradas do importer `packages/auth`.

## Testes (TDD, RED antes do código)
- `rate-limit-storage.test.ts` (7): libera até `max` e recusa a seguinte; **limite vale entre instâncias** (duas `createAuthRateLimitStorage()` sobre o mesmo "Postgres" fake); chaves por IP/rota independentes; `retryAfter` em (0, janela]; janela vira e libera; janelas diferentes na mesma chave não se atropelam; falha de infra libera e loga.
- `server.test.ts` (+7): `customStorage` presente e não `memory`; regra para cada rota com teto/janela sensatos; 2FA mais restrito que login por minuto.
- `vitest run` em `packages/auth`: 51 passam. `tsc --noEmit`: limpo. Biome 2.3.11: limpo nos arquivos novos.

## Limites conhecidos
- O rate limit só liga em produção (padrão do better-auth); continua assim de propósito (e2e loga repetido).
- Chave é IP+rota. Atacante distribuído em muitos IPs não é contido por IP; a trava por conta (lockout por usuário) é outro tema.
- IP vem de `x-forwarded-for` (padrão do better-auth); na Vercel é o IP do cliente. Se faltar IP, todos caem num bucket único por rota (`no-trusted-ip`), que o better-auth já avisa em log.
- Não testei contra um Postgres real nem pela pilha HTTP do better-auth; o teste prova o contrato `consume` e o compartilhamento via banco. Conferir em preview/prod depois do deploy: 16ª tentativa de login em 5 min do mesmo IP deve dar 429.
