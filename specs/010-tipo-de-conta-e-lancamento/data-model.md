# Data Model: Tipo de conta e lançamento por coorte (Fase 1)

## Tenant (`packages/database/prisma/schema/tenant.prisma`)

| Campo | Antes | Depois |
|---|---|---|
| `isSystem` | `Boolean @default(false)` (linha 36) | removido (ou mantido como coluna morta, decisão técnica do Alicerce) |
| `isInternalTenant` | `Boolean @default(false)` (linha 42) | removido (idem) |
| `type` | não existe | **novo**: `TenantType @default(CLIENTE)` |

```prisma
enum TenantType {
  CLIENTE
  INTERNA
  TESTE
  DEMO
  SISTEMA
}
```

Mapeamento de migração de dado (FR-002, ADR-0018):

| Condição hoje | `type` novo |
|---|---|
| `isSystem = true` | `SISTEMA` |
| `isInternalTenant = true` | `INTERNA` |
| slug em `nebula`, `dev-teste`, `nebuloz-novo-cliente` | `TESTE` |
| slug `medcore` | `DEMO` |
| qualquer outro | `CLIENTE` |

Sem novo índice — `Tenant.id`/`slug` já são as chaves de busca usadas por
todo call site migrado (research.md §1).

## TenantContext (`packages/auth/server.ts:155-160`)

```ts
export type TenantContext = {
  userId: string;
  tenantId: string;
  role: MemberRole;
  user: AuthUser;
  tenantType: TenantType; // novo
};
```

Resolvido dentro de `requireTenantSession` (linhas 195-259), na mesma
consulta que já busca a sessão/membership — sem query adicional por
chamador. É a base de FR-011 (guards) e evita reconsultar `Tenant.type` em
cada um dos 4 `requireModule`.

## Lista de acesso antecipado / Lista geral de lançados

Não são tabela — constantes de código em
`apps/app/app/actions/produtos/lancamento.ts` (novo):

```ts
export const LANCAMENTO_ANTECIPADO: ProductModule[] = ["MERIDIAN", ...];
export const LANCAMENTO_GERAL: ProductModule[] = ["MERIDIAN"];
```

Regra: todo módulo em `LANCAMENTO_GERAL` está implicitamente em
`LANCAMENTO_ANTECIPADO` (Edge Case do spec — a lista antecipada é
estritamente "antes" da geral, nunca um conjunto disjunto).

## EstadoDoProduto (`apps/app/app/actions/produtos/index.ts:32-41`)

Novo valor no union existente:

```ts
export type EstadoDoProduto =
  | "DISPONIVEL"
  | "SEM_CONTRATO"
  | "SUSPENSO"
  | "CANCELADO"
  | "EXPIRADO"
  | "NAO_LANCADO"; // novo — contratado e vigente, mas fora da lista aplicável
```

`listarProdutos()` calcula `NAO_LANCADO` quando `abre` (contrato OK) é
`true` **e** o módulo não está na lista aplicável ao `tenantType` da
sessão — antes de cair no `DISPONIVEL` de hoje.

## AuditLog (`packages/database/prisma/schema/system.prisma:81`, reusado)

Sem mudança de schema. Uma linha nova por troca de `Tenant.type`:

| Campo | Valor |
|---|---|
| `entityType` | `"tenant"` |
| `entityId` | id do tenant afetado |
| `action` | `"updated"` |
| `diff` | `[["type", "<antes>", "<depois>"]]` |
| `actorId`/`actorType` | staff que executou (via `logPlatformAudit`) |
