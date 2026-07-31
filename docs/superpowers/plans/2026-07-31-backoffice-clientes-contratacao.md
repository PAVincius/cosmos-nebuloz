# Back-office de clientes e contratação — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir por telas os `INSERT` manuais que hoje colocam um cliente em produção — contratar módulo, provisionar tenant e dar o primeiro papel de governança do Charter.

**Architecture:** A regra de negócio vai para `packages/provisioning` (server-only), consumida tanto pelo app novo `apps/backoffice` quanto pelo onboarding self-service que já existe em `apps/app`. O back-office é um Next app próprio, com deploy próprio, protegido por um guard único (`requirePlatformStaff`) que exige membership no tenant interno `__system__`. O acesso cross-tenant passa por uma porta única e declarada, `platformDb`.

**Tech Stack:** Next.js 16 (App Router), TypeScript 5.9, Prisma + PostgreSQL, Better Auth (`@repo/auth`), shadcn/ui (`@repo/design-system`), Vitest, Biome/ultracite, pnpm + Turborepo.

**Spec:** [`docs/superpowers/specs/2026-07-31-backoffice-clientes-contratacao-design.md`](../specs/2026-07-31-backoffice-clientes-contratacao-design.md)

## Global Constraints

- **Nenhum modelo novo no schema.** A fatia A usa `Tenant`, `TenantModule`, `TenantMember`, `TenantInvitation`, `AuditLog` e as tabelas do Charter, todos existentes. Nenhuma migration nesta fatia.
- **`platformDb` só pode ser importado por `packages/provisioning` e `apps/backoffice`.** Nenhum arquivo de `apps/app` a importa.
- **Toda listagem de cliente filtra `isSystem: false`.** O tenant `__system__` não é cliente.
- **Toda função que escreve grava `AuditLog`** com `tenantId` do alvo, `actorId` do staff e `actorType: "user"`.
- **Escrita em tabela do Charter roda dentro de `withTenantDb(tenantId)`** — a RLS está `FORCE` e recusa `INSERT` sem `app.tenant_id`, inclusive para o dono da tabela.
- **`invalidateModuleCache(tenantId)` depois de toda mudança em `TenantModule`** — o cache de módulos tem TTL de 5 minutos.
- **Biome:** nunca rodar `biome check --write --unsafe` neste repositório. O `--write` (seguro) é o que o hook de commit já roda.
- **Comentário explica porquê, não o quê.** Só onde a razão não é óbvia pelo código.
- Idioma do código e dos comentários: português, como o resto de `packages/rbac` e do Charter.

---

## Estrutura de arquivos

**`packages/provisioning`** (novo, server-only)

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.mts` | scaffold do package, espelhando `packages/safe-engine` |
| `src/index.ts` | superfície pública: as quatro funções e os tipos de erro |
| `src/platform-db.ts` | a porta única de acesso cross-tenant |
| `src/errors.ts` | `ProvisioningError` com códigos nomeados |
| `src/slug.ts` | `slugify` e `uniqueSlug` — funções puras/consulta, testáveis isoladamente |
| `src/audit.ts` | `logPlatformAudit` — uma escrita de `AuditLog` com o formato de staff |
| `src/tenant.ts` | `provisionTenant` |
| `src/modules.ts` | `contractModule`, `setModuleStatus` |
| `src/charter.ts` | `bootstrapCharter` e a constante das nove seções |
| `src/__tests__/*.test.ts` | um arquivo por módulo acima |

**`apps/backoffice`** (novo)

| Arquivo | Responsabilidade |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `env.ts`, `vitest.config.mts` | scaffold, espelhando `apps/web` |
| `lib/guard.ts` | `requirePlatformStaff` — o único guard |
| `lib/safe-action.ts` | `Result`, `ok`, `err`, `safeAction` finos, sem contexto de tenant |
| `app/layout.tsx`, `app/page.tsx` | casca e lista de clientes |
| `app/clientes/[slug]/page.tsx` | detalhe do cliente |
| `app/clientes/novo/page.tsx` | provisionar |
| `app/atividade/page.tsx` | trilha do staff |
| `app/actions/clients.ts` | leituras (lista, detalhe, atividade) |
| `app/actions/provisioning.ts` | escritas, delegando ao package |
| `__tests__/*.test.ts` | guard, vazamento de listagem |

**Modificado:** `apps/app/app/actions/onboarding.ts` (passa a chamar `provisionTenant`).

---

## Task 1: Scaffold do package e a porta `platformDb`

**Files:**
- Create: `packages/provisioning/package.json`
- Create: `packages/provisioning/tsconfig.json`
- Create: `packages/provisioning/vitest.config.mts`
- Create: `packages/provisioning/src/platform-db.ts`
- Create: `packages/provisioning/src/errors.ts`
- Create: `packages/provisioning/src/index.ts`
- Create: `packages/provisioning/src/__tests__/errors.test.ts`
- Create: `docs/adr/0013-porta-unica-de-acesso-cross-tenant.md`

**Interfaces:**
- Consumes: `@repo/database` (`database`, `withTenantDb`)
- Produces: `platformDb`, `ProvisioningError`, `ProvisioningErrorCode`

- [ ] **Step 1: Criar o scaffold do package**

`packages/provisioning/package.json`:

```json
{
  "name": "@repo/provisioning",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@repo/database": "workspace:*",
    "@repo/rbac": "workspace:*",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "24.10.1",
    "@vitest/coverage-v8": "4.0.15",
    "typescript": "^5.9.3",
    "vitest": "^4.0.15"
  }
}
```

`packages/provisioning/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

`packages/provisioning/vitest.config.mts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 2: Escrever o teste que falha**

`packages/provisioning/src/__tests__/errors.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ProvisioningError } from "../errors";

describe("ProvisioningError", () => {
  it("carrega o código para quem trata o erro decidir sem ler a mensagem", () => {
    const error = new ProvisioningError("SLUG_EXHAUSTED", "Sem slug livre.");

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("SLUG_EXHAUSTED");
    expect(error.message).toBe("Sem slug livre.");
    expect(error.name).toBe("ProvisioningError");
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @repo/provisioning test
```

Esperado: FAIL — `Failed to resolve import "../errors"`.

- [ ] **Step 4: Implementar**

`packages/provisioning/src/errors.ts`:

```typescript
export type ProvisioningErrorCode =
  | "SLUG_EXHAUSTED"
  | "TENANT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "CHARTER_MODULE_MISSING"
  | "CHARTER_ALREADY_BOOTSTRAPPED";

/** Erro de provisionamento com causa nomeada. A UI traduz pelo `code`, nunca
 *  pela mensagem — mensagem é para humano, código é para máquina. */
export class ProvisioningError extends Error {
  readonly code: ProvisioningErrorCode;

  constructor(code: ProvisioningErrorCode, message: string) {
    super(message);
    this.name = "ProvisioningError";
    this.code = code;
  }
}
```

`packages/provisioning/src/platform-db.ts`:

```typescript
import "server-only";
import { database } from "@repo/database";

/**
 * A porta única de acesso cross-tenant.
 *
 * Todo o produto lê e escreve por `withTenantDb(tenantId)`, que seta
 * `app.tenant_id` e filtra. O back-office é a primeira superfície que
 * legitimamente precisa enxergar através dos tenants — e isso não pode virar
 * um padrão difuso espalhado pelo código.
 *
 * Regras (ver ADR-0013):
 *   1. só `packages/provisioning` e `apps/backoffice` importam daqui;
 *   2. toda listagem de cliente filtra `isSystem: false`;
 *   3. escrita em tabela do Charter continua indo por `withTenantDb` — a RLS
 *      está FORCE e recusa INSERT sem contexto de tenant.
 */
export const platformDb = database;
```

`packages/provisioning/src/index.ts`:

```typescript
export { ProvisioningError, type ProvisioningErrorCode } from "./errors";
export { platformDb } from "./platform-db";
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @repo/provisioning test
```

Esperado: PASS (1 teste).

- [ ] **Step 6: Escrever o ADR**

`docs/adr/0013-porta-unica-de-acesso-cross-tenant.md`:

```markdown
# ADR-0013 — Porta única de acesso cross-tenant

**Status**: Accepted
**Data**: 2026-07-31

## Contexto

Todo acesso a dado no produto passa por `withTenantDb(tenantId)`: ele seta
`app.tenant_id` na sessão e filtra a query pelo tenant. Isso é o que sustenta o
isolamento hoje (ver ADR-0012 sobre a RLS não valer enquanto a conexão for
superuser).

O back-office de clientes precisa do oposto: listar todos os tenants, ver o que
cada um contratou. É a primeira necessidade legítima de leitura cross-tenant no
sistema.

## Decisão

Uma porta única e nomeada: `platformDb`, em `packages/provisioning`.

- Importada apenas por `packages/provisioning` e `apps/backoffice`.
- Toda listagem de cliente filtra `isSystem = false` — o tenant interno não é
  cliente, e a coluna existe exatamente para isso.
- Escrita em tabela do Charter continua indo por `withTenantDb`.

Um teste falha se `apps/app` importar `platformDb`.

## Consequências

Acesso cross-tenant fica greppável: uma importação, um lugar. Quem revisar um PR
que amplia essa superfície vê o import e sabe o que perguntar.

Quando o papel de aplicação sem `BYPASSRLS` existir (ADR-0012), a fronteira
deixa de ser convenção: o app do cliente conecta com um papel que não enxerga
outros tenants, o back-office com um que enxerga.
```

- [ ] **Step 7: Instalar e verificar o workspace**

```bash
pnpm install
pnpm --filter @repo/provisioning typecheck
```

Esperado: sem erro.

- [ ] **Step 8: Commit**

```bash
git add packages/provisioning docs/adr/0013-porta-unica-de-acesso-cross-tenant.md pnpm-lock.yaml
git commit -m "feat(provisioning): scaffold do package e porta única de acesso cross-tenant"
```

---

## Task 2: Slug de tenant

**Files:**
- Create: `packages/provisioning/src/slug.ts`
- Create: `packages/provisioning/src/__tests__/slug.test.ts`
- Modify: `packages/provisioning/src/index.ts`

**Interfaces:**
- Consumes: `ProvisioningError` (Task 1)
- Produces: `slugify(name: string): string`, `uniqueSlug(db: SlugChecker, name: string): Promise<string>` onde `SlugChecker = { tenant: { findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null> } }`

- [ ] **Step 1: Escrever o teste que falha**

`packages/provisioning/src/__tests__/slug.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { ProvisioningError } from "../errors";
import { slugify, uniqueSlug } from "../slug";

function checkerWithTaken(taken: string[]) {
  return {
    tenant: {
      findUnique: ({ where }: { where: { slug: string } }) =>
        Promise.resolve(taken.includes(where.slug) ? { id: "x" } : null),
    },
  };
}

describe("slugify", () => {
  it("remove acento, caixa e pontuação", () => {
    expect(slugify("Clínica São José Ltda.")).toBe("clinica-sao-jose-ltda");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(slugify("  -- Vanta -- ")).toBe("vanta");
  });

  it("corta em 48 caracteres para caber no limite de slug", () => {
    expect(slugify("a".repeat(80))).toHaveLength(48);
  });
});

describe("uniqueSlug", () => {
  it("devolve o slug base quando está livre", async () => {
    const slug = await uniqueSlug(checkerWithTaken([]), "Vanta Saúde");
    expect(slug).toBe("vanta-saude");
  });

  it("desempata com sufixo numérico quando o base está tomado", async () => {
    const slug = await uniqueSlug(
      checkerWithTaken(["vanta-saude", "vanta-saude-1"]),
      "Vanta Saúde"
    );
    expect(slug).toBe("vanta-saude-2");
  });

  it("falha com SLUG_EXHAUSTED em vez de girar para sempre", async () => {
    const taken = [
      "vanta",
      ...Array.from({ length: 10 }, (_, i) => `vanta-${i + 1}`),
    ];

    await expect(uniqueSlug(checkerWithTaken(taken), "Vanta")).rejects.toThrow(
      ProvisioningError
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @repo/provisioning test
```

Esperado: FAIL — `Failed to resolve import "../slug"`.

- [ ] **Step 3: Implementar**

`packages/provisioning/src/slug.ts`:

```typescript
const DIACRITICS = /[̀-ͯ]/g;
const NON_ALPHANUM = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-|-$/g;
const MAX_SLUG_LENGTH = 48;
const MAX_ATTEMPTS = 10;

import { ProvisioningError } from "./errors";

export type SlugChecker = {
  tenant: {
    findUnique: (args: {
      where: { slug: string };
    }) => Promise<{ id: string } | null>;
  };
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(NON_ALPHANUM, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, MAX_SLUG_LENGTH);
}

/** Slug livre para o nome dado. O desempate é numérico e limitado: dez tentativas
 *  bastam para colisão honesta, e mais que isso é sinal de nome degenerado, não
 *  de azar. */
export async function uniqueSlug(
  db: SlugChecker,
  name: string
): Promise<string> {
  const base = slugify(name);
  let candidate = base;

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const taken = await db.tenant.findUnique({ where: { slug: candidate } });
    if (!taken) {
      return candidate;
    }
    candidate = `${base}-${attempt + 1}`;
  }

  throw new ProvisioningError(
    "SLUG_EXHAUSTED",
    `Nenhum slug livre para "${name}" após ${MAX_ATTEMPTS} tentativas.`
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @repo/provisioning test
```

Esperado: PASS (7 testes).

- [ ] **Step 5: Exportar na superfície pública**

Em `packages/provisioning/src/index.ts`, adicionar:

```typescript
export { slugify, uniqueSlug, type SlugChecker } from "./slug";
```

- [ ] **Step 6: Commit**

```bash
git add packages/provisioning
git commit -m "feat(provisioning): slug de tenant com desempate limitado"
```

---

## Task 3: Trilha de auditoria do staff

**Files:**
- Create: `packages/provisioning/src/audit.ts`
- Create: `packages/provisioning/src/__tests__/audit.test.ts`
- Modify: `packages/provisioning/src/index.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores
- Produces: `logPlatformAudit(db, entry): Promise<void>` com `entry: { tenantId: string; actorUserId: string; actorName?: string | null; action: string; entityType: string; entityId: string; target: string; note?: string; diff?: [string, string, string][] }`

- [ ] **Step 1: Escrever o teste que falha**

`packages/provisioning/src/__tests__/audit.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { logPlatformAudit } from "../audit";

describe("logPlatformAudit", () => {
  it("grava o alvo no tenant do cliente, com o staff como ator", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const db = { auditLog: { create } };

    await logPlatformAudit(db, {
      tenantId: "tenant-abc",
      actorUserId: "user-staff",
      actorName: "Vinícius",
      action: "module.contracted",
      entityType: "TenantModule",
      entityId: "tm-1",
      target: "vanta-saude · CHARTER",
    });

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];

    expect(data.tenantId).toBe("tenant-abc");
    expect(data.actorId).toBe("user-staff");
    expect(data.actorType).toBe("user");
    expect(data.action).toBe("module.contracted");
    expect(data.metadata).toMatchObject({
      target: "vanta-saude · CHARTER",
      actorName: "Vinícius",
      platformStaff: true,
    });
  });

  it("marca platformStaff mesmo sem nome do ator", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-2" });

    await logPlatformAudit(
      { auditLog: { create } },
      {
        tenantId: "tenant-abc",
        actorUserId: "user-staff",
        action: "tenant.provisioned",
        entityType: "Tenant",
        entityId: "tenant-abc",
        target: "vanta-saude",
      }
    );

    const { data } = create.mock.calls[0][0];
    expect(data.metadata.platformStaff).toBe(true);
    expect(data.metadata.actorName).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @repo/provisioning test src/__tests__/audit.test.ts
```

Esperado: FAIL — `Failed to resolve import "../audit"`.

- [ ] **Step 3: Implementar**

`packages/provisioning/src/audit.ts`:

```typescript
export type AuditDiff = [field: string, before: string, after: string][];

export type PlatformAuditEntry = {
  tenantId: string;
  actorUserId: string;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  /** Alvo legível: "vanta-saude · CHARTER". */
  target: string;
  note?: string;
  diff?: AuditDiff;
};

type AuditWriter = {
  auditLog: { create: (args: { data: unknown }) => Promise<unknown> };
};

/** Ato de staff registrado no tenant do CLIENTE, não no tenant interno: quem
 *  audita a conta do cliente procura pela conta do cliente. O `platformStaff`
 *  é o que separa esses atos dos do próprio cliente na leitura. */
export async function logPlatformAudit(
  db: AuditWriter,
  entry: PlatformAuditEntry
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      userId: entry.actorUserId,
      actorId: entry.actorUserId,
      actorType: "user",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      diff: entry.diff ?? null,
      metadata: {
        target: entry.target,
        note: entry.note ?? null,
        actorName: entry.actorName ?? null,
        platformStaff: true,
      },
    },
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @repo/provisioning test src/__tests__/audit.test.ts
```

Esperado: PASS (2 testes).

- [ ] **Step 5: Exportar**

Em `packages/provisioning/src/index.ts`:

```typescript
export { logPlatformAudit, type PlatformAuditEntry } from "./audit";
```

- [ ] **Step 6: Commit**

```bash
git add packages/provisioning
git commit -m "feat(provisioning): trilha de auditoria dos atos de staff"
```

---

## Task 4: `contractModule` e `setModuleStatus`

**Files:**
- Create: `packages/provisioning/src/modules.ts`
- Create: `packages/provisioning/src/__tests__/modules.test.ts`
- Modify: `packages/provisioning/src/index.ts`

**Interfaces:**
- Consumes: `logPlatformAudit` (Task 3), `ProvisioningError` (Task 1)
- Produces:
  - `contractModule(db, deps, input): Promise<{ id: string }>` com `input: { tenantId: string; module: ProductModule; status?: ModuleStatus; seats?: number | null; expiresAt?: Date | null; actorUserId: string; actorName?: string | null }`
  - `setModuleStatus(db, deps, input): Promise<{ id: string }>` com `input: { tenantId: string; module: ProductModule; status: ModuleStatus; actorUserId: string; actorName?: string | null }`
  - `deps: { invalidateModuleCache: (tenantId: string) => Promise<void> }`

- [ ] **Step 1: Escrever o teste que falha**

`packages/provisioning/src/__tests__/modules.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contractModule, setModuleStatus } from "../modules";

function makeDb() {
  return {
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "tenant-abc", slug: "vanta-saude" }),
    },
    tenantModule: {
      upsert: vi.fn().mockResolvedValue({ id: "tm-1" }),
      update: vi.fn().mockResolvedValue({ id: "tm-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

describe("contractModule", () => {
  let db: ReturnType<typeof makeDb>;
  let invalidateModuleCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = makeDb();
    invalidateModuleCache = vi.fn().mockResolvedValue(undefined);
  });

  it("faz upsert do módulo com ACTIVE por padrão", async () => {
    await contractModule(db, { invalidateModuleCache }, {
      tenantId: "tenant-abc",
      module: "CHARTER",
      actorUserId: "user-staff",
    });

    const args = db.tenantModule.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      tenantId_module: { tenantId: "tenant-abc", module: "CHARTER" },
    });
    expect(args.create.status).toBe("ACTIVE");
    expect(args.update.status).toBe("ACTIVE");
  });

  it("invalida o cache — sem isso o cliente espera 5 min para ver o módulo", async () => {
    await contractModule(db, { invalidateModuleCache }, {
      tenantId: "tenant-abc",
      module: "CHARTER",
      actorUserId: "user-staff",
    });

    expect(invalidateModuleCache).toHaveBeenCalledWith("tenant-abc");
  });

  it("registra na trilha com o slug e o módulo no alvo", async () => {
    await contractModule(db, { invalidateModuleCache }, {
      tenantId: "tenant-abc",
      module: "CHARTER",
      actorUserId: "user-staff",
    });

    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("module.contracted");
    expect(data.metadata.target).toBe("vanta-saude · CHARTER");
  });

  it("rodar duas vezes não cria duas linhas — upsert, não create", async () => {
    const input = {
      tenantId: "tenant-abc",
      module: "CHARTER" as const,
      actorUserId: "user-staff",
    };

    await contractModule(db, { invalidateModuleCache }, input);
    await contractModule(db, { invalidateModuleCache }, input);

    expect(db.tenantModule.upsert).toHaveBeenCalledTimes(2);
    expect(
      (db.tenantModule as unknown as { create?: unknown }).create
    ).toBeUndefined();
  });

  it("falha com TENANT_NOT_FOUND quando o tenant não existe", async () => {
    db.tenant.findUnique.mockResolvedValue(null);

    await expect(
      contractModule(db, { invalidateModuleCache }, {
        tenantId: "nao-existe",
        module: "CHARTER",
        actorUserId: "user-staff",
      })
    ).rejects.toMatchObject({ code: "TENANT_NOT_FOUND" });
  });
});

describe("setModuleStatus", () => {
  it("suspende sem apagar dado e invalida o cache", async () => {
    const db = makeDb();
    const invalidateModuleCache = vi.fn().mockResolvedValue(undefined);

    await setModuleStatus(db, { invalidateModuleCache }, {
      tenantId: "tenant-abc",
      module: "CHARTER",
      status: "SUSPENDED",
      actorUserId: "user-staff",
    });

    expect(db.tenantModule.update).toHaveBeenCalledWith({
      where: {
        tenantId_module: { tenantId: "tenant-abc", module: "CHARTER" },
      },
      data: { status: "SUSPENDED", updatedBy: "user-staff" },
    });
    expect(invalidateModuleCache).toHaveBeenCalledWith("tenant-abc");

    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("module.status_changed");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @repo/provisioning test src/__tests__/modules.test.ts
```

Esperado: FAIL — `Failed to resolve import "../modules"`.

- [ ] **Step 3: Implementar**

`packages/provisioning/src/modules.ts`:

```typescript
import type { ModuleStatus, ProductModule } from "@repo/database";
import { logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

export type ModuleDeps = {
  invalidateModuleCache: (tenantId: string) => Promise<void>;
};

type ModuleDb = {
  tenant: {
    findUnique: (args: {
      where: { id: string };
      select?: unknown;
    }) => Promise<{ id: string; slug: string } | null>;
  };
  tenantModule: {
    upsert: (args: unknown) => Promise<{ id: string }>;
    update: (args: unknown) => Promise<{ id: string }>;
  };
  auditLog: { create: (args: { data: unknown }) => Promise<unknown> };
};

export type ContractModuleInput = {
  tenantId: string;
  module: ProductModule;
  status?: ModuleStatus;
  seats?: number | null;
  expiresAt?: Date | null;
  actorUserId: string;
  actorName?: string | null;
};

async function requireTenant(db: ModuleDb, tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    throw new ProvisioningError(
      "TENANT_NOT_FOUND",
      `Nenhum tenant com id ${tenantId}.`
    );
  }
  return tenant;
}

/** Contratação de módulo. Upsert porque contratar de novo o mesmo módulo é
 *  renovação, não erro — a unique (tenantId, module) já existe no schema. */
export async function contractModule(
  db: ModuleDb,
  deps: ModuleDeps,
  input: ContractModuleInput
): Promise<{ id: string }> {
  const tenant = await requireTenant(db, input.tenantId);
  const status = input.status ?? "ACTIVE";

  const row = await db.tenantModule.upsert({
    where: {
      tenantId_module: { tenantId: input.tenantId, module: input.module },
    },
    create: {
      tenantId: input.tenantId,
      module: input.module,
      status,
      seats: input.seats ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedBy: input.actorUserId,
    },
    update: {
      status,
      seats: input.seats ?? null,
      expiresAt: input.expiresAt ?? null,
      updatedBy: input.actorUserId,
    },
  });

  // O gate lê de um cache com TTL de 5 min. Sem invalidar, o cliente contrata e
  // continua vendo "módulo não contratado" por até cinco minutos.
  await deps.invalidateModuleCache(input.tenantId);

  await logPlatformAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: "module.contracted",
    entityType: "TenantModule",
    entityId: row.id,
    target: `${tenant.slug} · ${input.module}`,
  });

  return row;
}

export type SetModuleStatusInput = {
  tenantId: string;
  module: ProductModule;
  status: ModuleStatus;
  actorUserId: string;
  actorName?: string | null;
};

/** Muda a situação da contratação. SUSPENDED e CANCELED fecham a porta sem
 *  apagar dado — é o que `hasModule` já implementa, e é o gatilho que a fatia
 *  de cobrança vai chamar quando o pagamento falhar. */
export async function setModuleStatus(
  db: ModuleDb,
  deps: ModuleDeps,
  input: SetModuleStatusInput
): Promise<{ id: string }> {
  const tenant = await requireTenant(db, input.tenantId);

  const row = await db.tenantModule.update({
    where: {
      tenantId_module: { tenantId: input.tenantId, module: input.module },
    },
    data: { status: input.status, updatedBy: input.actorUserId },
  });

  await deps.invalidateModuleCache(input.tenantId);

  await logPlatformAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: "module.status_changed",
    entityType: "TenantModule",
    entityId: row.id,
    target: `${tenant.slug} · ${input.module} → ${input.status}`,
  });

  return row;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @repo/provisioning test src/__tests__/modules.test.ts
```

Esperado: PASS (6 testes).

- [ ] **Step 5: Exportar**

Em `packages/provisioning/src/index.ts`:

```typescript
export {
  contractModule,
  setModuleStatus,
  type ContractModuleInput,
  type ModuleDeps,
  type SetModuleStatusInput,
} from "./modules";
```

- [ ] **Step 6: Commit**

```bash
git add packages/provisioning
git commit -m "feat(provisioning): contratar módulo e mudar situação, com invalidação de cache"
```

---

## Task 5: `provisionTenant`

**Files:**
- Create: `packages/provisioning/src/tenant.ts`
- Create: `packages/provisioning/src/__tests__/tenant.test.ts`
- Modify: `packages/provisioning/src/index.ts`

**Interfaces:**
- Consumes: `uniqueSlug` (Task 2), `logPlatformAudit` (Task 3), `contractModule` (Task 4)
- Produces: `provisionTenant(db, deps, input): Promise<{ tenantId: string; slug: string; ownerLinked: boolean }>` com `input: { name: string; ownerEmail: string; modules: { module: ProductModule; status?: ModuleStatus; seats?: number | null; expiresAt?: Date | null }[]; actorUserId: string; actorName?: string | null }`

- [ ] **Step 1: Escrever o teste que falha**

`packages/provisioning/src/__tests__/tenant.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { provisionTenant } from "../tenant";

const INVITE_TTL_DAYS = 14;

function makeDb(options: { ownerExists: boolean }) {
  const db = {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "tenant-new", slug: "vanta" }),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.ownerExists ? { id: "user-owner" } : null),
    },
    tenantMember: { create: vi.fn().mockResolvedValue({ id: "member-1" }) },
    tenantInvitation: { create: vi.fn().mockResolvedValue({ id: "invite-1" }) },
    tenantModule: {
      upsert: vi.fn().mockResolvedValue({ id: "tm-1" }),
      update: vi.fn().mockResolvedValue({ id: "tm-1" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  // A transação recebe o mesmo objeto: o teste prova a composição, não o
  // comportamento transacional do Prisma.
  return Object.assign(db, {
    $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) =>
      fn(db as never)
    ),
  });
}

describe("provisionTenant", () => {
  let invalidateModuleCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invalidateModuleCache = vi.fn().mockResolvedValue(undefined);
  });

  it("cria o tenant com slug derivado do nome", async () => {
    const db = makeDb({ ownerExists: true });

    const result = await provisionTenant(db, { invalidateModuleCache }, {
      name: "Vanta Saúde",
      ownerEmail: "ana@vanta.exemplo",
      modules: [{ module: "COSMOS" }],
      actorUserId: "user-staff",
    });

    expect(db.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Vanta Saúde", slug: "vanta-saude" }),
      })
    );
    expect(result.tenantId).toBe("tenant-new");
  });

  it("liga o dono como ADMIN quando o e-mail já tem conta", async () => {
    const db = makeDb({ ownerExists: true });

    const result = await provisionTenant(db, { invalidateModuleCache }, {
      name: "Vanta",
      ownerEmail: "ana@vanta.exemplo",
      modules: [],
      actorUserId: "user-staff",
    });

    expect(db.tenantMember.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-new",
        userId: "user-owner",
        role: "ADMIN",
      },
    });
    expect(db.tenantInvitation.create).not.toHaveBeenCalled();
    expect(result.ownerLinked).toBe(true);
  });

  it("deixa convite pendente quando o e-mail ainda não tem conta", async () => {
    const db = makeDb({ ownerExists: false });

    const result = await provisionTenant(db, { invalidateModuleCache }, {
      name: "Vanta",
      ownerEmail: "novo@vanta.exemplo",
      modules: [],
      actorUserId: "user-staff",
    });

    expect(db.tenantMember.create).not.toHaveBeenCalled();
    const args = db.tenantInvitation.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      tenantId: "tenant-new",
      email: "novo@vanta.exemplo",
      role: "ADMIN",
      inviterId: "user-staff",
    });
    expect(args.data.expiresAt).toBeInstanceOf(Date);
    expect(result.ownerLinked).toBe(false);
  });

  it("contrata os módulos pedidos", async () => {
    const db = makeDb({ ownerExists: true });

    await provisionTenant(db, { invalidateModuleCache }, {
      name: "Vanta",
      ownerEmail: "ana@vanta.exemplo",
      modules: [{ module: "COSMOS" }, { module: "CHARTER", status: "TRIAL" }],
      actorUserId: "user-staff",
    });

    expect(db.tenantModule.upsert).toHaveBeenCalledTimes(2);
  });

  it("registra o provisionamento na trilha", async () => {
    const db = makeDb({ ownerExists: true });

    await provisionTenant(db, { invalidateModuleCache }, {
      name: "Vanta",
      ownerEmail: "ana@vanta.exemplo",
      modules: [],
      actorUserId: "user-staff",
    });

    const actions = db.auditLog.create.mock.calls.map(
      ([{ data }]: [{ data: { action: string } }]) => data.action
    );
    expect(actions).toContain("tenant.provisioned");
  });

  it("o convite vence em 14 dias", async () => {
    const db = makeDb({ ownerExists: false });

    await provisionTenant(db, { invalidateModuleCache }, {
      name: "Vanta",
      ownerEmail: "novo@vanta.exemplo",
      modules: [],
      actorUserId: "user-staff",
    });

    const { expiresAt } = db.tenantInvitation.create.mock.calls[0][0].data;
    const days = Math.round(
      (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );
    expect(days).toBe(INVITE_TTL_DAYS);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @repo/provisioning test src/__tests__/tenant.test.ts
```

Esperado: FAIL — `Failed to resolve import "../tenant"`.

- [ ] **Step 3: Implementar**

`packages/provisioning/src/tenant.ts`:

```typescript
import type { ModuleStatus, ProductModule } from "@repo/database";
import { logPlatformAudit } from "./audit";
import { contractModule, type ModuleDeps } from "./modules";
import { uniqueSlug } from "./slug";

const INVITE_TTL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProvisionTenantInput = {
  name: string;
  ownerEmail: string;
  modules: {
    module: ProductModule;
    status?: ModuleStatus;
    seats?: number | null;
    expiresAt?: Date | null;
  }[];
  actorUserId: string;
  actorName?: string | null;
};

export type ProvisionTenantResult = {
  tenantId: string;
  slug: string;
  /** false quando o dono ainda não tem conta e ficou só o convite pendente. */
  ownerLinked: boolean;
};

type TransactionalDb = {
  $transaction: <T>(fn: (tx: never) => Promise<T>) => Promise<T>;
};

export async function provisionTenant(
  db: TransactionalDb & Record<string, unknown>,
  deps: ModuleDeps,
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const name = input.name.trim();
  const email = input.ownerEmail.trim().toLowerCase();

  return await db.$transaction(async (tx: never) => {
    // biome-ignore lint/suspicious/noExplicitAny: o cliente de transação do Prisma
    // não é tipável aqui sem arrastar o generated client para dentro do package.
    const t = tx as any;

    const slug = await uniqueSlug(t, name);
    const tenant = await t.tenant.create({ data: { name, slug } });

    const owner = await t.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (owner) {
      await t.tenantMember.create({
        data: { tenantId: tenant.id, userId: owner.id, role: "ADMIN" },
      });
    } else {
      // Vender antes da pessoa se cadastrar é a ordem normal do comercial. O
      // tenant nasce sem dono e o convite espera.
      await t.tenantInvitation.create({
        data: {
          tenantId: tenant.id,
          email,
          role: "ADMIN",
          inviterId: input.actorUserId,
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS),
        },
      });
    }

    for (const mod of input.modules) {
      await contractModule(t, deps, {
        tenantId: tenant.id,
        module: mod.module,
        status: mod.status,
        seats: mod.seats,
        expiresAt: mod.expiresAt,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
      });
    }

    await logPlatformAudit(t, {
      tenantId: tenant.id,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "tenant.provisioned",
      entityType: "Tenant",
      entityId: tenant.id,
      target: tenant.slug,
      note: owner ? `dono ${email}` : `convite pendente para ${email}`,
    });

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      ownerLinked: Boolean(owner),
    };
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @repo/provisioning test src/__tests__/tenant.test.ts
```

Esperado: PASS (6 testes).

- [ ] **Step 5: Exportar**

Em `packages/provisioning/src/index.ts`:

```typescript
export {
  provisionTenant,
  type ProvisionTenantInput,
  type ProvisionTenantResult,
} from "./tenant";
```

- [ ] **Step 6: Commit**

```bash
git add packages/provisioning
git commit -m "feat(provisioning): provisionar tenant com dono ou convite pendente"
```

---

## Task 6: `bootstrapCharter`

**Files:**
- Create: `packages/provisioning/src/charter.ts`
- Create: `packages/provisioning/src/__tests__/charter.test.ts`
- Modify: `packages/provisioning/src/index.ts`

**Interfaces:**
- Consumes: `logPlatformAudit` (Task 3), `ProvisioningError` (Task 1)
- Produces: `bootstrapCharter(deps, input): Promise<{ policyId: string; created: boolean }>` com `input: { tenantId: string; complianceEmail: string; actorUserId: string; actorName?: string | null }` e `deps: { withTenantDb: <T>(tenantId: string, fn: (db: never) => Promise<T>) => Promise<T> }`; constante `POLICY_SECTIONS: { ordinal: number; name: string }[]`

- [ ] **Step 1: Escrever o teste que falha**

`packages/provisioning/src/__tests__/charter.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { bootstrapCharter, POLICY_SECTIONS } from "../charter";

function makeDb(options: { policyExists?: boolean; userExists?: boolean } = {}) {
  const { policyExists = false, userExists = true } = options;
  return {
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(userExists ? { id: "user-compliance" } : null),
    },
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "tenant-abc", slug: "vanta-saude" }),
    },
    charterMembership: { upsert: vi.fn().mockResolvedValue({ id: "cm-1" }) },
    charterSettings: { upsert: vi.fn().mockResolvedValue({ id: "cs-1" }) },
    charterPolicy: {
      findFirst: vi
        .fn()
        .mockResolvedValue(policyExists ? { id: "policy-existente" } : null),
      create: vi.fn().mockResolvedValue({ id: "policy-novo" }),
    },
    charterPolicySection: { createMany: vi.fn().mockResolvedValue({ count: 9 }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

function depsFor(db: ReturnType<typeof makeDb>) {
  return {
    withTenantDb: vi.fn(
      async (_tenantId: string, fn: (client: never) => Promise<unknown>) =>
        fn(db as never)
    ),
  };
}

describe("bootstrapCharter", () => {
  it("cria a política com as nove seções em DRAFT", async () => {
    const db = makeDb();

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(true);
    const { data } = db.charterPolicySection.createMany.mock.calls[0][0];
    expect(data).toHaveLength(9);
    expect(data.every((s: { status: string }) => s.status === "DRAFT")).toBe(true);
    expect(data.map((s: { ordinal: number }) => s.ordinal)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it("dá o papel COMPLIANCE ao responsável", async () => {
    const db = makeDb();

    await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    const args = db.charterMembership.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({
      tenantId: "tenant-abc",
      userId: "user-compliance",
      role: "COMPLIANCE",
    });
  });

  it("escreve dentro de withTenantDb — a RLS do Charter recusa INSERT sem contexto", async () => {
    const db = makeDb();
    const deps = depsFor(db);

    await bootstrapCharter(deps as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(deps.withTenantDb).toHaveBeenCalledWith(
      "tenant-abc",
      expect.any(Function)
    );
  });

  it("é idempotente: com política existente não cria outra", async () => {
    const db = makeDb({ policyExists: true });

    const result = await bootstrapCharter(depsFor(db) as never, {
      tenantId: "tenant-abc",
      complianceEmail: "ana@vanta.exemplo",
      actorUserId: "user-staff",
    });

    expect(result.created).toBe(false);
    expect(db.charterPolicy.create).not.toHaveBeenCalled();
    expect(db.charterPolicySection.createMany).not.toHaveBeenCalled();
    // O papel continua sendo garantido — upsert, não create.
    expect(db.charterMembership.upsert).toHaveBeenCalledTimes(1);
  });

  it("falha com USER_NOT_FOUND quando o e-mail não tem conta", async () => {
    const db = makeDb({ userExists: false });

    await expect(
      bootstrapCharter(depsFor(db) as never, {
        tenantId: "tenant-abc",
        complianceEmail: "ninguem@vanta.exemplo",
        actorUserId: "user-staff",
      })
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("a lista de seções tem nove entradas com ordinal único", () => {
    expect(POLICY_SECTIONS).toHaveLength(9);
    expect(new Set(POLICY_SECTIONS.map((s) => s.ordinal)).size).toBe(9);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
pnpm --filter @repo/provisioning test src/__tests__/charter.test.ts
```

Esperado: FAIL — `Failed to resolve import "../charter"`.

- [ ] **Step 3: Implementar**

`packages/provisioning/src/charter.ts`:

```typescript
import { logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

/** As nove seções do Charter, na ordem do SRD. Só a estrutura: o corpo nasce
 *  vazio e é escrito pelo cliente na tela de Política. */
export const POLICY_SECTIONS: { ordinal: number; name: string }[] = [
  { ordinal: 1, name: "Perfil organizacional e contexto" },
  { ordinal: 2, name: "Classificação de dados" },
  { ordinal: 3, name: "Usos permitidos" },
  { ordinal: 4, name: "Usos restritos" },
  { ordinal: 5, name: "Usos proibidos" },
  { ordinal: 6, name: "IA voltada ao cliente" },
  { ordinal: 7, name: "Requisitos de aprovação" },
  { ordinal: 8, name: "Human-in-the-loop" },
  { ordinal: 9, name: "Escalonamento e exceções" },
];

export type BootstrapCharterDeps = {
  withTenantDb: <T>(tenantId: string, fn: (db: never) => Promise<T>) => Promise<T>;
};

export type BootstrapCharterInput = {
  tenantId: string;
  complianceEmail: string;
  actorUserId: string;
  actorName?: string | null;
};

/**
 * Deixa o Charter utilizável para um tenant: papel COMPLIANCE, configurações e
 * a política com as nove seções em DRAFT.
 *
 * Existe porque nenhuma action do produto cria política — só o seed criava, e
 * seed não roda em produção. Sem isto, um cliente com o módulo contratado abre
 * a tela de Política e não tem por onde começar.
 *
 * Roda inteiro dentro de `withTenantDb`: a RLS do Charter está FORCE e recusa
 * INSERT sem `app.tenant_id`, inclusive para o dono da tabela.
 */
export async function bootstrapCharter(
  deps: BootstrapCharterDeps,
  input: BootstrapCharterInput
): Promise<{ policyId: string; created: boolean }> {
  return await deps.withTenantDb(input.tenantId, async (client) => {
    // biome-ignore lint/suspicious/noExplicitAny: o cliente com contexto de tenant
    // não é tipável aqui sem arrastar o generated client para dentro do package.
    const db = client as any;

    const tenant = await db.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      throw new ProvisioningError(
        "TENANT_NOT_FOUND",
        `Nenhum tenant com id ${input.tenantId}.`
      );
    }

    const email = input.complianceEmail.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      throw new ProvisioningError(
        "USER_NOT_FOUND",
        `Nenhuma conta com o e-mail ${email}. A pessoa precisa entrar ao menos uma vez antes de receber o papel.`
      );
    }

    await db.charterMembership.upsert({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: user.id },
      },
      create: {
        tenantId: input.tenantId,
        userId: user.id,
        role: "COMPLIANCE",
        updatedBy: input.actorUserId,
      },
      update: { role: "COMPLIANCE", updatedBy: input.actorUserId },
    });

    await db.charterSettings.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId },
      update: {},
    });

    const existing = await db.charterPolicy.findFirst({
      where: { tenantId: input.tenantId },
      select: { id: true },
    });

    if (existing) {
      await logPlatformAudit(db, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        action: "charter.bootstrap_skipped",
        entityType: "CharterPolicy",
        entityId: existing.id,
        target: `${tenant.slug} · política já existia`,
      });
      return { policyId: existing.id, created: false };
    }

    const policy = await db.charterPolicy.create({
      data: { tenantId: input.tenantId, name: "Política de Uso de IA" },
    });

    await db.charterPolicySection.createMany({
      data: POLICY_SECTIONS.map((section) => ({
        tenantId: input.tenantId,
        policyId: policy.id,
        ordinal: section.ordinal,
        name: section.name,
        status: "DRAFT",
        body: "",
      })),
    });

    await logPlatformAudit(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "charter.bootstrapped",
      entityType: "CharterPolicy",
      entityId: policy.id,
      target: `${tenant.slug} · ${POLICY_SECTIONS.length} seções`,
    });

    return { policyId: policy.id, created: true };
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
pnpm --filter @repo/provisioning test
```

Esperado: PASS (todos os arquivos, 6 testes novos).

- [ ] **Step 5: Exportar**

Em `packages/provisioning/src/index.ts`:

```typescript
export {
  bootstrapCharter,
  POLICY_SECTIONS,
  type BootstrapCharterDeps,
  type BootstrapCharterInput,
} from "./charter";
```

- [ ] **Step 6: Verificar lint e cobertura**

```bash
npx --yes @biomejs/biome check --write packages/provisioning
pnpm --filter @repo/provisioning test:coverage
```

Esperado: biome sem erro; cobertura acima dos limiares do `vitest.config.mts`.

- [ ] **Step 7: Commit**

```bash
git add packages/provisioning
git commit -m "feat(provisioning): bootstrap do Charter — papel, settings e política em nove seções"
```

---

## Task 7: Onboarding self-service passa a provisionar módulo

**Files:**
- Modify: `apps/app/app/actions/onboarding.ts`
- Create: `apps/app/__tests__/actions/onboarding-provisioning.test.ts`
- Modify: `apps/app/package.json` (dependência `@repo/provisioning`)

**Interfaces:**
- Consumes: `provisionTenant` (Task 5)
- Produces: `createOnboardingWorkspace(name: string): Promise<{ tenantId: string; slug: string }>` — assinatura inalterada

**Decisão de negócio embutida:** o cliente que se cadastra sozinho recebe `COSMOS` em `TRIAL` por 14 dias. Hoje ele não recebe módulo nenhum, o que já é um bug latente. `TRIAL` com prazo foi escolhido em vez de `ACTIVE` sem prazo porque cadastro self-service não é venda fechada. O valor está numa constante única, `SELF_SERVICE_MODULES`, para ser trocado num lugar só.

- [ ] **Step 1: Escrever o teste que falha**

`apps/app/__tests__/actions/onboarding-provisioning.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { SELF_SERVICE_MODULES } from "@/app/actions/onboarding";

describe("provisionamento do cadastro self-service", () => {
  it("dá COSMOS em TRIAL — cadastro sozinho não é venda fechada", () => {
    expect(SELF_SERVICE_MODULES).toEqual([
      { module: "COSMOS", status: "TRIAL", trialDays: 14 },
    ]);
  });

  it("não dá CHARTER — módulo pago entra por contratação", () => {
    const modules = SELF_SERVICE_MODULES.map((m) => m.module);
    expect(modules).not.toContain("CHARTER");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && npx vitest run __tests__/actions/onboarding-provisioning.test.ts
```

Esperado: FAIL — `SELF_SERVICE_MODULES` não é exportado.

- [ ] **Step 3: Adicionar a dependência**

Em `apps/app/package.json`, na seção `dependencies`, adicionar (mantendo a ordem alfabética existente):

```json
"@repo/provisioning": "workspace:*",
```

Depois:

```bash
pnpm install
```

- [ ] **Step 4: Implementar**

Substituir o corpo de `apps/app/app/actions/onboarding.ts` por:

```typescript
"use server";

import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { provisionTenant } from "@repo/provisioning";
import { invalidateModuleCache } from "@repo/rbac";
import { headers } from "next/headers";

const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_NAME_LENGTH = 2;

/** O que um cadastro self-service ganha. TRIAL com prazo, não ACTIVE: quem se
 *  cadastra sozinho não fechou venda. Trocar aqui muda o produto inteiro. */
export const SELF_SERVICE_MODULES = [
  { module: "COSMOS" as const, status: "TRIAL" as const, trialDays: TRIAL_DAYS },
];

export async function createOnboardingWorkspace(name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) {
    throw new Error("Nome muito curto.");
  }

  const dbUser = await database.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true },
  });
  if (!dbUser) {
    throw new Error("Usuário não encontrado no banco de dados.");
  }

  // Mesma função que o back-office usa. Uma verdade só sobre como um cliente
  // nasce — antes daqui, tenant self-service nascia sem módulo nenhum.
  const { tenantId, slug } = await provisionTenant(
    database,
    { invalidateModuleCache },
    {
      name: trimmed,
      ownerEmail: dbUser.email,
      modules: SELF_SERVICE_MODULES.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: new Date(Date.now() + m.trialDays * DAY_MS),
      })),
      actorUserId: dbUser.id,
      actorName: dbUser.name,
    }
  );

  await database.session.updateMany({
    where: { userId: dbUser.id },
    data: { activeTenantId: tenantId },
  });

  await database.onboardingProgress.upsert({
    where: {
      tenantId_flowType: { tenantId, flowType: "company_setup" },
    },
    create: {
      tenantId,
      flowType: "company_setup",
      status: "completed",
      completedSteps: [],
    },
    update: { status: "completed" },
  });

  return { tenantId, slug };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
cd apps/app && npx vitest run __tests__/actions/onboarding-provisioning.test.ts
```

Esperado: PASS (2 testes).

- [ ] **Step 6: Rodar a suíte do app inteira — a mudança toca um caminho existente**

```bash
cd apps/app && npx vitest run
```

Esperado: 0 falhas. Se algum teste de onboarding existente quebrar, ler o teste antes de mudar o código: o comportamento observável (`{ tenantId, slug }`) foi mantido de propósito.

- [ ] **Step 7: Commit**

```bash
git add apps/app/app/actions/onboarding.ts apps/app/__tests__/actions/onboarding-provisioning.test.ts apps/app/package.json pnpm-lock.yaml
git commit -m "fix(onboarding): cadastro self-service passa a nascer com módulo contratado"
```

---

## Task 8: Scaffold do `apps/backoffice` e o guard

**Files:**
- Create: `apps/backoffice/package.json`
- Create: `apps/backoffice/tsconfig.json`
- Create: `apps/backoffice/next.config.ts`
- Create: `apps/backoffice/env.ts`
- Create: `apps/backoffice/vitest.config.mts`
- Create: `apps/backoffice/lib/guard.ts`
- Create: `apps/backoffice/lib/safe-action.ts`
- Create: `apps/backoffice/app/layout.tsx`
- Create: `apps/backoffice/app/page.tsx`
- Create: `apps/backoffice/__tests__/guard.test.ts`

**Interfaces:**
- Consumes: `@repo/auth/server` (`auth`), `@repo/database` (`database`)
- Produces: `requirePlatformStaff(): Promise<PlatformStaff>` com `PlatformStaff = { userId: string; name: string | null; email: string; canWrite: boolean }`; `safeAction<T>(fn): Promise<Result<T>>`, `Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }`

- [ ] **Step 1: Escrever o teste que falha**

`apps/backoffice/__tests__/guard.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findFirst = vi.fn();

vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { requirePlatformStaff, SYSTEM_TENANT_ID } = await import("../lib/guard");

describe("requirePlatformStaff", () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
  });

  it("nega quem não tem sessão", async () => {
    getSession.mockResolvedValue(null);

    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("nega usuário de tenant cliente — membership no cliente não é staff", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-cliente", email: "ana@vanta.exemplo", name: "Ana" },
    });
    findFirst.mockResolvedValue(null);

    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // A consulta tem que ser pelo tenant interno, não por "algum" tenant.
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-cliente", tenantId: SYSTEM_TENANT_ID },
      select: { role: true },
    });
  });

  it("aceita membro do tenant interno", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-staff", email: "vini@nebuloz.exemplo", name: "Vinícius" },
    });
    findFirst.mockResolvedValue({ role: "ADMIN" });

    const staff = await requirePlatformStaff();

    expect(staff).toEqual({
      userId: "user-staff",
      email: "vini@nebuloz.exemplo",
      name: "Vinícius",
      canWrite: true,
    });
  });

  it("membro não-ADMIN entra, mas só lê", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-staff", email: "leitor@nebuloz.exemplo", name: null },
    });
    findFirst.mockResolvedValue({ role: "MEMBER" });

    const staff = await requirePlatformStaff();

    expect(staff.canWrite).toBe(false);
  });
});
```

- [ ] **Step 2: Criar o scaffold do app**

`apps/backoffice/package.json`:

```json
{
  "name": "backoffice",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3013",
    "build": "next build",
    "start": "next start",
    "clean": "git clean -xdf .cache .turbo dist node_modules",
    "typecheck": "tsc --noEmit --emitDeclarationOnly false",
    "test": "vitest run"
  },
  "dependencies": {
    "@repo/auth": "workspace:*",
    "@repo/database": "workspace:*",
    "@repo/design-system": "workspace:*",
    "@repo/next-config": "workspace:*",
    "@repo/observability": "workspace:*",
    "@repo/provisioning": "workspace:*",
    "@repo/rbac": "workspace:*",
    "@t3-oss/env-nextjs": "^0.13.8",
    "lucide-react": "^0.556.0",
    "next": "16.2.9",
    "react": "19.2.1",
    "react-dom": "19.2.1",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "24.10.1",
    "@types/react": "19.2.7",
    "@types/react-dom": "19.2.3",
    "tailwindcss": "^4.1.17",
    "typescript": "^5.9.3",
    "vitest": "^4.0.15"
  }
}
```

`apps/backoffice/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/backoffice/next.config.ts`:

```typescript
import { config } from "@repo/next-config";
import { withLogging } from "@repo/observability/next-config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = withLogging(config);

export default nextConfig;
```

`apps/backoffice/env.ts`:

```typescript
import { keys as auth } from "@repo/auth/keys";
import { keys as database } from "@repo/database/keys";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  extends: [auth(), core(), database(), observability()],
  server: {},
  client: {},
  runtimeEnv: {},
});
```

`apps/backoffice/vitest.config.mts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
```

Depois:

```bash
pnpm install
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

```bash
cd apps/backoffice && npx vitest run
```

Esperado: FAIL — `Failed to resolve import "../lib/guard"`.

- [ ] **Step 4: Implementar o guard e o `safeAction`**

`apps/backoffice/lib/guard.ts`:

```typescript
import "server-only";
import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

/** O tenant interno da Nebuloz, criado pela migration 20260728020000 e marcado
 *  `isSystem = true`. Ser membro dele é o que define staff. */
export const SYSTEM_TENANT_ID = "system";

export type PlatformStaff = {
  userId: string;
  name: string | null;
  email: string;
  /** ADMIN no tenant interno contrata e provisiona; MEMBER só lê. */
  canWrite: boolean;
};

export class StaffAuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "StaffAuthError";
    this.code = code;
  }
}

/**
 * O único guard do back-office. Toda page e toda server action começa por ele —
 * o layout protege navegação, não protege RPC.
 */
export async function requirePlatformStaff(): Promise<PlatformStaff> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new StaffAuthError("UNAUTHORIZED", "Sessão ausente.");
  }

  const membership = await database.tenantMember.findFirst({
    where: { userId: session.user.id, tenantId: SYSTEM_TENANT_ID },
    select: { role: true },
  });

  if (!membership) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Esta conta não é da equipe da Nebuloz."
    );
  }

  return {
    userId: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    canWrite: membership.role === "ADMIN",
  };
}
```

`apps/backoffice/lib/safe-action.ts`:

```typescript
import { log } from "@repo/observability/log";
import { ProvisioningError } from "@repo/provisioning";
import { StaffAuthError } from "./guard";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: string, code?: string): Result<never> {
  return { ok: false, error, code };
}

/** Versão fina do `safeAction` do produto: aquele resolve contexto de tenant,
 *  que aqui não existe. O que se traduz são os erros nomeados do package. */
export async function safeAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ProvisioningError) {
      return err(e.message, e.code);
    }
    if (e instanceof StaffAuthError) {
      return err(e.message, e.code);
    }
    log.error("[backoffice]", { error: String(e) });
    return err("Não foi possível concluir a operação.");
  }
}
```

`apps/backoffice/app/layout.tsx`:

```tsx
import "@repo/design-system/styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Nebuloz — Back-office",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

`apps/backoffice/app/page.tsx` (placeholder que a Task 9 substitui):

```tsx
import { requirePlatformStaff } from "@/lib/guard";

export default async function ClientsPage() {
  const staff = await requirePlatformStaff();

  return <p>Autenticado como {staff.email}.</p>;
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
cd apps/backoffice && npx vitest run
```

Esperado: PASS (4 testes).

- [ ] **Step 6: Verificar que o app compila**

```bash
pnpm --filter backoffice typecheck
```

Esperado: sem erro.

- [ ] **Step 7: Commit**

```bash
git add apps/backoffice pnpm-lock.yaml
git commit -m "feat(backoffice): scaffold do app e guard de staff da plataforma"
```

---

## Task 9: Lista de clientes

**Files:**
- Create: `apps/backoffice/app/actions/clients.ts`
- Modify: `apps/backoffice/app/page.tsx`
- Create: `apps/backoffice/__tests__/clients-query.test.ts`

**Interfaces:**
- Consumes: `requirePlatformStaff` (Task 8), `platformDb` (Task 1)
- Produces: `clientListArgs(): { where: { isSystem: false }; select: object; orderBy: object }`, `listClients(): Promise<Result<ClientRow[]>>` com `ClientRow = { id: string; name: string; slug: string; createdAt: string; memberCount: number; modules: { module: string; status: string; expiresAt: string | null }[] }`

- [ ] **Step 1: Escrever o teste que falha**

`apps/backoffice/__tests__/clients-query.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { clientListArgs } from "../app/actions/clients";

describe("clientListArgs", () => {
  it("exclui o tenant interno — ele não é cliente", () => {
    expect(clientListArgs().where).toEqual({ isSystem: false });
  });

  it("traz módulos e contagem de membros numa consulta só", () => {
    const { select } = clientListArgs();

    expect(select).toMatchObject({
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      modules: expect.anything(),
      _count: { select: { members: true } },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backoffice && npx vitest run __tests__/clients-query.test.ts
```

Esperado: FAIL — `Failed to resolve import "../app/actions/clients"`.

- [ ] **Step 3: Implementar**

`apps/backoffice/app/actions/clients.ts`:

```typescript
"use server";

import { platformDb } from "@repo/provisioning";
import { requirePlatformStaff } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  modules: { module: string; status: string; expiresAt: string | null }[];
};

/** Separado da action para poder ser testado sem banco: o filtro `isSystem`
 *  é a regra que não pode ser esquecida em nenhuma listagem. */
export function clientListArgs() {
  return {
    where: { isSystem: false },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      modules: {
        select: { module: true, status: true, expiresAt: true },
        orderBy: { module: "asc" as const },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" as const },
  };
}

export async function listClients(): Promise<Result<ClientRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const rows = await platformDb.tenant.findMany(clientListArgs());

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
      memberCount: row._count.members,
      modules: row.modules.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: m.expiresAt?.toISOString() ?? null,
      })),
    }));
  });
}
```

`apps/backoffice/app/page.tsx`:

```tsx
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import Link from "next/link";
import { listClients } from "./actions/clients";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ACTIVE: "default",
  TRIAL: "secondary",
  SUSPENDED: "destructive",
  CANCELED: "destructive",
};

export default async function ClientsPage() {
  const result = await listClients();

  if (!result.ok) {
    return <p className="text-destructive">{result.error}</p>;
  }

  if (result.data.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">Nenhum cliente ainda</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Provisione o primeiro em <Link href="/clientes/novo">novo cliente</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">Clientes</h1>
        <Link className="text-sm underline" href="/clientes/novo">
          Novo cliente
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Membros</TableHead>
            <TableHead>Módulos</TableHead>
            <TableHead>Desde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.data.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <Link className="font-medium" href={`/clientes/${client.slug}`}>
                  {client.name}
                </Link>
                <span className="block text-muted-foreground text-xs">
                  {client.slug}
                </span>
              </TableCell>
              <TableCell>{client.memberCount}</TableCell>
              <TableCell className="space-x-1">
                {client.modules.length === 0 ? (
                  <span className="text-muted-foreground text-xs">nenhum</span>
                ) : (
                  client.modules.map((m) => (
                    <Badge
                      key={m.module}
                      variant={STATUS_VARIANT[m.status] ?? "secondary"}
                    >
                      {m.module}
                    </Badge>
                  ))
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(client.createdAt).toLocaleDateString("pt-BR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backoffice && npx vitest run
```

Esperado: PASS (6 testes no total).

- [ ] **Step 5: Commit**

```bash
git add apps/backoffice
git commit -m "feat(backoffice): lista de clientes com módulos contratados"
```

---

## Task 10: Detalhe do cliente e as ações de contratação

**Files:**
- Create: `apps/backoffice/app/actions/provisioning.ts`
- Create: `apps/backoffice/app/clientes/[slug]/page.tsx`
- Create: `apps/backoffice/app/clientes/[slug]/module-form.tsx`
- Modify: `apps/backoffice/app/actions/clients.ts` (adicionar `getClient`)
- Create: `apps/backoffice/__tests__/provisioning-actions.test.ts`

**Interfaces:**
- Consumes: `contractModule`, `setModuleStatus` (Task 4), `bootstrapCharter` (Task 6), `requirePlatformStaff` (Task 8)
- Produces:
  - `getClient(slug: string): Promise<Result<ClientDetail>>` com `ClientDetail = ClientRow & { members: { name: string | null; email: string; role: string }[]; charter: { moduleContracted: boolean; hasCompliance: boolean; hasPolicy: boolean } }`
  - `contractModuleAction(input: { slug: string; module: string; status: string }): Promise<Result<null>>`
  - `bootstrapCharterAction(input: { slug: string; complianceEmail: string }): Promise<Result<{ created: boolean }>>`

- [ ] **Step 1: Escrever o teste que falha**

`apps/backoffice/__tests__/provisioning-actions.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const { assertCanWrite } = await import("../app/actions/provisioning");
const { StaffAuthError } = await import("../lib/guard");

describe("assertCanWrite", () => {
  it("deixa passar quem é ADMIN no tenant interno", () => {
    expect(() =>
      assertCanWrite({
        userId: "u",
        email: "a@b.c",
        name: null,
        canWrite: true,
      })
    ).not.toThrow();
  });

  it("barra quem só tem leitura — ver cliente não é contratar módulo", () => {
    expect(() =>
      assertCanWrite({
        userId: "u",
        email: "a@b.c",
        name: null,
        canWrite: false,
      })
    ).toThrow(StaffAuthError);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/backoffice && npx vitest run __tests__/provisioning-actions.test.ts
```

Esperado: FAIL — `Failed to resolve import "../app/actions/provisioning"`.

- [ ] **Step 3: Implementar as actions**

`apps/backoffice/app/actions/provisioning.ts`:

```typescript
"use server";

import { withTenantDb } from "@repo/database";
import {
  bootstrapCharter,
  contractModule,
  platformDb,
  ProvisioningError,
  setModuleStatus,
} from "@repo/provisioning";
import { invalidateModuleCache } from "@repo/rbac";
import { revalidatePath } from "next/cache";
import { type PlatformStaff, requirePlatformStaff, StaffAuthError } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/** Leitura é para todo staff; escrita é só de quem é ADMIN no tenant interno. */
export function assertCanWrite(staff: PlatformStaff): void {
  if (!staff.canWrite) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Seu papel no back-office permite apenas leitura."
    );
  }
}

async function tenantIdBySlug(slug: string): Promise<string> {
  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, isSystem: true },
  });
  if (!tenant || tenant.isSystem) {
    throw new ProvisioningError(
      "TENANT_NOT_FOUND",
      `Nenhum cliente com o slug ${slug}.`
    );
  }
  return tenant.id;
}

export async function contractModuleAction(input: {
  slug: string;
  module: "COSMOS" | "CHARTER" | "SIGNAL";
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED";
}): Promise<Result<null>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const tenantId = await tenantIdBySlug(input.slug);

    await contractModule(
      platformDb,
      { invalidateModuleCache },
      {
        tenantId,
        module: input.module,
        status: input.status,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return null;
  });
}

export async function setModuleStatusAction(input: {
  slug: string;
  module: "COSMOS" | "CHARTER" | "SIGNAL";
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED";
}): Promise<Result<null>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const tenantId = await tenantIdBySlug(input.slug);

    await setModuleStatus(
      platformDb,
      { invalidateModuleCache },
      {
        tenantId,
        module: input.module,
        status: input.status,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return null;
  });
}

export async function bootstrapCharterAction(input: {
  slug: string;
  complianceEmail: string;
}): Promise<Result<{ created: boolean }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const tenantId = await tenantIdBySlug(input.slug);

    const result = await bootstrapCharter(
      { withTenantDb },
      {
        tenantId,
        complianceEmail: input.complianceEmail,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return { created: result.created };
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/backoffice && npx vitest run __tests__/provisioning-actions.test.ts
```

Esperado: PASS (2 testes).

- [ ] **Step 5: Adicionar `getClient` à leitura**

Em `apps/backoffice/app/actions/clients.ts`, adicionar ao final:

```typescript
export type ClientDetail = ClientRow & {
  members: { name: string | null; email: string; role: string }[];
  charter: {
    moduleContracted: boolean;
    hasCompliance: boolean;
    hasPolicy: boolean;
  };
};

export async function getClient(slug: string): Promise<Result<ClientDetail>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const tenant = await platformDb.tenant.findFirst({
      where: { slug, isSystem: false },
      select: {
        ...clientListArgs().select,
        members: {
          select: {
            role: true,
            user: { select: { name: true, email: true } },
          },
        },
        charterMemberships: { select: { role: true } },
        charterPolicies: { select: { id: true }, take: 1 },
      },
    });

    if (!tenant) {
      throw new ProvisioningError(
        "TENANT_NOT_FOUND",
        `Nenhum cliente com o slug ${slug}.`
      );
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt.toISOString(),
      memberCount: tenant._count.members,
      modules: tenant.modules.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: m.expiresAt?.toISOString() ?? null,
      })),
      members: tenant.members.map((m) => ({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      charter: {
        moduleContracted: tenant.modules.some(
          (m) => m.module === "CHARTER" && ["ACTIVE", "TRIAL"].includes(m.status)
        ),
        hasCompliance: tenant.charterMemberships.some(
          (m) => m.role === "COMPLIANCE"
        ),
        hasPolicy: tenant.charterPolicies.length > 0,
      },
    };
  });
}
```

E no topo do arquivo, adicionar `ProvisioningError` ao import de `@repo/provisioning`.

- [ ] **Step 6: Criar a tela de detalhe**

`apps/backoffice/app/clientes/[slug]/page.tsx`:

```tsx
import { Badge } from "@repo/design-system/components/ui/badge";
import { notFound } from "next/navigation";
import { getClient } from "@/app/actions/clients";
import { ModuleForm } from "./module-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getClient(slug);

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      notFound();
    }
    return <p className="text-destructive">{result.error}</p>;
  }

  const client = result.data;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-semibold text-2xl">{client.name}</h1>
        <p className="text-muted-foreground text-sm">
          {client.slug} · cliente desde{" "}
          {new Date(client.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-medium text-lg">Contratação</h2>
        <ModuleForm modules={client.modules} slug={client.slug} />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-lg">Charter</h2>
        <ul className="space-y-1 text-sm">
          <li>
            Módulo contratado:{" "}
            <Badge variant={client.charter.moduleContracted ? "default" : "secondary"}>
              {client.charter.moduleContracted ? "sim" : "não"}
            </Badge>
          </li>
          <li>
            Papel Compliance atribuído:{" "}
            <Badge variant={client.charter.hasCompliance ? "default" : "secondary"}>
              {client.charter.hasCompliance ? "sim" : "não"}
            </Badge>
          </li>
          <li>
            Política criada:{" "}
            <Badge variant={client.charter.hasPolicy ? "default" : "secondary"}>
              {client.charter.hasPolicy ? "sim" : "não"}
            </Badge>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-lg">Membros</h2>
        <ul className="space-y-1 text-sm">
          {client.members.map((member) => (
            <li key={member.email}>
              {member.name ?? "—"} · {member.email} ·{" "}
              <span className="text-muted-foreground">{member.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

`apps/backoffice/app/clientes/[slug]/module-form.tsx`:

```tsx
"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useState, useTransition } from "react";
import { contractModuleAction } from "@/app/actions/provisioning";

const MODULES = ["COSMOS", "CHARTER", "SIGNAL"] as const;
const STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"] as const;

type ModuleRow = { module: string; status: string; expiresAt: string | null };

export function ModuleForm({
  slug,
  modules,
}: {
  slug: string;
  modules: ModuleRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const apply = (module: (typeof MODULES)[number], status: (typeof STATUSES)[number]) =>
    startTransition(async () => {
      setError(null);
      const result = await contractModuleAction({ slug, module, status });
      if (!result.ok) {
        setError(result.error);
      }
    });

  return (
    <div className="space-y-3">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <table className="w-full text-sm">
        <tbody>
          {MODULES.map((module) => {
            const current = modules.find((m) => m.module === module);
            return (
              <tr className="border-b" key={module}>
                <td className="py-2 font-medium">{module}</td>
                <td className="py-2 text-muted-foreground">
                  {current?.status ?? "não contratado"}
                </td>
                <td className="space-x-2 py-2 text-right">
                  {STATUSES.map((status) => (
                    <Button
                      disabled={pending || current?.status === status}
                      key={status}
                      onClick={() => apply(module, status)}
                      size="sm"
                      variant="outline"
                    >
                      {status}
                    </Button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Verificar tipos e lint**

```bash
pnpm --filter backoffice typecheck
npx --yes @biomejs/biome check --write apps/backoffice
```

Esperado: sem erro.

- [ ] **Step 8: Commit**

```bash
git add apps/backoffice
git commit -m "feat(backoffice): detalhe do cliente com contratação de módulo"
```

---

## Task 11: Provisionar cliente novo e bootstrap do Charter pela tela

**Files:**
- Create: `apps/backoffice/app/clientes/novo/page.tsx`
- Create: `apps/backoffice/app/clientes/novo/form.tsx`
- Create: `apps/backoffice/app/clientes/[slug]/charter-bootstrap.tsx`
- Modify: `apps/backoffice/app/actions/provisioning.ts` (adicionar `provisionTenantAction`)
- Modify: `apps/backoffice/app/clientes/[slug]/page.tsx` (montar o bootstrap)

**Interfaces:**
- Consumes: `provisionTenant` (Task 5), `bootstrapCharterAction` (Task 10)
- Produces: `provisionTenantAction(input: { name: string; ownerEmail: string; modules: { module: string; status: string }[] }): Promise<Result<{ slug: string; ownerLinked: boolean }>>`

- [ ] **Step 1: Adicionar a action de provisionamento**

Ao final de `apps/backoffice/app/actions/provisioning.ts`:

```typescript
export async function provisionTenantAction(input: {
  name: string;
  ownerEmail: string;
  modules: {
    module: "COSMOS" | "CHARTER" | "SIGNAL";
    status: "ACTIVE" | "TRIAL";
  }[];
}): Promise<Result<{ slug: string; ownerLinked: boolean }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const result = await provisionTenant(
      platformDb,
      { invalidateModuleCache },
      {
        name: input.name,
        ownerEmail: input.ownerEmail,
        modules: input.modules,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath("/");
    return { slug: result.slug, ownerLinked: result.ownerLinked };
  });
}
```

E adicionar `provisionTenant` ao import de `@repo/provisioning` no topo do arquivo.

- [ ] **Step 2: Criar o formulário**

`apps/backoffice/app/clientes/novo/form.tsx`:

```tsx
"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { provisionTenantAction } from "@/app/actions/provisioning";

const MODULES = ["COSMOS", "CHARTER", "SIGNAL"] as const;

export function NewClientForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [selected, setSelected] = useState<string[]>(["COSMOS"]);

  const toggle = (module: string) =>
    setSelected((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await provisionTenantAction({
        name,
        ownerEmail,
        modules: selected.map((module) => ({
          module: module as (typeof MODULES)[number],
          status: "ACTIVE" as const,
        })),
      });

      if (result.ok) {
        router.push(`/clientes/${result.data.slug}`);
        return;
      }
      setError(result.error);
    });

  return (
    <div className="max-w-lg space-y-4">
      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="space-y-2">
        <Label htmlFor="name">Nome da organização</Label>
        <Input
          id="name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerEmail">E-mail do responsável</Label>
        <Input
          id="ownerEmail"
          onChange={(e) => setOwnerEmail(e.target.value)}
          type="email"
          value={ownerEmail}
        />
        <p className="text-muted-foreground text-xs">
          Se ainda não tiver conta, o cliente nasce sem dono e o convite fica
          pendente.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-medium text-sm">Módulos contratados</legend>
        {MODULES.map((module) => (
          <label className="flex items-center gap-2 text-sm" key={module}>
            <input
              checked={selected.includes(module)}
              onChange={() => toggle(module)}
              type="checkbox"
            />
            {module}
          </label>
        ))}
      </fieldset>

      <Button disabled={pending || name.trim().length < 2} onClick={submit}>
        {pending ? "Provisionando…" : "Provisionar cliente"}
      </Button>
    </div>
  );
}
```

`apps/backoffice/app/clientes/novo/page.tsx`:

```tsx
import { requirePlatformStaff } from "@/lib/guard";
import { NewClientForm } from "./form";

export default async function NewClientPage() {
  await requirePlatformStaff();

  return (
    <div className="space-y-6">
      <h1 className="font-semibold text-2xl">Novo cliente</h1>
      <NewClientForm />
    </div>
  );
}
```

- [ ] **Step 3: Criar o bloco de bootstrap do Charter**

`apps/backoffice/app/clientes/[slug]/charter-bootstrap.tsx`:

```tsx
"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { useState, useTransition } from "react";
import { bootstrapCharterAction } from "@/app/actions/provisioning";

export function CharterBootstrap({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await bootstrapCharterAction({
        slug,
        complianceEmail: email,
      });

      if (result.ok) {
        setMessage(
          result.data.created
            ? "Política criada com as nove seções em rascunho."
            : "Política já existia — apenas o papel foi garantido."
        );
        return;
      }
      setError(result.error);
    });

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="font-medium text-sm">Preparar o Charter</p>
      <p className="text-muted-foreground text-xs">
        Atribui o papel Compliance e cria a política inicial. Rodar de novo não
        duplica nada.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {message && <p className="text-sm">{message}</p>}
      <div className="flex gap-2">
        <Input
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do responsável pelo Compliance"
          type="email"
          value={email}
        />
        <Button disabled={pending || !email.includes("@")} onClick={run}>
          {pending ? "Preparando…" : "Preparar"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Montar o bloco na tela de detalhe**

Em `apps/backoffice/app/clientes/[slug]/page.tsx`, dentro da `<section>` do Charter e depois da `<ul>`, adicionar:

```tsx
        {client.charter.moduleContracted &&
          !(client.charter.hasCompliance && client.charter.hasPolicy) && (
            <CharterBootstrap slug={client.slug} />
          )}
```

E no topo do arquivo:

```tsx
import { CharterBootstrap } from "./charter-bootstrap";
```

- [ ] **Step 5: Verificar tipos, lint e testes**

```bash
pnpm --filter backoffice typecheck
npx --yes @biomejs/biome check --write apps/backoffice
cd apps/backoffice && npx vitest run
```

Esperado: sem erro de tipo, biome limpo, testes passando.

- [ ] **Step 6: Commit**

```bash
git add apps/backoffice
git commit -m "feat(backoffice): provisionar cliente e preparar o Charter pela tela"
```

---

## Task 12: Trilha do staff e teste de vazamento

**Files:**
- Create: `apps/backoffice/app/atividade/page.tsx`
- Modify: `apps/backoffice/app/actions/clients.ts` (adicionar `listStaffActivity`)
- Create: `apps/backoffice/__tests__/no-cross-tenant-leak.test.ts`

**Interfaces:**
- Consumes: `clientListArgs` (Task 9), `platformDb` (Task 1)
- Produces: `listStaffActivity(limit?: number): Promise<Result<ActivityRow[]>>` com `ActivityRow = { id: string; action: string; target: string; actorName: string | null; createdAt: string }`

- [ ] **Step 1: Escrever o teste de vazamento**

`apps/backoffice/__tests__/no-cross-tenant-leak.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clientListArgs } from "../app/actions/clients";

describe("fronteira cross-tenant", () => {
  it("toda listagem de cliente exclui o tenant interno", () => {
    expect(clientListArgs().where).toMatchObject({ isSystem: false });
  });

  it("nenhuma consulta a Tenant no back-office esquece o filtro isSystem", () => {
    const source = readFileSync(
      join(__dirname, "..", "app", "actions", "clients.ts"),
      "utf8"
    );

    const tenantQueries = source.match(/platformDb\.tenant\.\w+\(/g) ?? [];
    const isSystemMentions = source.match(/isSystem/g) ?? [];

    // Cada consulta a Tenant precisa do seu próprio filtro. Se esta conta
    // desandar, alguém adicionou uma consulta sem o filtro.
    expect(isSystemMentions.length).toBeGreaterThanOrEqual(
      tenantQueries.length
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que passa (guarda de regressão, não TDD)**

```bash
cd apps/backoffice && npx vitest run __tests__/no-cross-tenant-leak.test.ts
```

Esperado: PASS. Se falhar, uma consulta a `Tenant` ficou sem filtro — corrigir a consulta, não o teste.

- [ ] **Step 3: Implementar a leitura da trilha**

Ao final de `apps/backoffice/app/actions/clients.ts`:

```typescript
export type ActivityRow = {
  id: string;
  action: string;
  target: string;
  actorName: string | null;
  createdAt: string;
};

const ACTIVITY_LIMIT = 100;

export async function listStaffActivity(
  limit = ACTIVITY_LIMIT
): Promise<Result<ActivityRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const rows = await platformDb.auditLog.findMany({
      where: { metadata: { path: ["platformStaff"], equals: true } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, action: true, metadata: true, createdAt: true },
    });

    return rows.map((row) => {
      const meta = (row.metadata ?? {}) as {
        target?: string;
        actorName?: string | null;
      };
      return {
        id: row.id,
        action: row.action,
        target: meta.target ?? "—",
        actorName: meta.actorName ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  });
}
```

- [ ] **Step 4: Criar a tela**

`apps/backoffice/app/atividade/page.tsx`:

```tsx
import { listStaffActivity } from "@/app/actions/clients";

export default async function ActivityPage() {
  const result = await listStaffActivity();

  if (!result.ok) {
    return <p className="text-destructive">{result.error}</p>;
  }

  if (result.data.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="font-medium">Nada registrado ainda</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Contratações e provisionamentos aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-semibold text-2xl">Atividade</h1>
      <ul className="space-y-2 text-sm">
        {result.data.map((row) => (
          <li className="border-b pb-2" key={row.id}>
            <span className="font-medium">{row.action}</span> · {row.target}
            <span className="block text-muted-foreground text-xs">
              {row.actorName ?? "—"} ·{" "}
              {new Date(row.createdAt).toLocaleString("pt-BR")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Rodar tudo**

```bash
cd apps/backoffice && npx vitest run
pnpm --filter backoffice typecheck
npx --yes @biomejs/biome check --write apps/backoffice
```

Esperado: testes passando, tipos ok, biome limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/backoffice
git commit -m "feat(backoffice): trilha dos atos de staff e guarda contra vazamento cross-tenant"
```

---

## Task 13: E2E do caminho completo

**Files:**
- Create: `apps/app/e2e/backoffice-charter-provisioning.spec.ts`
- Create: `apps/backoffice/e2e/fixtures/staff.ts`

**Interfaces:**
- Consumes: todas as telas anteriores
- Produces: nada consumido por outra task

**Pré-requisito:** um usuário de teste que seja membro do tenant `system` e um Postgres com as migrations aplicadas. O E2E roda contra `pnpm --filter backoffice dev` (porta 3013) e `pnpm --filter app dev` (porta 3012).

- [ ] **Step 1: Escrever a fixture de sessão de staff**

`apps/backoffice/e2e/fixtures/staff.ts`:

```typescript
import { database } from "@repo/database";

export const STAFF_EMAIL = "e2e-staff@nebuloz.exemplo";

/** Garante que existe um usuário de staff — membro do tenant interno. Sem isso
 *  o guard nega e o teste falha por motivo errado. */
export async function ensureStaffUser(): Promise<string> {
  const user = await database.user.upsert({
    where: { email: STAFF_EMAIL },
    create: { email: STAFF_EMAIL, name: "E2E Staff", emailVerified: true },
    update: {},
    select: { id: true },
  });

  await database.tenantMember.upsert({
    where: {
      tenantId_userId: { tenantId: "system", userId: user.id },
    },
    create: { tenantId: "system", userId: user.id, role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  return user.id;
}
```

- [ ] **Step 2: Escrever o E2E**

`apps/app/e2e/backoffice-charter-provisioning.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

const BACKOFFICE = process.env.BACKOFFICE_URL ?? "http://localhost:3013";

test.describe("provisionar cliente e preparar o Charter", () => {
  test("do provisionamento até a política existir", async ({ page }) => {
    const suffix = Date.now();
    const clientName = `E2E Cliente ${suffix}`;

    await page.goto(`${BACKOFFICE}/clientes/novo`);

    await page.getByLabel("Nome da organização").fill(clientName);
    await page
      .getByLabel("E-mail do responsável")
      .fill(`dono-${suffix}@e2e.exemplo`);
    await page.getByRole("checkbox", { name: "CHARTER" }).check();
    await page.getByRole("button", { name: "Provisionar cliente" }).click();

    // A tela de detalhe é o destino do provisionamento.
    await expect(page.getByRole("heading", { name: clientName })).toBeVisible();

    // Módulo contratado aparece como sim.
    await expect(page.getByText("Módulo contratado: sim")).toBeVisible();

    // O bloco de bootstrap aparece porque falta papel e política.
    await expect(page.getByText("Preparar o Charter")).toBeVisible();
  });

  test("a lista não mostra o tenant interno", async ({ page }) => {
    await page.goto(BACKOFFICE);

    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
    await expect(page.getByText("__system__")).toHaveCount(0);
  });
});
```

- [ ] **Step 3: Rodar o E2E**

```bash
pnpm --filter app test:e2e -- backoffice-charter-provisioning
```

Esperado: 2 testes passando. Se o guard barrar, conferir que a sessão do navegador é do usuário criado por `ensureStaffUser`.

- [ ] **Step 4: Commit**

```bash
git add apps/app/e2e/backoffice-charter-provisioning.spec.ts apps/backoffice/e2e
git commit -m "test(backoffice): E2E do provisionamento até o Charter pronto"
```

---

## Task 14: Deploy do back-office

**Files:**
- Create: `apps/backoffice/vercel.json`
- Modify: `docs/runbooks/charter-em-producao.md` (os SQLs manuais viram tela)

**Interfaces:** nenhuma — task de operação.

**Nota:** os passos 2 e 3 são feitos por você no painel da Vercel. Um agente não tem (nem deve ter) credencial para criar projeto e gravar variável de ambiente.

- [ ] **Step 1: Criar o `vercel.json`**

`apps/backoffice/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "node ../../scripts/skip-ci.js"
}
```

- [ ] **Step 2: Criar o projeto na Vercel**

No painel: novo projeto apontando para o mesmo repositório, com **Root Directory** `apps/backoffice` e build command `cd ../.. && pnpm turbo build --filter=backoffice`.

- [ ] **Step 3: Configurar as variáveis de ambiente**

O `env.ts` do back-office estende `auth`, `core`, `database` e `observability`. As mesmas variáveis do app do cliente: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (apontando para o domínio do back-office), `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 4: Criar o primeiro staff no banco de produção**

```sql
INSERT INTO "TenantMember" ("id", "tenantId", "userId", "role", "createdAt", "updatedAt")
SELECT 'tm_staff_' || u."id", 'system', u."id", 'ADMIN', now(), now()
FROM "User" u
WHERE u."email" = '<seu-email>'
ON CONFLICT ("tenantId", "userId") DO NOTHING;
```

Este é o último `INSERT` manual da fatia: a partir daqui, cliente novo e contratação saem pela tela.

- [ ] **Step 5: Atualizar o runbook**

Em `docs/runbooks/charter-em-producao.md`, nos itens 2 (contratar módulo), 3 (primeiro papel) e 4 (política inicial), adicionar acima de cada bloco de SQL:

```markdown
> **Desde o back-office:** isto agora é feito na tela `/clientes/[slug]` do
> back-office. O SQL abaixo fica como saída de emergência.
```

- [ ] **Step 6: Commit**

```bash
git add apps/backoffice/vercel.json docs/runbooks/charter-em-producao.md
git commit -m "chore(backoffice): configuração de deploy e runbook apontando para as telas"
```

---

## Auto-revisão

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| App próprio `apps/backoffice` | 8 |
| `requirePlatformStaff` com membership no `__system__` | 8 |
| `MemberRole` separando leitura de escrita | 8 (guard), 10 (`assertCanWrite`) |
| Porta única `platformDb` + ADR | 1 |
| Listagem filtrando `isSystem = false` | 9, 12 (guarda de regressão) |
| `provisionTenant` com `TenantInvitation` pendente | 5 |
| `contractModule` com invalidação de cache | 4 |
| `setModuleStatus` | 4 |
| `bootstrapCharter` idempotente, dentro de `withTenantDb` | 6 |
| `createOnboardingWorkspace` usando `provisionTenant` | 7 |
| Tela de clientes | 9 |
| Tela de detalhe com módulos e membros | 10 |
| Tela de novo cliente | 11 |
| Bloco do Charter aparecendo só quando falta | 11 |
| Tela de atividade | 12 |
| Testes de guard | 8 |
| Teste de vazamento de listagem | 12 |
| E2E do caminho completo | 13 |
| Erros nomeados traduzidos pelo `safeAction` | 1 (erros), 8 (`safeAction`) |

**Pendência conhecida, fora do escopo desta fatia:** o E2E da Task 13 cobre provisionar → contratar → ver o bloco de bootstrap. A verificação final da spec ("abrir `/charter` como o cliente e ver o dashboard carregar") exige uma sessão do usuário do cliente, o que depende do fluxo de convite. Registrado aqui em vez de silenciado.

**Consistência de tipos:** `ModuleDeps` (Task 4) é consumido por `provisionTenant` (Task 5) e pelas actions (Tasks 10, 11) com o mesmo formato `{ invalidateModuleCache }`. `PlatformStaff` (Task 8) é consumido por `assertCanWrite` (Task 10). `ClientRow` (Task 9) é estendido por `ClientDetail` (Task 10). `clientListArgs` (Task 9) é reusado por `getClient` (Task 10) e pelo teste de vazamento (Task 12).
