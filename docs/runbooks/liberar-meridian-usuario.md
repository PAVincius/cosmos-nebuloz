# Liberar acesso ao Meridian para um usuário (produção)

Pesquisa de código, sem escrita em banco. Caso: CEO já tem conta e loga em
`app.nebuloz.ai`, mas cai no Cosmos — falta acesso ao Meridian no tenant
`nebuloz` (o laboratório interno da própria Nebuloz, populado por
`apps/app/scripts/seed-meridian-nebuloz.ts`).

## 1. Como o acesso é decidido

O guard do Meridian é uma cadeia de três portões, sempre na mesma ordem —
`apps/app/lib/meridian/guards.ts:18-32` documenta a ordem e por que não pode
inverter:

1. **Sessão de tenant** — `requireTenantSession` (`@repo/auth/server`). Confirma
   quem é a pessoa e em qual tenant ela está.
2. **Módulo contratado** — tabela `TenantModule` (schema em
   `packages/database/prisma/schema/modules.prisma:30-47`). Linha
   `(tenantId, module='MERIDIAN')` com `status` em `ACTIVE`/`TRIAL` e
   `expiresAt` nulo ou futuro. Ausência de linha = módulo não contratado,
   default deny — não é feature flag, é rastro comercial
   (`modules.prisma:1-6`). Checado por `hasModule()` em
   `packages/rbac/src/modules.ts:51-57`, que lê de um **cache Redis com TTL de
   5 min** (`modules.ts:17,36-49`) quando `UPSTASH_REDIS_REST_URL` está setado.
3. **Papel de diagnóstico** — tabela `MeridianMembership` (schema em
   `packages/database/prisma/schema/meridian.prisma:113-128`). Linha
   `(tenantId, userId)` com um `MeridianRole`: `CONSULTANT`, `REVIEWER` ou
   `VIEWER` (`meridian.prisma:95-99`). Ausência de linha = sem acesso, **mesmo
   com o módulo contratado e mesmo sendo ADMIN do tenant** — o comentário no
   schema é explícito: "um admin de plataforma que contorna o papel de
   consultor invalida a trilha". Checado por `getMeridianRole()`
   (`packages/rbac/src/meridian-resolve.ts:30`) e aplicado em
   `requireMeridianContext()` (`guards.ts:81-96`).

A matriz de permissão por papel está em
`packages/rbac/src/meridian-matrix.ts:62-79`:

| Papel | Permissões |
|---|---|
| `CONSULTANT` | tudo — conduzir assessment, rodar scoring, override, gap, promover gap, ler evidência, ler relatório |
| `REVIEWER` | `override.write`, `evidence.read`, `report.read` |
| `VIEWER` | só `report.read` |

Para o caso do CEO (ver o laboratório, sem conduzir diagnóstico), **`VIEWER`
é o papel mínimo suficiente** — dá `report.read` e nada além.

Layout (`apps/app/app/(meridian)/layout.tsx:24-40`) e cada server action
repetem os três checks; o layout só protege navegação.

## 2. Estado atual — leitura antes de qualquer escrita

Rodar isto primeiro, em produção, **somente leitura**:

```sql
-- resolve tenant e usuário
SELECT id, slug FROM "Tenant" WHERE slug = 'nebuloz';
SELECT id, email FROM "User" WHERE email = '<email-do-ceo>';

-- módulo Meridian está contratado e vigente para o tenant?
SELECT id, status, "contractedAt", "expiresAt", "updatedAt"
FROM "TenantModule"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'nebuloz')
  AND module = 'MERIDIAN';

-- o CEO já tem MeridianMembership neste tenant?
SELECT id, role, "createdAt", "updatedAt", "updatedBy"
FROM "MeridianMembership"
WHERE "tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'nebuloz')
  AND "userId" = (SELECT id FROM "User" WHERE email = '<email-do-ceo>');

-- confirma que a conta já existe e já está no tenant (lado Cosmos/SAFe)
SELECT tm.role, tm."tenantId", tm."createdAt"
FROM "TenantMember" tm
JOIN "User" u ON u.id = tm."userId"
WHERE u.email = '<email-do-ceo>'
  AND tm."tenantId" = (SELECT id FROM "Tenant" WHERE slug = 'nebuloz');
```

`seed-meridian-nebuloz.ts` já roda `tenantModule.upsert(... module: 'MERIDIAN',
status: 'ACTIVE')` como parte do seed do laboratório (linhas 103-107 do
script) — a primeira query deve mostrar `status = 'ACTIVE'` se o seed já
rodou em produção. Se vier vazia, o módulo precisa ser contratado antes do
passo 3 (ver `contractModule` abaixo). A terceira query decide se falta só o
papel (linha ausente) ou se é preciso trocar um papel existente.

## 3. Escrita — como liberar

### Opção A — upsert direto de `MeridianMembership`, papel `VIEWER` (recomendado)

É o menor privilégio que resolve o pedido ("ver o laboratório"), e é
exatamente o padrão idempotente já usado em `bootstrapMeridian`
(`packages/provisioning/src/meridian.ts:260-271`) e em
`seed-meridian-nebuloz.ts`, só trocando o papel para `VIEWER`. A unique
`(tenantId, userId)` (`meridian.prisma:125`) garante que rodar de novo não
duplica nem quebra.

SQL, parametrizado por `ON CONFLICT` na mesma unique:

```sql
INSERT INTO "MeridianMembership" (id, "tenantId", "userId", role, "createdAt", "updatedAt", "updatedBy")
VALUES (
  gen_random_uuid()::text,
  (SELECT id FROM "Tenant" WHERE slug = 'nebuloz'),
  (SELECT id FROM "User" WHERE email = '<email-do-ceo>'),
  'VIEWER',
  now(), now(),
  '<userId-de-quem-executa>'
)
ON CONFLICT ("tenantId", "userId")
DO UPDATE SET role = 'VIEWER', "updatedAt" = now(), "updatedBy" = EXCLUDED."updatedBy";
```

Ou, seguindo o padrão Prisma do próprio pacote de provisioning (o jeito que o
resto do código faz):

```ts
await db.meridianMembership.upsert({
  where: { tenantId_userId: { tenantId, userId } },
  create: { tenantId, userId, role: "VIEWER", updatedBy: actorUserId },
  update: { role: "VIEWER", updatedBy: actorUserId },
});
```

Se a query 2 da seção anterior não mostrou o módulo `ACTIVE`, rodar antes (e
só então) `contractModule()` (`packages/provisioning/src/modules.ts:52-95`) —
ele já chama `invalidateModuleCache()` (linha 82), necessário porque
`hasModule()` fica em cache Redis por 5 min (`modules.ts:17`). Sem isso o CEO
veria "módulo não contratado" por até 5 minutos após a liberação.

Nenhuma das duas escritas (módulo ou membership) tem UI hoje para papel
`VIEWER`/`REVIEWER` — só existe botão de contratação de módulo
(`contractModuleAction`) e de bootstrap com papel fixo `CONSULTANT`
(`bootstrapMeridianAction`), ambos em
`apps/backoffice/app/actions/provisioning.ts:33-143`, atrás de
`requirePlatformStaff` + `assertCanWrite`. Rodar o upsert acima exige acesso
direto ao banco de produção (psql ou script `tsx` seguindo o padrão de
`seed-meridian-nebuloz.ts`) — não existe endpoint self-service para
`VIEWER`.

### Opção B — botão existente em backoffice.nebuloz.ai, papel `CONSULTANT`

`bootstrapMeridianAction({ slug: "nebuloz", consultantEmail: "<email-do-ceo>" })`
(`apps/backoffice/app/actions/provisioning.ts:117-143`) roda
`bootstrapMeridian()`, que faz o mesmo upsert da Opção A mas grava
`role: "CONSULTANT"` fixo (`packages/provisioning/src/meridian.ts:260-271`) e
é idempotente — como o template já existe (seed rodou), ele só atualiza o
papel e não recria nada (`meridian.ts:278-289`). Existe hoje na UI da
Plataforma, sem escrita manual em banco. **Mas dá permissão de conduzir
assessment, rodar scoring e registrar override** — mais do que "ver o
laboratório" pede. Só usar se o CEO realmente precisar agir no diagnóstico,
não só lê-lo.

Recomendação: Opção A (`VIEWER`, escrita direta). É o princípio de menor
privilégio e é o mesmo padrão de upsert que o próprio código usa em todo
lugar — só não tem botão para além de `CONSULTANT`.

## 4. Redefinição de senha pelo próprio forgot-password

**Não vai funcionar em produção hoje.** O fluxo existe na UI
(`packages/auth/components/forgot-password.tsx` chama
`authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`),
mas o Better Auth só dispara o e-mail se `emailAndPassword.sendResetPassword`
estiver configurado — e não está.
`packages/auth/server.ts:45-48` mostra a config inteira do provider:

```ts
emailAndPassword: {
  enabled: true,
  minPasswordLength: 12,
},
```

Sem `sendResetPassword`. Busca no repositório inteiro por
`sendResetPassword` não retorna nenhuma ocorrência — nem em `packages/auth`,
nem em nenhum outro pacote. Existe um pacote de e-mail pronto
(`packages/email`, com transporte via Resend — `packages/email/transporte.ts`,
`packages/email/keys.ts`) mas ele **não está ligado** ao Better Auth. Ou seja:
o formulário aceita o e-mail e devolve sucesso na tela (ou erro do Better
Auth, dependendo da versão — não verificado em runtime, só em código), mas
nenhum e-mail de fato sai.

Como pedido, **não é proposta gravar senha por SQL** — grava hash por fora
do Better Auth é o segundo lugar que sabe hashear senha, e diverge da tabela
`Account` que o Better Auth usa (mesmo motivo documentado em
`apps/app/scripts/seed-nebuloz.ts:14-17`, que deliberadamente não cria
senha por esse risco). Duas saídas reais para o CEO entrar:

- Ele já tem conta e senha (o pedido diz que ele já loga hoje) — não precisa
  de reset nenhum, só do acesso ao Meridian (seções 2 e 3).
- Se algum dia precisar mesmo de reset, o gap é conectar
  `sendResetPassword` ao `@repo/email` em `packages/auth/server.ts` — isso é
  mudança de código, fora do escopo desta tarefa (só leitura).

## Resumo

| Pergunta | Resposta |
|---|---|
| Onde mora o acesso? | `TenantModule` (módulo) + `MeridianMembership` (papel), ambos por tenant — `packages/database/prisma/schema/{modules,meridian}.prisma` |
| Guard | `apps/app/lib/meridian/guards.ts:81-96`, 3 portões em ordem fixa |
| Papel mínimo p/ CEO ver o laboratório | `VIEWER` — só `report.read` |
| Escrita idempotente | upsert `MeridianMembership` por `(tenantId, userId)`, ver Opção A |
| Existe botão pronto? | Só p/ `CONSULTANT` (Opção B), em backoffice.nebuloz.ai |
| Cache a invalidar | `invalidateModuleCache()` só se o módulo também precisar ser (re)contratado |
| Forgot-password envia e-mail? | Não — `sendResetPassword` não está configurado no Better Auth |
| Resetar senha por SQL? | Não proposto — divergiria da tabela `Account` do Better Auth |
