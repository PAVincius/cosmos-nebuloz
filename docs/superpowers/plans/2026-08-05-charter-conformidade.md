# Charter — Mapa de conformidade sobre evidência viva

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Charter gerar, a partir do próprio dado, o mapa `exigência → atende/parcial/não atende → evidência` que a RFP §7.2 exige e que todo cliente enterprise precisa para responder questionário de segurança e de IA.

**Architecture:** Exigências (de RFP ou de regulação) viram linhas em `CharterRequirement`. A cobertura aponta para uma **capacidade** de um catálogo em código, e a capacidade busca a própria evidência no banco a cada leitura — o mapa nunca é gerado e esquecido. Regulação é conjunto versionado publicado pela Nebuloz; versão nova marca as coberturas afetadas para revisão.

**Tech Stack:** Next.js 16 App Router · Prisma + Postgres com RLS por tenant · Vitest · `@react-pdf/renderer` · Biome.

## Global Constraints

- Toda action começa por `requireCharterPermissionContext(<permissão>)` e escreve dentro de `withTenantDb(ctx.tenantId, ...)`. Nunca `database.*` direto numa action do Charter.
- Toda escrita chama `logCharterAudit(db, ctx, {...})` **na mesma transação**. Decisão persistida sem trilha é pior que decisão não persistida.
- `AuditLog` é append-only por trigger (`20260603000002_audit_log_immutable_trigger`). Nenhuma action pode chamar `auditLog.update` ou `auditLog.delete`.
- Actions devolvem `Result<T>` de `@/app/(charter)/actions/_shared` via `safeAction`. Erro de regra usa `GovernanceError(code, message)` — `throw new Error` vira "não foi possível concluir" e some com a mensagem.
- Migration SQL usa `IF NOT EXISTS` / bloco `DO $$ ... EXCEPTION WHEN duplicate_object` em tudo. Este banco já recebeu migration parcial; reexecução não pode falhar por objeto existente.
- Idioma de UI e de mensagem de erro: **pt-BR**. Termo técnico e regulatório (LGPD, GDPR, AI Act, NIST AI RMF, ISO/IEC 42001, RLS, DPA) não se traduz.
- Verificação de cada task: `cd apps/app && NODE_ENV=test pnpm run test`. **`NODE_ENV=test` é obrigatório** — sem ele o plugin React do vite escolhe o runtime JSX errado e o teste de componente estoura "React is not defined".

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/database/prisma/schema/charter.prisma` | 4 modelos novos + `prob*` em `CharterUseCase` + `groundedRequirementId` em `CharterPolicySection` |
| `packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql` | DDL de tudo acima |
| `packages/rbac/src/charter-matrix.ts` | 2 permissões novas: `compliance.map`, `compliance.edit` |
| `apps/app/lib/charter/capabilities.ts` | **Catálogo de capacidades.** Cada uma sabe buscar a própria evidência |
| `apps/app/app/(charter)/actions/_shared.ts` | 2 entradas novas em `CharterEntity` |
| `apps/app/app/(charter)/actions/compliance.ts` | `listRequirementSets`, `importRequirementSet`, `setCoverage`, `getComplianceMap` |
| `apps/app/app/(charter)/actions/compliance-export.ts` | `exportComplianceMap` — CSV, JSON, PDF |
| `apps/app/lib/charter/compliance-pdf.tsx` | Documento `@react-pdf/renderer` |
| `apps/app/components/charter/screens/compliance.tsx` | Tela `/charter/conformidade` |
| `packages/database/scripts/seed-regulacao.mts` | Semeia os 4 corpora |

Testes espelham em `apps/app/__tests__/charter/`.

---

### Task 1: Vínculo política ↔ caso de uso e vendor

Fecha a única lacuna "não atende" que a RFP cita **duas vezes** (§4.1.4 e §4.3.2). Vem primeiro porque a capacidade `POLICY_LINK` da Task 3 depende dela.

**Files:**
- Modify: `packages/database/prisma/schema/charter.prisma`
- Create: `packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql`
- Create: `apps/app/__tests__/charter/policy-link.test.ts`
- Modify: `apps/app/app/(charter)/actions/policy.ts`
- Modify: `apps/app/app/(charter)/actions/_shared.ts`

**Interfaces:**
- Produces: `linkPolicy(input: { policyId: string; alvoTipo: "USE_CASE" | "VENDOR"; alvoId: string }): Promise<Result<null>>` e `unlinkPolicy(input: { policyId: string; alvoTipo: "USE_CASE" | "VENDOR"; alvoId: string }): Promise<Result<null>>`, ambos em `@/app/(charter)/actions/policy`.

- [ ] **Step 1: Adicionar o modelo ao schema**

Em `packages/database/prisma/schema/charter.prisma`, no fim do arquivo:

```prisma
/// Vínculo de política a caso de uso ou fornecedor.
///
/// A RFP pede isto em dois pontos: §4.1.4 ("vincular políticas específicas a
/// casos de uso, modelos e vendors") e §4.3.2 ("associação de vendors a
/// políticas aplicáveis"). Sem ele, uma política publicada não sabe a que se
/// aplica, e o auditor não consegue ir da regra ao caso concreto.
///
/// `alvoId` não tem FK: aponta para duas tabelas diferentes conforme
/// `alvoTipo`. A integridade é garantida na action, que confirma o alvo no
/// tenant antes de gravar.
model CharterPolicyLink {
  id       String                @id @default(cuid())
  tenantId String
  policyId String
  alvoTipo CharterPolicyLinkAlvo
  alvoId   String
  criadoEm DateTime              @default(now())

  tenant Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  policy CharterPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)

  @@unique([policyId, alvoTipo, alvoId])
  @@index([tenantId])
  @@index([tenantId, alvoTipo, alvoId])
}

enum CharterPolicyLinkAlvo {
  USE_CASE
  VENDOR
}
```

Em `model CharterPolicy`, adicionar na lista de relações (antes do `@@index`):

```prisma
  links    CharterPolicyLink[]
```

Em `model Tenant` (`packages/database/prisma/schema/tenant.prisma`), antes da chave de fechamento:

```prisma
  charterPolicyLinks        CharterPolicyLink[]
```

- [ ] **Step 2: Escrever a migration**

Criar `packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql`:

```sql
-- Conformidade do Charter. IF NOT EXISTS em tudo: este banco já recebeu
-- migration parcial, e reexecução não pode falhar por objeto que já existe.

DO $$ BEGIN
  CREATE TYPE "CharterPolicyLinkAlvo" AS ENUM ('USE_CASE', 'VENDOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CharterPolicyLink" (
  "id"       TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "alvoTipo" "CharterPolicyLinkAlvo" NOT NULL,
  "alvoId"   TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharterPolicyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CharterPolicyLink_policyId_alvoTipo_alvoId_key"
  ON "CharterPolicyLink"("policyId", "alvoTipo", "alvoId");
CREATE INDEX IF NOT EXISTS "CharterPolicyLink_tenantId_idx"
  ON "CharterPolicyLink"("tenantId");
CREATE INDEX IF NOT EXISTS "CharterPolicyLink_tenantId_alvo_idx"
  ON "CharterPolicyLink"("tenantId", "alvoTipo", "alvoId");

DO $$ BEGIN
  ALTER TABLE "CharterPolicyLink" ADD CONSTRAINT "CharterPolicyLink_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CharterPolicyLink" ADD CONSTRAINT "CharterPolicyLink_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "CharterPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CharterPolicyLink" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON "CharterPolicyLink"
    USING ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

Rodar: `cd packages/database && npx prisma format && npx prisma validate && npx prisma generate --no-hints`
Esperado: `The schemas at prisma/schema are valid 🚀`

- [ ] **Step 3: Adicionar a entidade de auditoria**

Em `apps/app/app/(charter)/actions/_shared.ts`, no type `CharterEntity`, adicionar:

```ts
  | "charter.policylink"
```

- [ ] **Step 4: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/policy-link.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  withTenantDb: vi.fn(),
  policyFindFirst: vi.fn(),
  useCaseFindFirst: vi.fn(),
  vendorFindFirst: vi.fn(),
  linkCreate: vi.fn(),
  linkDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicy: { findFirst: h.policyFindFirst },
      charterUseCase: { findFirst: h.useCaseFindFirst },
      charterVendor: { findFirst: h.vendorFindFirst },
      charterPolicyLink: { create: h.linkCreate, deleteMany: h.linkDeleteMany },
      auditLog: { create: h.auditCreate },
    }),
}));

import { linkPolicy } from "../../app/(charter)/actions/policy";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE_LEAD",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("linkPolicy", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.policyFindFirst.mockResolvedValue({ id: "p-1", name: "Política de IA" });
    h.useCaseFindFirst.mockResolvedValue({ id: "uc-1", code: "UC-118", title: "Triagem" });
    h.linkCreate.mockResolvedValue({ id: "l-1" });
  });

  it("vincula política a caso de uso e audita", async () => {
    const res = await linkPolicy({
      policyId: "p-1",
      alvoTipo: "USE_CASE",
      alvoId: "uc-1",
    });

    expect(res.ok).toBe(true);
    expect(h.linkCreate).toHaveBeenCalledWith({
      data: { tenantId: "t-1", policyId: "p-1", alvoTipo: "USE_CASE", alvoId: "uc-1" },
    });
    expect(h.auditCreate).toHaveBeenCalled();
  });

  it("recusa alvo de outro tenant sem gravar — guard de IDOR", async () => {
    h.useCaseFindFirst.mockResolvedValue(null);

    const res = await linkPolicy({
      policyId: "p-1",
      alvoTipo: "USE_CASE",
      alvoId: "uc-de-outro",
    });

    expect(res.ok).toBe(false);
    expect(h.linkCreate).not.toHaveBeenCalled();
  });

  it("recusa política de outro tenant sem gravar", async () => {
    h.policyFindFirst.mockResolvedValue(null);

    const res = await linkPolicy({
      policyId: "p-de-outro",
      alvoTipo: "VENDOR",
      alvoId: "v-1",
    });

    expect(res.ok).toBe(false);
    expect(h.linkCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/policy-link.test.ts`
Esperado: FAIL — `linkPolicy` não é exportado de `policy.ts`.

- [ ] **Step 6: Implementar**

No fim de `apps/app/app/(charter)/actions/policy.ts`:

```ts
const LinkSchema = z.object({
  policyId: z.string().min(1),
  alvoTipo: z.enum(["USE_CASE", "VENDOR"]),
  alvoId: z.string().min(1),
});

/**
 * RFP §4.1.4 e §4.3.2 — política publicada precisa saber a que se aplica.
 *
 * `alvoId` não tem FK porque aponta para duas tabelas conforme `alvoTipo`. A
 * integridade fica aqui: confirmar o alvo dentro do tenant antes de gravar é o
 * que impede vincular a política de um cliente ao caso de uso de outro.
 */
export async function linkPolicy(
  input: z.infer<typeof LinkSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = LinkSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const policy = await db.charterPolicy.findFirst({
        where: { id: data.policyId, tenantId: ctx.tenantId },
      });
      if (!policy) {
        throw new GovernanceError("policy.unknown", "Política não encontrada.");
      }

      const alvo =
        data.alvoTipo === "USE_CASE"
          ? await db.charterUseCase.findFirst({
              where: { id: data.alvoId, tenantId: ctx.tenantId },
            })
          : await db.charterVendor.findFirst({
              where: { id: data.alvoId, tenantId: ctx.tenantId },
            });
      if (!alvo) {
        throw new GovernanceError(
          "link.target.unknown",
          data.alvoTipo === "USE_CASE"
            ? "Caso de uso não encontrado."
            : "Fornecedor não encontrado."
        );
      }

      await db.charterPolicyLink.create({
        data: {
          tenantId: ctx.tenantId,
          policyId: data.policyId,
          alvoTipo: data.alvoTipo,
          alvoId: data.alvoId,
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Vinculou política",
        entityType: "charter.policylink",
        entityId: data.alvoId,
        target: `${policy.name} → ${"code" in alvo ? alvo.code : data.alvoId}`,
      });

      return null;
    });
  });
}

export async function unlinkPolicy(
  input: z.infer<typeof LinkSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = LinkSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const { count } = await db.charterPolicyLink.deleteMany({
        where: {
          tenantId: ctx.tenantId,
          policyId: data.policyId,
          alvoTipo: data.alvoTipo,
          alvoId: data.alvoId,
        },
      });
      if (count === 0) {
        throw new GovernanceError("link.unknown", "Vínculo não encontrado.");
      }

      await logCharterAudit(db, ctx, {
        action: "Removeu vínculo de política",
        entityType: "charter.policylink",
        entityId: data.alvoId,
        target: `${data.policyId} → ${data.alvoId}`,
      });

      return null;
    });
  });
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/policy-link.test.ts`
Esperado: PASS, 3 testes.

- [ ] **Step 8: Commit**

```bash
git add packages/database/prisma/schema/charter.prisma \
        packages/database/prisma/schema/tenant.prisma \
        packages/database/prisma/migrations/20260806000000_charter_conformidade \
        "apps/app/app/(charter)/actions/policy.ts" \
        "apps/app/app/(charter)/actions/_shared.ts" \
        apps/app/__tests__/charter/policy-link.test.ts
git commit -m "feat(charter): vincular política a caso de uso e fornecedor

The RFP asks for this in two separate places — §4.1.4 and §4.3.2 — and it did
not exist at all: CharterPolicy related to sections, versions and tracks, never
to a use case or a vendor. A published policy that does not know what it applies
to leaves the auditor unable to get from the rule to the concrete case.

alvoId carries no foreign key because it points at two tables depending on
alvoTipo. Integrity lives in the action, which confirms the target inside the
tenant before writing — that check is what stops one client's policy from being
linked to another client's use case."
```

---

### Task 2: Probabilidade na matriz de risco

**Files:**
- Modify: `packages/database/prisma/schema/charter.prisma`
- Modify: `packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql`
- Create: `apps/app/__tests__/charter/risk-matrix.test.ts`
- Create: `apps/app/lib/charter/risk-matrix.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `severidade(impacto: number, probabilidade: number): number` e `nivel(sev: number): "BAIXO" | "MEDIO" | "ALTO" | "CRITICO"`, ambos em `@/lib/charter/risk-matrix`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/risk-matrix.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nivel, severidade } from "@/lib/charter/risk-matrix";

describe("severidade", () => {
  it("é impacto × probabilidade", () => {
    expect(severidade(4, 3)).toBe(12);
  });

  it("trata probabilidade ausente como 1 — score legado não vira zero", () => {
    // Linhas gravadas antes desta migration têm prob* = 1 por default. Se a
    // fórmula multiplicasse por 0, todo risco histórico viraria "sem risco".
    expect(severidade(4, 1)).toBe(4);
  });
});

describe("nivel", () => {
  it.each([
    [1, "BAIXO"],
    [6, "MEDIO"],
    [12, "ALTO"],
    [20, "CRITICO"],
  ])("severidade %i é %s", (sev, esperado) => {
    expect(nivel(sev)).toBe(esperado);
  });

  it("a fronteira pertence ao nível mais alto — 9 é ALTO, não MEDIO", () => {
    // Arredondar risco para baixo na fronteira é como comitê de risco perde
    // caso: o número fica logo abaixo do gatilho de aprovação.
    expect(nivel(9)).toBe("ALTO");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/risk-matrix.test.ts`
Esperado: FAIL — módulo `@/lib/charter/risk-matrix` não existe.

- [ ] **Step 3: Implementar**

Criar `apps/app/lib/charter/risk-matrix.ts`:

```ts
/**
 * RFP §4.1.2 — matriz de risco impacto × probabilidade.
 *
 * O Charter guardava só impacto (`risk*`), o que responde "quão ruim seria" e
 * não "quão provável é". Duas coisas com o mesmo impacto e probabilidades
 * opostas exigem tratamento diferente, e sem o segundo eixo o comitê prioriza
 * no escuro.
 *
 * As dimensões continuam fixas em coluna. Torná-las configuráveis (dimensão
 * como dado) é redesenho de schema e está fora deste ciclo — a RFP exige "ao
 * menos" 5 e o Charter tem 7.
 */
export function severidade(impacto: number, probabilidade: number): number {
  return impacto * probabilidade;
}

/** Fronteira pertence ao nível mais alto: arredondar risco para baixo é como
 *  um caso escapa do gatilho de aprovação por um ponto. */
export function nivel(sev: number): "BAIXO" | "MEDIO" | "ALTO" | "CRITICO" {
  if (sev >= 15) {
    return "CRITICO";
  }
  if (sev >= 9) {
    return "ALTO";
  }
  if (sev >= 4) {
    return "MEDIO";
  }
  return "BAIXO";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/risk-matrix.test.ts`
Esperado: PASS, 7 testes.

- [ ] **Step 5: Adicionar as colunas ao schema**

Em `model CharterUseCase`, logo abaixo do bloco `risk*`:

```prisma
  probPrivacy      Int @default(1)
  probRegulatory   Int @default(1)
  probSecurity     Int @default(1)
  probBias         Int @default(1)
  probIp           Int @default(1)
  probOperational  Int @default(1)
  probReputational Int @default(1)
```

Anexar ao fim de `20260806000000_charter_conformidade/migration.sql`:

```sql
-- Default 1, e não 0: linha existente tem de manter a severidade que já tinha.
-- Com 0, impacto × probabilidade zeraria todo risco histórico de uma vez.
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probPrivacy"      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probRegulatory"   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probSecurity"     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probBias"         INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probIp"           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probOperational"  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "probReputational" INTEGER NOT NULL DEFAULT 1;
```

Rodar: `cd packages/database && npx prisma format && npx prisma validate && npx prisma generate --no-hints`
Esperado: schema válido.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema/charter.prisma \
        packages/database/prisma/migrations/20260806000000_charter_conformidade \
        apps/app/lib/charter/risk-matrix.ts \
        apps/app/__tests__/charter/risk-matrix.test.ts
git commit -m "feat(charter): probabilidade na matriz de risco

RFP §4.1.2 asks for impact × probability. Charter stored impact only, which
answers how bad it would be and not how likely it is — two items with the same
impact and opposite likelihoods need different treatment, and without the second
axis the committee prioritises blind.

Probability columns default to 1 rather than 0 so existing rows keep the
severity they already had; a zero default would multiply every historical risk
down to nothing in one migration.

Boundaries belong to the higher level: severity 9 is ALTO, not MEDIO. Rounding
risk down at the boundary is how a case slips past its approval trigger by one
point."
```

---

### Task 3: Catálogo de capacidades e o teste que impede o mapa de mentir

O coração do desenho. Depende da Task 1 (`POLICY_LINK`).

**Files:**
- Create: `apps/app/lib/charter/capabilities.ts`
- Create: `apps/app/__tests__/charter/capabilities.test.ts`

**Interfaces:**
- Consumes: `charterPolicyLink` (Task 1).
- Produces: `CAPABILITIES: readonly Capability[]`, `type CapabilityId`, `getCapability(id: string): Capability | undefined`, e o tipo `Evidencia = { total: number; amostra: string[]; href?: string }`.

- [ ] **Step 1: Escrever o teste de contrato que falha**

Criar `apps/app/__tests__/charter/capabilities.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const dbStub = {
  charterPolicyVersion: { count: vi.fn().mockResolvedValue(3), findMany: vi.fn().mockResolvedValue([]) },
  charterAcknowledgment: { count: vi.fn().mockResolvedValue(37), findMany: vi.fn().mockResolvedValue([]) },
  charterDecision: { count: vi.fn().mockResolvedValue(12), findMany: vi.fn().mockResolvedValue([]) },
  charterVendor: { count: vi.fn().mockResolvedValue(8), findMany: vi.fn().mockResolvedValue([]) },
  charterPolicyLink: { count: vi.fn().mockResolvedValue(5), findMany: vi.fn().mockResolvedValue([]) },
  charterUseCase: { count: vi.fn().mockResolvedValue(21), findMany: vi.fn().mockResolvedValue([]) },
  auditLog: { count: vi.fn().mockResolvedValue(400), findMany: vi.fn().mockResolvedValue([]) },
};

vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => fn(dbStub),
}));

import { CAPABILITIES, getCapability } from "@/lib/charter/capabilities";

describe("catálogo de capacidades", () => {
  it("tem id único por entrada", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda capacidade tem rótulo em pt-BR não vazio", () => {
    for (const c of CAPABILITIES) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  // ESTE é o teste que sustenta o design. Se alguém remover um campo do schema
  // que uma capacidade consulta, ele quebra aqui — antes de o produto alegar
  // ao comprador uma conformidade que não consegue mais provar.
  it.each(CAPABILITIES.map((c) => [c.id, c] as const))(
    "%s consegue buscar a própria evidência",
    async (_id, cap) => {
      const ev = await cap.evidencia("t-1");
      expect(typeof ev.total).toBe("number");
      expect(Array.isArray(ev.amostra)).toBe(true);
    }
  );

  it("getCapability devolve undefined para id desconhecido, sem lançar", () => {
    expect(getCapability("NAO_EXISTE")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/capabilities.test.ts`
Esperado: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o catálogo**

Criar `apps/app/lib/charter/capabilities.ts`:

```ts
import "server-only";
import { withTenantDb } from "@repo/database";
import { nivel, severidade } from "@/lib/charter/risk-matrix";

/**
 * Catálogo do que o Charter consegue **provar**.
 *
 * A cobertura de uma exigência não guarda o texto da evidência; ela aponta para
 * uma capacidade, e a capacidade busca a evidência no banco a cada leitura.
 * `POLICY_ATTESTATION` não responde "sim" — responde "37 aceites registrados,
 * o mais recente em 12/07".
 *
 * Mora em código, e não em tabela, porque catálogo em banco vira ficção: alguém
 * cadastra capacidade que o código não tem e o mapa mente para o comprador. Em
 * código, `capabilities.test.ts` roda a consulta de cada entrada contra o
 * schema — se um campo sumir, o teste quebra antes de o produto alegar.
 */
export type Evidencia = { total: number; amostra: string[]; href?: string };

export type Capability = {
  id: string;
  label: string;
  evidencia: (tenantId: string) => Promise<Evidencia>;
};

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "POLICY_VERSIONING",
    label: "Versionamento de política com diff e histórico",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterPolicyVersion.count({ where: { tenantId } });
        const rows = await db.charterPolicyVersion.findMany({
          where: { tenantId },
          orderBy: { publishedAt: "desc" },
          take: 3,
          select: { version: true, changeCount: true },
        });
        return {
          total,
          amostra: rows.map((r) => `v${r.version} · ${r.changeCount} mudanças`),
          href: "/charter/policy",
        };
      }),
  },
  {
    id: "POLICY_ATTESTATION",
    label: "Aceite individual de política, com revalidação por versão",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterAcknowledgment.count({
          where: { tenantId, status: "ACKNOWLEDGED" },
        });
        const rows = await db.charterAcknowledgment.findMany({
          where: { tenantId, status: "ACKNOWLEDGED" },
          orderBy: { acknowledgedAt: "desc" },
          take: 3,
          select: { personName: true, acknowledgedAt: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) =>
              `${r.personName} · ${r.acknowledgedAt?.toLocaleDateString("pt-BR") ?? "—"}`
          ),
          href: "/charter/onboarding",
        };
      }),
  },
  {
    id: "DECISION_RECORD",
    label: "Decisão com aprovador, data, condicionantes e justificativa",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterDecision.count({ where: { tenantId } });
        const rows = await db.charterDecision.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { outcome: true, conditions: true, createdAt: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) => `${r.outcome} · ${r.conditions.length} condicionantes`
          ),
          href: "/charter/cases",
        };
      }),
  },
  {
    id: "VENDOR_TIER",
    label: "Fornecedor classificado como aprovado, restrito ou bloqueado",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterVendor.count({ where: { tenantId } });
        const rows = await db.charterVendor.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
          take: 3,
          select: { name: true, tier: true },
        });
        return {
          total,
          amostra: rows.map((r) => `${r.name} · ${r.tier}`),
          href: "/charter/vendors",
        };
      }),
  },
  {
    id: "POLICY_LINK",
    label: "Política vinculada a caso de uso e fornecedor",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterPolicyLink.count({ where: { tenantId } });
        const rows = await db.charterPolicyLink.findMany({
          where: { tenantId },
          take: 3,
          select: { alvoTipo: true, alvoId: true },
        });
        return {
          total,
          amostra: rows.map((r) => `${r.alvoTipo} · ${r.alvoId}`),
          href: "/charter/policy",
        };
      }),
  },
  {
    id: "RISK_SCORING",
    label: "Risco pontuado por impacto × probabilidade em 7 dimensões",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.charterUseCase.count({ where: { tenantId } });
        const rows = await db.charterUseCase.findMany({
          where: { tenantId },
          orderBy: { code: "asc" },
          take: 3,
          select: { code: true, riskPrivacy: true, probPrivacy: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) =>
              `${r.code} · privacidade ${nivel(severidade(r.riskPrivacy, r.probPrivacy))}`
          ),
          href: "/charter/risk",
        };
      }),
  },
  {
    id: "AUDIT_EXPORT",
    label: "Trilha de auditoria append-only, exportável",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const total = await db.auditLog.count({ where: { tenantId } });
        const rows = await db.auditLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { action: true, createdAt: true },
        });
        return {
          total,
          amostra: rows.map(
            (r) => `${r.action} · ${r.createdAt.toLocaleDateString("pt-BR")}`
          ),
          href: "/charter/audit",
        };
      }),
  },
] as const;

export type CapabilityId = (typeof CAPABILITIES)[number]["id"];

export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/capabilities.test.ts`
Esperado: PASS — 3 testes fixos + 7 do `it.each`, um por capacidade.

- [ ] **Step 5: Commit**

```bash
git add apps/app/lib/charter/capabilities.ts apps/app/__tests__/charter/capabilities.test.ts
git commit -m "feat(charter): catálogo de capacidades com evidência viva

Coverage does not store the text of the evidence; it points at a capability, and
the capability fetches its evidence from the database on every read. So the map
re-reads live data instead of being generated once and rotting into the outdated
spreadsheet this work exists to replace.

The catalogue lives in code rather than in a table because a database-driven one
drifts into fiction: someone registers a capability the code does not have and
the map lies to the buyer. In code, the contract test runs every entry's
evidence query against the schema — if a field disappears, the test breaks
before the product claims a conformity it can no longer prove."
```

---

### Task 4: Modelos de exigência, cobertura e conjunto

**Files:**
- Modify: `packages/database/prisma/schema/charter.prisma`
- Modify: `packages/database/prisma/schema/tenant.prisma`
- Modify: `packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql`
- Modify: `packages/rbac/src/charter-matrix.ts`

**Interfaces:**
- Produces: modelos `CharterRequirementSet`, `CharterRequirement`, `CharterCoverage`; enums `CharterReqOrigem`, `CharterReqEditor`, `CharterReqLicenca`, `CharterCoverageStatus`; permissões `"compliance.map"` e `"compliance.edit"`.

- [ ] **Step 1: Adicionar modelos ao schema**

No fim de `packages/database/prisma/schema/charter.prisma`:

```prisma
/// Conjunto de exigências: uma RFP recebida pelo cliente, ou uma regulação
/// publicada pela Nebuloz.
///
/// `tenantId` nulo significa conjunto global — regulação vale para todos. RFP é
/// do tenant que a importou.
model CharterRequirementSet {
  id          String             @id @default(cuid())
  tenantId    String?
  nome        String
  origem      CharterReqOrigem
  editor      CharterReqEditor
  jurisdicao  String?
  versao      String             @default("1")
  supersedesId String?
  /// LIVRE permite texto verbatim. REFERENCIA proíbe: norma proprietária
  /// (ISO/IEC 42001) só entra por citação e formulação própria.
  licenca     CharterReqLicenca  @default(LIVRE)
  importadoEm DateTime           @default(now())
  notas       String?            @db.Text

  tenant       Tenant?                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  supersedes   CharterRequirementSet?  @relation("CharterReqSetLineage", fields: [supersedesId], references: [id], onDelete: SetNull)
  supersededBy CharterRequirementSet[] @relation("CharterReqSetLineage")
  requirements CharterRequirement[]

  @@index([tenantId])
  @@index([origem])
}

/// Uma exigência. `citacao` e `resumo` sempre; `texto` só quando a licença do
/// conjunto permite reproduzir.
model CharterRequirement {
  id        String  @id @default(cuid())
  setId     String
  codigo    String
  citacao   String
  resumo    String  @db.Text
  texto     String? @db.Text
  peso      Int?
  categoria String?

  set       CharterRequirementSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  coverages CharterCoverage[]

  @@unique([setId, codigo])
  @@index([setId])
}

/// Veredito do tenant sobre uma exigência. Uma por exigência: dois vereditos
/// para a mesma linha são duas respostas contraditórias indo para o mesmo
/// comprador, e a tela teria de escolher uma — escolha que ninguém fez.
model CharterCoverage {
  id            String                @id @default(cuid())
  tenantId      String
  requirementId String
  status        CharterCoverageStatus @default(SEM_VEREDITO)
  comentario    String?               @db.Text
  capabilityId  String?
  atualizadoEm  DateTime              @updatedAt

  tenant      Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  requirement CharterRequirement @relation(fields: [requirementId], references: [id], onDelete: Cascade)

  @@unique([requirementId])
  @@index([tenantId])
  @@index([tenantId, status])
}

enum CharterReqOrigem {
  RFP
  REGULACAO
}

enum CharterReqEditor {
  TENANT
  NEBULOZ
}

enum CharterReqLicenca {
  LIVRE
  REFERENCIA
}

enum CharterCoverageStatus {
  ATENDE
  PARCIAL
  NAO_ATENDE
  SEM_VEREDITO
  REVISAR
}
```

Em `model Tenant`, antes da chave de fechamento:

```prisma
  charterRequirementSets    CharterRequirementSet[]
  charterCoverages          CharterCoverage[]
```

- [ ] **Step 2: Anexar o DDL à migration**

No fim de `20260806000000_charter_conformidade/migration.sql`:

```sql
DO $$ BEGIN CREATE TYPE "CharterReqOrigem"      AS ENUM ('RFP','REGULACAO');            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CharterReqEditor"      AS ENUM ('TENANT','NEBULOZ');           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CharterReqLicenca"     AS ENUM ('LIVRE','REFERENCIA');         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CharterCoverageStatus" AS ENUM ('ATENDE','PARCIAL','NAO_ATENDE','SEM_VEREDITO','REVISAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CharterRequirementSet" (
  "id" TEXT NOT NULL, "tenantId" TEXT, "nome" TEXT NOT NULL,
  "origem" "CharterReqOrigem" NOT NULL, "editor" "CharterReqEditor" NOT NULL,
  "jurisdicao" TEXT, "versao" TEXT NOT NULL DEFAULT '1', "supersedesId" TEXT,
  "licenca" "CharterReqLicenca" NOT NULL DEFAULT 'LIVRE',
  "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notas" TEXT,
  CONSTRAINT "CharterRequirementSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CharterRequirement" (
  "id" TEXT NOT NULL, "setId" TEXT NOT NULL, "codigo" TEXT NOT NULL,
  "citacao" TEXT NOT NULL, "resumo" TEXT NOT NULL, "texto" TEXT,
  "peso" INTEGER, "categoria" TEXT,
  CONSTRAINT "CharterRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CharterCoverage" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "requirementId" TEXT NOT NULL,
  "status" "CharterCoverageStatus" NOT NULL DEFAULT 'SEM_VEREDITO',
  "comentario" TEXT, "capabilityId" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharterCoverage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX        IF NOT EXISTS "CharterRequirementSet_tenantId_idx" ON "CharterRequirementSet"("tenantId");
CREATE INDEX        IF NOT EXISTS "CharterRequirementSet_origem_idx"   ON "CharterRequirementSet"("origem");
CREATE UNIQUE INDEX IF NOT EXISTS "CharterRequirement_setId_codigo_key" ON "CharterRequirement"("setId","codigo");
CREATE INDEX        IF NOT EXISTS "CharterRequirement_setId_idx"        ON "CharterRequirement"("setId");
CREATE UNIQUE INDEX IF NOT EXISTS "CharterCoverage_requirementId_key"   ON "CharterCoverage"("requirementId");
CREATE INDEX        IF NOT EXISTS "CharterCoverage_tenantId_idx"        ON "CharterCoverage"("tenantId");
CREATE INDEX        IF NOT EXISTS "CharterCoverage_tenantId_status_idx" ON "CharterCoverage"("tenantId","status");

DO $$ BEGIN ALTER TABLE "CharterRequirementSet" ADD CONSTRAINT "CharterRequirementSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterRequirementSet" ADD CONSTRAINT "CharterRequirementSet_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CharterRequirementSet"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterRequirement" ADD CONSTRAINT "CharterRequirement_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CharterRequirementSet"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterCoverage" ADD CONSTRAINT "CharterCoverage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CharterCoverage" ADD CONSTRAINT "CharterCoverage_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "CharterRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS só em CharterCoverage. CharterRequirementSet e CharterRequirement são
-- legíveis por todos quando tenantId é nulo (regulação global), e o filtro por
-- tenant fica na action — política de RLS com OR de nulo abre buraco fácil.
ALTER TABLE "CharterCoverage" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tenant_isolation" ON "CharterCoverage"
    USING ("tenantId" = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

Rodar: `cd packages/database && npx prisma format && npx prisma validate && npx prisma generate --no-hints`
Esperado: schema válido.

- [ ] **Step 3: Adicionar as permissões**

Em `packages/rbac/src/charter-matrix.ts`, no type `CharterPermission` e no array `CHARTER_PERMISSIONS`, adicionar `"compliance.map"` e `"compliance.edit"`. Em `CHARTER_PERMISSION_LABEL`:

```ts
  "compliance.map": "Ler o mapa de conformidade",
  "compliance.edit": "Definir veredito de cobertura",
```

Conceder na matriz de papéis pelo mesmo padrão das existentes: `compliance.map` a quem tem `audit.read`; `compliance.edit` a quem tem `policy.publish`.

- [ ] **Step 4: Adicionar as entidades de auditoria**

Em `apps/app/app/(charter)/actions/_shared.ts`, no type `CharterEntity`:

```ts
  | "charter.requirementset"
  | "charter.coverage"
```

- [ ] **Step 5: Verificar que nada quebrou**

Run: `cd apps/app && NODE_ENV=test pnpm run test`
Esperado: toda a suíte passa — este task só adiciona.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema packages/database/prisma/migrations/20260806000000_charter_conformidade \
        packages/rbac/src/charter-matrix.ts "apps/app/app/(charter)/actions/_shared.ts"
git commit -m "feat(charter): modelos de exigência, conjunto e cobertura

One coverage per requirement, enforced by the database and not only by the
screen: two verdicts on the same line are two contradictory answers going to the
same buyer, and the screen would have to pick one — a choice nobody made.

A requirement separates citacao and resumo, always present, from texto, which is
verbatim and permitted only where the licence allows reproduction. ISO/IEC 42001
is proprietary, so the distinction has to be structural rather than a rule
someone remembers when registering a new corpus.

tenantId is nullable on the set because regulation is published once by Nebuloz
and shared by every tenant, while an RFP belongs to the tenant that imported it."
```

---

### Task 5: Importar conjunto e definir cobertura

**Files:**
- Create: `apps/app/app/(charter)/actions/compliance.ts`
- Create: `apps/app/__tests__/charter/compliance.test.ts`

**Interfaces:**
- Consumes: `getCapability` (Task 3); modelos da Task 4.
- Produces: `listRequirementSets(): Promise<Result<SetRow[]>>`, `importRequirementSet(input): Promise<Result<{ id: string; total: number }>>`, `setCoverage(input): Promise<Result<null>>`, `getComplianceMap(setId): Promise<Result<ComplianceMap>>`, e os tipos `SetRow`, `MapRow`, `ComplianceMap`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/compliance.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  setCreate: vi.fn(),
  setFindFirst: vi.fn(),
  reqCreateMany: vi.fn(),
  reqFindMany: vi.fn(),
  covUpsert: vi.fn(),
  covFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterRequirementSet: { create: h.setCreate, findFirst: h.setFindFirst },
      charterRequirement: { createMany: h.reqCreateMany, findMany: h.reqFindMany },
      charterCoverage: { upsert: h.covUpsert, findMany: h.covFindMany },
      auditLog: { create: h.auditCreate },
    }),
}));
vi.mock("@/lib/charter/capabilities", () => ({
  getCapability: (id: string) =>
    id === "POLICY_ATTESTATION"
      ? {
          id,
          label: "Aceite individual de política",
          evidencia: async () => ({ total: 37, amostra: ["Bia · 12/07"] }),
        }
      : undefined,
}));

import {
  getComplianceMap,
  importRequirementSet,
  setCoverage,
} from "../../app/(charter)/actions/compliance";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE_LEAD",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("importRequirementSet", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setCreate.mockResolvedValue({ id: "s-1" });
    h.reqCreateMany.mockResolvedValue({ count: 2 });
  });

  it("importa exigências e devolve a contagem", async () => {
    const res = await importRequirementSet({
      nome: "RFP Aurora Mesh",
      origem: "RFP",
      requisitos: [
        { codigo: "4.1.2", citacao: "§4.1.2", resumo: "Matriz de risco" },
        { codigo: "4.1.3", citacao: "§4.1.3", resumo: "Workflow de aprovação" },
      ],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.total).toBe(2);
  });

  it("recusa código duplicado nomeando a linha ofensora", async () => {
    const res = await importRequirementSet({
      nome: "RFP com erro de colagem",
      origem: "RFP",
      requisitos: [
        { codigo: "4.1.2", citacao: "§4.1.2", resumo: "Primeira" },
        { codigo: "4.1.2", citacao: "§4.1.2", resumo: "Colada duas vezes" },
      ],
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    // Adivinhar qual das duas vale é escolher em nome do usuário.
    expect(res.error).toContain("4.1.2");
    expect(h.setCreate).not.toHaveBeenCalled();
  });

  it("recusa texto verbatim em conjunto REFERENCIA — guarda de copyright", async () => {
    const res = await importRequirementSet({
      nome: "ISO/IEC 42001",
      origem: "REGULACAO",
      licenca: "REFERENCIA",
      requisitos: [
        {
          codigo: "6.1.2",
          citacao: "cláusula 6.1.2",
          resumo: "Formulação nossa do objetivo",
          texto: "texto literal da norma proprietária",
        },
      ],
    });

    expect(res.ok).toBe(false);
    expect(h.setCreate).not.toHaveBeenCalled();
  });
});

describe("setCoverage", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.covUpsert.mockResolvedValue({ id: "c-1" });
  });

  it("é upsert por requisito — nunca cria veredito duplicado", async () => {
    await setCoverage({
      requirementId: "r-1",
      status: "ATENDE",
      capabilityId: "POLICY_ATTESTATION",
    });

    expect(h.covUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requirementId: "r-1" } })
    );
  });

  it("recusa capacidade que não existe no catálogo", async () => {
    const res = await setCoverage({
      requirementId: "r-1",
      status: "ATENDE",
      capabilityId: "INVENTADA",
    });

    expect(res.ok).toBe(false);
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("ATENDE sem capacidade é recusado — alegação precisa de prova", async () => {
    const res = await setCoverage({ requirementId: "r-1", status: "ATENDE" });

    expect(res.ok).toBe(false);
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("NAO_ATENDE dispensa capacidade", async () => {
    const res = await setCoverage({ requirementId: "r-1", status: "NAO_ATENDE" });

    expect(res.ok).toBe(true);
  });
});

describe("getComplianceMap", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setFindFirst.mockResolvedValue({ id: "s-1", nome: "RFP", licenca: "LIVRE" });
    h.reqFindMany.mockResolvedValue([
      { id: "r-1", codigo: "4.1.5", citacao: "§4.1.5", resumo: "Attestation", peso: null },
      { id: "r-2", codigo: "6.3", citacao: "§6.3", resumo: "Dado em prompt", peso: null },
    ]);
    h.covFindMany.mockResolvedValue([
      { requirementId: "r-1", status: "ATENDE", comentario: null, capabilityId: "POLICY_ATTESTATION" },
    ]);
  });

  it("anexa evidência viva às linhas que atendem", async () => {
    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const linha = res.data.linhas.find((l) => l.codigo === "4.1.5");
    expect(linha?.evidencia?.total).toBe(37);
  });

  it("conta as linhas sem veredito para o cabeçalho do export", async () => {
    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.semVeredito).toBe(1);
  });

  it("degrada para evidência indisponível quando a consulta falha", async () => {
    // O mapa nunca pode seguir mostrando "atende" limpo sem conseguir provar:
    // mapa que afirma sem provar vai para o comprador com a chancela do produto.
    const { getCapability } = await import("@/lib/charter/capabilities");
    vi.mocked(getCapability).mockReturnValueOnce({
      id: "POLICY_ATTESTATION",
      label: "Aceite",
      evidencia: () => Promise.reject(new Error("coluna removida")),
    });

    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const linha = res.data.linhas.find((l) => l.codigo === "4.1.5");
    expect(linha?.evidencia).toBeNull();
    expect(linha?.evidenciaErro).toBeTruthy();
  });

  it("cobertura apontando capacidade removida do catálogo diz isso", async () => {
    // Cobertura gravada há meses aponta capacidade que uma refatoração tirou do
    // catálogo. Renderizar em branco esconde que a alegação perdeu o lastro; a
    // linha tem de pedir revisão em vez de continuar parecendo provada.
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "ATENDE",
        comentario: null,
        capabilityId: "CAPACIDADE_QUE_SUMIU",
      },
    ]);

    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const linha = res.data.linhas.find((l) => l.codigo === "4.1.5");
    expect(linha?.evidencia).toBeNull();
    expect(linha?.evidenciaErro).toContain("removida");
  });

  it("conjunto de outro tenant é não encontrado, sem distinguir de inexistente", async () => {
    // Mensagem diferente para "não é seu" e "não existe" confirma ao curioso que
    // o id existe em algum lugar — é enumeração de tenant pela porta dos fundos.
    h.setFindFirst.mockResolvedValue(null);

    const res = await getComplianceMap("s-de-outro-tenant");

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("não encontrado");
    expect(h.reqFindMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance.test.ts`
Esperado: FAIL — módulo `compliance.ts` não existe.

- [ ] **Step 3: Implementar**

Criar `apps/app/app/(charter)/actions/compliance.ts`. Estrutura obrigatória:

```ts
"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import { getCapability } from "@/lib/charter/capabilities";
import { requireCharterPermissionContext } from "@/lib/charter/guards";
import { GovernanceError, logCharterAudit, type Result, safeAction } from "./_shared";

export type MapRow = {
  requirementId: string;
  codigo: string;
  citacao: string;
  resumo: string;
  peso: number | null;
  status: "ATENDE" | "PARCIAL" | "NAO_ATENDE" | "SEM_VEREDITO" | "REVISAR";
  comentario: string | null;
  capabilityId: string | null;
  capabilityLabel: string | null;
  evidencia: { total: number; amostra: string[]; href?: string } | null;
  /** Preenchido quando a consulta de evidência falhou. A linha então não pode
   *  ser lida como prova — só como alegação. */
  evidenciaErro: string | null;
};

export type ComplianceMap = {
  setId: string;
  nome: string;
  linhas: MapRow[];
  semVeredito: number;
};

export type SetRow = {
  id: string;
  nome: string;
  origem: "RFP" | "REGULACAO";
  versao: string;
  total: number;
};

const RequisitoSchema = z.object({
  codigo: z.string().min(1).max(32),
  citacao: z.string().min(1).max(120),
  resumo: z.string().min(1),
  texto: z.string().optional(),
  peso: z.number().int().optional(),
  categoria: z.string().optional(),
});

const ImportSchema = z.object({
  nome: z.string().min(1).max(200),
  origem: z.enum(["RFP", "REGULACAO"]),
  editor: z.enum(["TENANT", "NEBULOZ"]).default("TENANT"),
  licenca: z.enum(["LIVRE", "REFERENCIA"]).default("LIVRE"),
  jurisdicao: z.string().optional(),
  versao: z.string().default("1"),
  notas: z.string().optional(),
  requisitos: z.array(RequisitoSchema).min(1),
});
```

Regras que a implementação deve cumprir, cada uma coberta por um teste do Step 1:

1. `importRequirementSet` — permissão `compliance.edit`. **Antes de qualquer escrita**: detectar código repetido em `requisitos` e lançar `GovernanceError("req.duplicate", 'Código repetido na importação: "4.1.2". Corrija antes de importar.')` nomeando o código. Se `licenca === "REFERENCIA"` e algum requisito trouxer `texto`, lançar `GovernanceError("req.licenca", "Conjunto REFERENCIA não pode reproduzir texto de norma proprietária — use apenas citação e resumo.")`. Depois criar o set e `createMany` dos requisitos, e auditar com `entityType: "charter.requirementset"`.
2. `setCoverage` — permissão `compliance.edit`. Se `capabilityId` vier e `getCapability` devolver `undefined`, lançar `GovernanceError("coverage.capability.unknown", ...)`. Se `status === "ATENDE"` ou `"PARCIAL"` sem `capabilityId`, lançar `GovernanceError("coverage.needs.capability", "Alegar conformidade exige apontar a capacidade que a prova.")`. Gravar com `upsert` sobre `where: { requirementId }`, auditando com `entityType: "charter.coverage"` e `diff` `[["status", anterior, novo]]`.
3. `getComplianceMap` — permissão `compliance.map`. Buscar o set com `findFirst({ where: { id, OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] } })` — aceita o do tenant **ou** o global de regulação. Ausente ⇒ `GovernanceError("set.unknown", "Conjunto de exigências não encontrado.")`, a mesma mensagem para "não existe" e "não é seu": distinguir confirma ao curioso que o id existe em algum lugar. Depois os requisitos e as coberturas do tenant. Para cada linha com `capabilityId`:
   - `getCapability` devolveu `undefined` ⇒ `evidencia: null`, `evidenciaErro: "Capacidade removida do catálogo — revise esta cobertura."`
   - resolveu ⇒ buscar a evidência em `try/catch`; no `catch`, `evidencia: null` e `evidenciaErro` com a mensagem.

   **Nunca** deixar a linha com `evidencia: null` e `evidenciaErro: null` aparentando prova. Contar `semVeredito`.
4. `listRequirementSets` — permissão `compliance.map`. Devolve sets do tenant e os globais (`tenantId: null`), com `total` de requisitos.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance.test.ts`
Esperado: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(charter)/actions/compliance.ts" apps/app/__tests__/charter/compliance.test.ts
git commit -m "feat(charter): importar exigências e definir cobertura

Claiming conformity requires pointing at the capability that proves it: ATENDE
and PARCIAL without a capability are refused. An assertion with no evidence
behind it is exactly what the buyer cannot check and what turns an audit into a
legal problem.

Duplicate codes are refused by naming the offending line rather than deduped,
because guessing which of the two pasted rows counts is making a choice on the
user's behalf about what they will answer to a buyer.

When an evidence query fails the row degrades to unavailable, with the reason,
and never keeps showing a clean 'meets': a map that asserts conformity without
being able to prove it goes to the buyer carrying the product's endorsement."
```

---

### Task 6: Propagação de mudança de versão de regulação

**Files:**
- Modify: `apps/app/app/(charter)/actions/compliance.ts`
- Modify: `apps/app/__tests__/charter/compliance.test.ts`

**Interfaces:**
- Consumes: modelos da Task 4.
- Produces: `publishSetVersion(input: { supersedesId: string; nome: string; versao: string; requisitos: ... }): Promise<Result<{ id: string; afetadas: number }>>`.

- [ ] **Step 1: Escrever o teste que falha**

Anexar a `apps/app/__tests__/charter/compliance.test.ts`:

```ts
describe("publishSetVersion", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setFindFirst.mockResolvedValue({ id: "s-1", nome: "EU AI Act", licenca: "LIVRE" });
    h.setCreate.mockResolvedValue({ id: "s-2" });
    h.reqCreateMany.mockResolvedValue({ count: 2 });
    // Versão anterior: 4.1 e 4.2. A nova muda 4.2 e mantém 4.1.
    h.reqFindMany.mockResolvedValue([
      { id: "r-1", codigo: "4.1", resumo: "Inalterada" },
      { id: "r-2", codigo: "4.2", resumo: "Texto antigo" },
    ]);
  });

  it("marca como REVISAR só as coberturas cujo requisito mudou", async () => {
    const res = await publishSetVersion({
      supersedesId: "s-1",
      nome: "EU AI Act",
      versao: "2",
      requisitos: [
        { codigo: "4.1", citacao: "Art. 4.1", resumo: "Inalterada" },
        { codigo: "4.2", citacao: "Art. 4.2", resumo: "Texto NOVO" },
      ],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    // Só 4.2 mudou. Marcar tudo faria o cliente revisar o que não moveu, e é
    // assim que aviso de mudança regulatória vira ruído que se ignora.
    expect(res.data.afetadas).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance.test.ts -t publishSetVersion`
Esperado: FAIL — `publishSetVersion` não existe.

- [ ] **Step 3: Implementar**

Adicionar a `compliance.ts`. Permissão `compliance.edit`. Numa só `withTenantDb`:

1. Carregar o set anterior por `supersedesId` e seus requisitos.
2. Criar o set novo com `supersedesId` apontando para o anterior, e `createMany` dos requisitos.
3. Comparar por `codigo`: um requisito **mudou** quando `resumo` ou `texto` diferem do anterior de mesmo código; **novo** quando o código não existia; **removido** quando sumiu.
4. Para cada código alterado ou removido, atualizar a cobertura do tenant vinculada ao requisito **antigo** para `status: "REVISAR"`. Código inalterado não é tocado.
5. Auditar com `entityType: "charter.requirementset"`, `note` no formato `"v2 · 1 alterada, 0 nova, 0 removida · 1 cobertura em revisão"`.
6. Devolver `{ id, afetadas }`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance.test.ts`
Esperado: PASS, 13 testes.

- [ ] **Step 5: Commit**

```bash
git add "apps/app/app/(charter)/actions/compliance.ts" apps/app/__tests__/charter/compliance.test.ts
git commit -m "feat(charter): propagar mudança de versão de regulação

RFP §6.1 asks for a process for continuous update as new regulation appears.
This reuses the versioning the Charter already has for policies: a new set
supersedes the previous one and the diff by code decides what moved.

Only coverages whose requirement actually changed are marked for review.
Flagging everything would make the client re-examine what did not move, and that
is how a regulatory change notice becomes noise people learn to ignore."
```

---

### Task 7: Fundamento citado no rascunho gerado

**Files:**
- Modify: `packages/database/prisma/schema/charter.prisma`
- Modify: `packages/database/prisma/migrations/20260806000000_charter_conformidade/migration.sql`
- Modify: `apps/app/app/(charter)/actions/policy.ts`
- Create: `apps/app/__tests__/charter/grounded-draft.test.ts`

**Interfaces:**
- Consumes: `CharterRequirement` (Task 4).
- Produces: `saveGeneratedDraft` passa a exigir `groundedRequirementId: string`.

- [ ] **Step 1: Adicionar a coluna**

Em `model CharterPolicySection`:

```prisma
  /// Exigência que fundamentou o rascunho gerado. Obrigatório quando
  /// `generated = true`: texto de política sem citação é o que o auditor
  /// encontra antes de você.
  groundedRequirementId String?
```

Na migration:

```sql
ALTER TABLE "CharterPolicySection" ADD COLUMN IF NOT EXISTS "groundedRequirementId" TEXT;
```

Rodar `npx prisma format && npx prisma validate && npx prisma generate --no-hints`.

- [ ] **Step 2: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/grounded-draft.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  sectionFindFirst: vi.fn(),
  sectionUpdate: vi.fn(),
  reqFindFirst: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicySection: { findFirst: h.sectionFindFirst, update: h.sectionUpdate },
      charterRequirement: { findFirst: h.reqFindFirst },
      auditLog: { create: h.auditCreate },
    }),
}));

import { saveGeneratedDraft } from "../../app/(charter)/actions/policy";

describe("saveGeneratedDraft", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue({
      tenantId: "t-1",
      userId: "u-1",
      charterRole: "COMPLIANCE_LEAD",
      user: { name: "Bia", email: "bia@x.com" },
    });
    h.sectionFindFirst.mockResolvedValue({ id: "sec-1", ordinal: 3, name: "Uso aceitável" });
    h.reqFindFirst.mockResolvedValue({ id: "r-1", citacao: "Art. 9º" });
    h.sectionUpdate.mockResolvedValue({ id: "sec-1" });
  });

  it("grava o fundamento junto do rascunho", async () => {
    const res = await saveGeneratedDraft({
      sectionId: "sec-1",
      body: "Texto gerado.",
      groundedRequirementId: "r-1",
    });

    expect(res.ok).toBe(true);
    expect(h.sectionUpdate.mock.calls[0][0].data.groundedRequirementId).toBe("r-1");
  });

  it("recusa rascunho sem fundamento — geração sem citação é estado inválido", async () => {
    const res = await saveGeneratedDraft({
      sectionId: "sec-1",
      body: "Texto gerado sem base.",
    } as never);

    expect(res.ok).toBe(false);
    expect(h.sectionUpdate).not.toHaveBeenCalled();
  });

  it("recusa fundamento inexistente", async () => {
    h.reqFindFirst.mockResolvedValue(null);

    const res = await saveGeneratedDraft({
      sectionId: "sec-1",
      body: "Texto.",
      groundedRequirementId: "r-inventado",
    });

    expect(res.ok).toBe(false);
    expect(h.sectionUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/grounded-draft.test.ts`
Esperado: FAIL — o schema atual não exige `groundedRequirementId`.

- [ ] **Step 4: Implementar**

Em `policy.ts`, adicionar `groundedRequirementId: z.string().min(1)` ao `DraftSchema`. Antes do `update`, confirmar o requisito com `db.charterRequirement.findFirst({ where: { id: data.groundedRequirementId } })` e lançar `GovernanceError("draft.grounding.unknown", "Exigência que fundamenta o rascunho não encontrada.")` se ausente. Gravar `groundedRequirementId` junto de `body`, `status: "DRAFT"` e `generated: true`. Incluir a citação no `target` da auditoria.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/grounded-draft.test.ts`
Esperado: PASS, 3 testes.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `cd apps/app && NODE_ENV=test pnpm run test`
Esperado: tudo verde. `saveGeneratedDraft` ganhou campo obrigatório — se algum chamador existente quebrar, corrigir agora.

- [ ] **Step 7: Commit**

```bash
git add packages/database/prisma/schema/charter.prisma \
        packages/database/prisma/migrations/20260806000000_charter_conformidade \
        "apps/app/app/(charter)/actions/policy.ts" \
        apps/app/__tests__/charter/grounded-draft.test.ts
git commit -m "feat(charter): exigir fundamento citado em rascunho gerado

saveGeneratedDraft recorded generated: true and nothing about what grounded the
generation, so policy text was born with no citation and no trace. In a
governance product that will itself be audited, that is the kind of thing the
auditor finds before you do.

A generated draft without grounding is now an invalid state rather than the
default."
```

---

### Task 8: Export do mapa em CSV, JSON e PDF

**Files:**
- Create: `apps/app/lib/charter/compliance-pdf.tsx`
- Create: `apps/app/app/(charter)/actions/compliance-export.ts`
- Create: `apps/app/__tests__/charter/compliance-export.test.ts`
- Modify: `apps/app/package.json`

**Interfaces:**
- Consumes: `getComplianceMap`, `ComplianceMap`, `MapRow` (Task 5).
- Produces: `exportComplianceMap(input: { setId: string; format: "csv" | "json" | "pdf" }): Promise<Result<{ filename: string; mimeType: string; content: string; encoding: "utf8" | "base64" }>>` e `cabecalho(map: ComplianceMap): string`.

- [ ] **Step 1: Instalar a dependência**

```bash
pnpm --filter app add @react-pdf/renderer
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/compliance-export.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cabecalho } from "@/lib/charter/compliance-pdf";

const base = {
  setId: "s-1",
  nome: "RFP Aurora Mesh",
  semVeredito: 12,
  linhas: new Array(47).fill(null).map((_, i) => ({
    requirementId: `r-${i}`,
    codigo: `${i}`,
    citacao: `§${i}`,
    resumo: "x",
    peso: null,
    status: "SEM_VEREDITO" as const,
    comentario: null,
    capabilityId: null,
    capabilityLabel: null,
    evidencia: null,
    evidenciaErro: null,
  })),
};

describe("cabecalho", () => {
  it("declara quantas exigências não têm veredito", () => {
    // Exportar rascunho é uso legítimo; mandar meio mapa achando que é o mapa
    // não é. O cabeçalho é o que separa os dois.
    expect(cabecalho(base)).toContain("12 de 47");
  });

  it("não avisa quando o mapa está completo", () => {
    expect(cabecalho({ ...base, semVeredito: 0 })).not.toContain("sem veredito");
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance-export.test.ts`
Esperado: FAIL — módulo não existe.

- [ ] **Step 4: Implementar**

Criar `apps/app/lib/charter/compliance-pdf.tsx` exportando:

```ts
export function cabecalho(map: ComplianceMap): string {
  const total = map.linhas.length;
  if (map.semVeredito === 0) {
    return `${map.nome} · ${total} exigências`;
  }
  return `${map.nome} · ${total} exigências · ${map.semVeredito} de ${total} sem veredito`;
}
```

E o documento `@react-pdf/renderer` com uma tabela: código, citação, resumo, status, capacidade, evidência (total + primeira amostra). Linha com `evidenciaErro` imprime *"evidência indisponível"* — **nunca** em branco, que se leria como prova ausente por não existir e não por falha.

Criar `apps/app/app/(charter)/actions/compliance-export.ts` com `exportComplianceMap`, permissão `audit.export`, chamando `getComplianceMap` e ramificando por formato. PDF sai em `base64`; CSV e JSON em `utf8`. Falha ao renderizar PDF lança `GovernanceError("export.pdf", ...)` — **não** cai para CSV, que entregaria formato diferente do pedido sem avisar. Auditar com `entityType: "charter.export"`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance-export.test.ts`
Esperado: PASS, 2 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/app/lib/charter/compliance-pdf.tsx \
        "apps/app/app/(charter)/actions/compliance-export.ts" \
        apps/app/__tests__/charter/compliance-export.test.ts \
        apps/app/package.json pnpm-lock.yaml
git commit -m "feat(charter): exportar o mapa em CSV, JSON e PDF

RFP §6.5 lists PDF among the required export formats and the Charter only did
CSV and JSON — PDF is the one an auditor asks for.

@react-pdf/renderer rather than a headless browser: no extra binary, no bundle
blowout in a serverless function, and an audit report is tables and text, which
is what it does well.

Exporting an incomplete map is not blocked, because exporting a draft is
legitimate use, but the header states how many requirements have no verdict so
nobody sends half a map believing it is the map. A row whose evidence query
failed prints 'evidence unavailable' rather than blank, which would read as
absent by nature rather than by failure."
```

---

### Task 9: Tela `/charter/conformidade`

**Files:**
- Create: `apps/app/components/charter/screens/compliance.tsx`
- Modify: `apps/app/components/charter/screens/registry.tsx`
- Modify: `apps/app/components/charter/base.tsx` (nav)
- Create: `apps/app/__tests__/charter/compliance-screen.test.tsx`

**Interfaces:**
- Consumes: `getComplianceMap`, `listRequirementSets`, `setCoverage` (Task 5); `exportComplianceMap` (Task 8).

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/compliance-screen.test.tsx` com `/** @vitest-environment jsdom */` na primeira linha, mockando `@/app/(charter)/actions/compliance` e `@/app/(charter)/actions/compliance-export`, cobrindo:

1. Linha `ATENDE` mostra a evidência (`"37 aceites"`).
2. Linha com `evidenciaErro` mostra *"evidência indisponível"* e **não** mostra a evidência.
3. Linha `REVISAR` aparece destacada com o motivo.
4. Contagem de sem-veredito visível na tela, não só no export.
5. Estado vazio (nenhum conjunto) com CTA de importar.
6. Estado de erro sem renderizar linha nenhuma.

Cada asserção sobre conteúdo, sem snapshot — snapshot quebra em ajuste de Tailwind e a correção vira "atualizar tudo", que é quando o teste deixa de proteger.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance-screen.test.tsx`
Esperado: FAIL — componente não existe.

- [ ] **Step 3: Implementar a tela**

Criar `compliance.tsx` seguindo o padrão de `vendors.tsx`: `"use client"`, `useCallback` + `useEffect` para carregar, `PageHeader`, `SectionCard`, `EmptyState`, `ErrorState` do kit do Charter, `useActionToast` nas mutações.

Registrar em `registry.tsx`:

```ts
import ComplianceScreen from "./compliance";
// ...
  conformidade: ComplianceScreen,
```

E adicionar o item de navegação em `base.tsx`, junto de `audit`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/compliance-screen.test.tsx`
Esperado: PASS, 6 testes.

- [ ] **Step 5: Verificação completa**

```bash
cd apps/app && NODE_ENV=test pnpm run test
cd apps/app && npx tsc --noEmit -p tsconfig.json
cd ../.. && npx @biomejs/biome check apps/app/lib/charter apps/app/components/charter "apps/app/app/(charter)/actions" apps/app/__tests__/charter
```
Esperado: suíte verde, `TypeScript: No errors found`, biome limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/app/components/charter/screens/compliance.tsx \
        apps/app/components/charter/screens/registry.tsx \
        apps/app/components/charter/base.tsx \
        apps/app/__tests__/charter/compliance-screen.test.tsx
git commit -m "feat(charter): tela do mapa de conformidade

The screen suggests a capability by keyword but the person decides: the product
records what someone asserted and attaches the evidence that exists in the data.
It does not decide whether you comply. An assertion of conformity with no
accountable author is what turns an audit into a legal problem.

A row whose evidence query failed says so instead of rendering blank, and the
unmapped count is on screen rather than only in the export — the person deciding
what to send needs it before exporting, not after."
```

---

### Task 10: Semear os quatro corpora de regulação

**Files:**
- Create: `packages/database/scripts/seed-regulacao.mts`
- Create: `apps/app/__tests__/charter/licenca-copyright.test.ts`
- Modify: `packages/database/package.json`

**Interfaces:**
- Consumes: modelos da Task 4.

- [ ] **Step 1: Escrever a guarda de copyright que falha**

Criar `apps/app/__tests__/charter/licenca-copyright.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CORPORA } from "../../../../packages/database/scripts/seed-regulacao.mts";

describe("guarda de copyright dos corpora", () => {
  // ISO/IEC 42001 é norma proprietária: reproduzir o texto das cláusulas é
  // infração. Isso não pode depender de alguém lembrar no code review, nem do
  // próximo que for cadastrar um conjunto novo.
  it("nenhum conjunto REFERENCIA traz texto verbatim", () => {
    for (const corpus of CORPORA) {
      if (corpus.licenca !== "REFERENCIA") {
        continue;
      }
      for (const req of corpus.requisitos) {
        expect(
          req.texto,
          `${corpus.nome} · ${req.codigo} não pode reproduzir texto`
        ).toBeUndefined();
      }
    }
  });

  it("todo requisito tem citação e resumo, independente da licença", () => {
    for (const corpus of CORPORA) {
      for (const req of corpus.requisitos) {
        expect(req.citacao.length).toBeGreaterThan(0);
        expect(req.resumo.length).toBeGreaterThan(0);
      }
    }
  });

  it("ISO/IEC 42001 está marcada como REFERENCIA", () => {
    const iso = CORPORA.find((c) => c.nome.includes("42001"));
    expect(iso?.licenca).toBe("REFERENCIA");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/licenca-copyright.test.ts`
Esperado: FAIL — o script não existe.

- [ ] **Step 3: Escrever o seed**

Criar `packages/database/scripts/seed-regulacao.mts` exportando `CORPORA` e, sob o guard de entrypoint que os outros seeds usam, semeando via `upsert` por `(nome, versao)`.

Conteúdo mínimo do primeiro corte — **os quatro conjuntos, com pelo menos 5 exigências cada**:

| Conjunto | `origem` | `jurisdicao` | `licenca` | Fonte da citação |
|---|---|---|---|---|
| `EU AI Act — sistemas de alto risco` | `REGULACAO` | `UE` | `LIVRE` | Artigos 9 a 15 |
| `LGPD — tratamento e decisão automatizada` | `REGULACAO` | `BR` | `LIVRE` | Arts. 6, 18, 20, 37, 38 |
| `NIST AI RMF 1.0` | `REGULACAO` | `US` | `LIVRE` | Funções GOVERN, MAP, MEASURE, MANAGE |
| `ISO/IEC 42001 — objetivos de controle` | `REGULACAO` | `INT` | `REFERENCIA` | Cláusulas 4 a 10 |

Todos com `editor: "NEBULOZ"` e `tenantId: null`. Para o conjunto ISO, **`texto` ausente em todo requisito** — só `citacao` (número da cláusula) e `resumo` (formulação nossa do objetivo de controle).

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/app && NODE_ENV=test npx vitest run __tests__/charter/licenca-copyright.test.ts`
Esperado: PASS, 3 testes.

- [ ] **Step 5: Registrar o script**

Em `packages/database/package.json`, nos `scripts`:

```json
"seed:regulacao": "tsx scripts/seed-regulacao.mts"
```

- [ ] **Step 6: Verificação final**

```bash
cd apps/app && NODE_ENV=test pnpm run test
cd apps/app && npx tsc --noEmit -p tsconfig.json
```
Esperado: suíte verde e tipos limpos.

- [ ] **Step 7: Commit**

```bash
git add packages/database/scripts/seed-regulacao.mts \
        packages/database/package.json \
        apps/app/__tests__/charter/licenca-copyright.test.ts
git commit -m "feat(charter): semear AI Act, LGPD, NIST AI RMF e ISO/IEC 42001

Regulation is a requirement set published by Nebuloz, structurally identical to
a client's RFP, so a tenant maps its evidence once and answers both.

The copyright guard is a test rather than discipline. ISO/IEC 42001 is
proprietary and reproducing clause text infringes, so the ISO corpus carries
only the clause number and our own formulation of the control objective, and a
test fails if any REFERENCIA set ever gains verbatim text. Infringement cannot
depend on someone catching it in review, nor on whoever registers the next
corpus knowing the rule."
```

---

## Verificação final do plano

```bash
cd apps/app && NODE_ENV=test pnpm run test
cd apps/app && npx tsc --noEmit -p tsconfig.json
cd ../.. && npx @biomejs/biome check apps/app packages/database packages/rbac
cd ../.. && pnpm turbo build --filter=app
```

Depois de mergear com `main`, **rodar a suíte de novo contra o resultado do merge**. Conflito semântico — arquivo de teste que chegou de outra branch exercitando código que esta branch mudou — não aparece de nenhum outro jeito, e foi assim que o deploy de `main` quebrou nesta mesma base.

## O que este plano não faz

Registrado para não ser redescoberto como surpresa:

- **Enforcement em runtime** (RFP §6.3 e §6.4). Aposta em aberto, dependente da pesquisa de concorrente.
- **Detecção automática de viés** (§6.2). `riskBias` continua sendo pontuação humana.
- **Matriz de risco configurável.** Dimensão como dado em vez de coluna é redesenho de schema.
- **Portfólio, ROI e integrações** (§3.1, §4.2, §4.4). São Cosmos — o Charter não responde a RFP sozinho.
- **Curadoria contínua dos corpora.** É trabalho editorial recorrente e precisa de dono nomeado. Sem isso o conjunto envelhece e passa a citar norma revogada, que é a falha que este desenho existe para evitar.
