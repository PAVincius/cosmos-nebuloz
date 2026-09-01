# Charter em produção — o que falta depois do build verde

**Levantamento de 2026-07-31.** O código do Charter está em `main`. Este
documento cobre o que ainda precisa acontecer **no banco e na operação** para as
telas saírem do `/charter-indisponivel`, e registra três lacunas que não são
tarefa de deploy, são decisão de produto.

> **Revisão de 2026-08-31 — os itens 3, 4 e 7 foram resolvidos.**
> `bootstrapCharter` (`packages/provisioning/src/charter.ts`) cria papel
> `COMPLIANCE`, `CharterSettings` e a política com as nove seções em `DRAFT`;
> `provisionTenant` cria o tenant já com os módulos contratados; e o backoffice
> tem UI para os dois (`/clientes/novo` e `/clientes/<slug>`). **Nenhum dos
> SQLs abaixo é mais necessário** — ficam como referência de o que as actions
> fazem. A [PR #34](https://github.com/PAVincius/cosmos-nebuloz/pull/34) foi
> mergeada em 2026-07-31. O item 6 (ADR-0012) segue aberto.
> Para provisionar a própria Nebuloz, use `charter-nebuloz.md`.

---

## 0. Pré-requisitos do deploy

| Item | Estado |
|---|---|
| `ENCRYPTION_KEY` no projeto da Vercel | **pendente** — build falha antes de compilar |
| [PR #34](https://github.com/PAVincius/cosmos-nebuloz/pull/34) (opt-in das suítes de banco + pgvector no CI) | aberta |

Enquanto a chave não existir, nada abaixo importa: o build não passa da
validação de env.

---

## 1. Migration no banco de produção

O build da Vercel **não aplica migration**. `prisma migrate deploy` roda fora do
deploy, apontando `DATABASE_URL` para o banco de produção:

```bash
pnpm migrate     # prisma format + generate + migrate deploy
```

Antes, conferir o histórico — o baseline deste banco já teve migration marcada
como aplicada sem ter rodado o SQL (foi o que o commit `11fdb10` corrigiu):

```bash
cd packages/database && npx prisma migrate status
```

A migration `20260728120000_charter_module` cria 15 tabelas do Charter, a tabela
`TenantModule`, RLS (`ENABLE` + `FORCE` + policy `tenant_isolation`) nas 15, e
faz o backfill de `COSMOS` para todos os tenants que já existiam.

---

## 2. Contratar o módulo para o tenant (default deny)

Sem linha em `TenantModule`, o guard nega — não é feature flag, é contratação.
O backfill da migration só semeia `COSMOS`; `CHARTER` é sempre explícito:

```sql
INSERT INTO "TenantModule" ("id", "tenantId", "module", "status", "contractedAt", "createdAt", "updatedAt")
SELECT 'tm_charter_' || t."id", t."id", 'CHARTER', 'ACTIVE', now(), now(), now()
FROM "Tenant" t
WHERE t."slug" = '<slug-do-cliente>'
ON CONFLICT ("tenantId", "module") DO NOTHING;
```

`status` aceita `ACTIVE` e `TRIAL` (ambos liberam), `SUSPENDED` e `CANCELED`
(fecham a porta sem apagar dado). `expiresAt` nulo = sem prazo.

**Cache:** se `UPSTASH_REDIS_REST_URL` estiver configurado, a lista de módulos
fica 5 min em cache por tenant. Depois do INSERT, ou espera, ou chama
`invalidateModuleCache(tenantId)`.

---

## 3. Primeiro papel de governança — só por SQL

Aqui tem um ovo-e-galinha real:

- `requireCharterContext()` exige uma `CharterMembership` para abrir **qualquer**
  tela do Charter, inclusive Configurações;
- `setMemberCharterRole` (a UI que atribui papéis) exige que quem chama já seja
  `COMPLIANCE`.

Logo, o primeiro papel de cada tenant entra no banco à mão:

```sql
INSERT INTO "CharterMembership" ("id", "tenantId", "userId", "role", "createdAt", "updatedAt")
SELECT 'cm_' || u."id", t."id", u."id", 'COMPLIANCE', now(), now()
FROM "Tenant" t
JOIN "User" u ON u."email" = '<email-do-responsavel>'
WHERE t."slug" = '<slug-do-cliente>'
ON CONFLICT ("tenantId", "userId") DO NOTHING;
```

O usuário precisa existir (ter feito login pelo menos uma vez) e ser membro do
tenant em `TenantMember` — o papel do Charter é ortogonal ao papel SAFe
(ADR-0002), não substitui.

Daí em diante os outros papéis saem pela tela de Configurações.

---

## 4. Política inicial — lacuna de produto, não de deploy

**Não existe caminho de UI para criar a política.** `policy.ts` expõe
`getPolicy`, `editSection`, `setSectionStatus`, `publishPolicyVersion` — nenhuma
ação cria `CharterPolicy` nem as seções. Quem cria é o seed. A tela vazia diz
isso em voz alta: *"Nenhuma política foi criada nesta organização. O seed inicial
cria a estrutura de nove seções."*

Consequência prática: um cliente real com o módulo contratado e o papel
atribuído abre `/charter/policy` e não tem botão nenhum para começar. E sem
política publicada, Onboarding não publica trilha (`publishTrack` exige versão
publicada) e o intake não tem versão para carimbar.

Três saídas, em ordem de preferência:

1. **Uma action de bootstrap** que cria a política com as nove seções em
   `DRAFT` — pequena, é a que fecha o produto. Umas poucas dezenas de linhas.
2. SQL de provisionamento junto com o item 2 acima (funciona, mas vira ritual
   manual em todo cliente novo).
3. Adaptar o seed para um modo "estrutura sem dado demo" — mais trabalho que a
   opção 1.

---

## 5. O seed **não** roda em produção

`pnpm seed:charter` começa com `wipe()`, que apaga casos, decisões, mitigações,
fornecedores, cláusulas, políticas e versões **daquele tenant**, e depois cria
personas com senha padrão (`charter123`). É fixture de demo. Rodar contra um
tenant de cliente destrói o que existir e cria contas com senha conhecida.

`pnpm verify:charter` é somente leitura, mas confere as fixtures do tenant
`medcore` — não serve como smoke test de produção. O smoke de produção é manual:
login → `/charter` → dashboard carrega → uma tela de cada área.

---

## 6. Risco aberto: RLS não está valendo (ADR-0012)

As 15 tabelas têm RLS declarada e forçada, e mesmo assim **o isolamento não vale
em runtime**: a aplicação conecta como `postgres`, que é superuser e portanto
tem `BYPASSRLS` implícito. `FORCE ROW LEVEL SECURITY` alcança o dono da tabela,
não quem tem bypass. Quem isola hoje é o filtro por `tenantId` que o
`withTenantDb()` aplica em toda query — isolamento de aplicação, não de banco.

Isso é anterior ao Charter (vale para todo o Cosmos); o Charter só construiu o
verificador que expôs. Com mais de um cliente no mesmo banco, isso deixa de ser
risco teórico.

A correção é operacional:

```sql
-- 1. papel de aplicação, sem SUPERUSER e sem BYPASSRLS
CREATE ROLE cosmos_app LOGIN PASSWORD '<senha>';

-- 2. grants nas tabelas (sem UPDATE/DELETE em AuditLog — ADR-0009)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cosmos_app;
REVOKE UPDATE, DELETE ON "AuditLog" FROM cosmos_app;
GRANT USAGE ON SCHEMA public TO cosmos_app;

-- 3. conferir que não herdou bypass
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'cosmos_app';
```

Depois: `DATABASE_URL` da aplicação aponta para `cosmos_app`; `postgres` fica só
para migrations. Isso afeta **todo o Cosmos** — migrations, seeds, scripts,
jobs Inngest — então merece uma janela própria, não carona num deploy.

---

## 7. Tenant novo nasce sem módulo nenhum

`createTenant` (`apps/app/app/actions/onboarding.ts`) cria o `Tenant` e não cria
nenhuma linha em `TenantModule`. Hoje isso não quebra o Cosmos, porque só o
Charter usa o gate de módulo — mas significa que todo cliente novo precisa de um
INSERT manual para ter Charter, e que o dia em que o Cosmos passar a checar o
módulo, cadastro novo nasce sem acesso a nada.

Se a ideia é vender por módulo, o provisionamento pertence ao fluxo de criação
do tenant.

---

## Sequência mínima para um cliente

Atualizada em 2026-08-31 — três passos manuais viraram dois cliques.

1. `ENCRYPTION_KEY` na Vercel · deploy verde
2. `prisma migrate deploy` no banco de produção
3. `/clientes/novo` — provisiona o tenant já com `CHARTER` contratado
   (substitui os INSERTs dos itens 2 e 3)
4. `/clientes/<slug>` — bootstrap do Charter com o e-mail do responsável:
   papel `COMPLIANCE`, configurações e a política com as nove seções em `DRAFT`
   (substitui o item 4). O responsável precisa ter entrado ao menos uma vez.
5. Smoke manual das telas

O item 6 (ADR-0012) não bloqueia o primeiro cliente, mas bloqueia o segundo.
