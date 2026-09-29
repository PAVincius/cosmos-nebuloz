import { describe, expect, it, vi } from "vitest";
import { bootstrapCharter } from "../charter";
import { deriveVendorMaxClass } from "../charter-rules";

/** Prova de ponta a ponta do PRD do Charter, linha 164 ("Um tenant
 *  provisionado pelo back-office decide um caso Interno sem SQL e sem
 *  seed"): as cláusulas que o bootstrap cria (sem SQL nem seed) são
 *  exatamente as que `deriveVendorMaxClass` precisa para tirar o teto de um
 *  fornecedor de PUBLIC. Não substitui um teste de integração com banco
 *  real — comprova que os dois módulos, ligados pelos códigos reais do
 *  catálogo, compõem para o resultado que o produto promete. */

function makeDb() {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ id: "user-compliance" }) },
    tenant: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "tenant-novo", slug: "cliente-novo" }),
    },
    tenantMember: { findFirst: vi.fn().mockResolvedValue({ id: "tm-1" }) },
    charterMembership: { upsert: vi.fn().mockResolvedValue({ id: "cm-1" }) },
    charterSettings: { upsert: vi.fn().mockResolvedValue({ id: "cs-1" }) },
    charterPolicy: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "policy-novo" }),
    },
    charterPolicySection: {
      createMany: vi.fn().mockResolvedValue({ count: 9 }),
    },
    charterClause: {
      createMany: vi.fn().mockResolvedValue({ count: 8 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

describe("bootstrap de cláusulas × derivação de teto (SC-002 da spec 011)", () => {
  it("um fornecedor associado a todas as cláusulas que o bootstrap cria sobe teto acima de PUBLIC", async () => {
    const db = makeDb();

    await bootstrapCharter(
      {
        withTenantDb: vi.fn(async (_tenantId, fn) => fn(db as never)),
      },
      {
        tenantId: "tenant-novo",
        complianceEmail: "ana@cliente.exemplo",
        actorUserId: "user-staff",
      }
    );

    const createdCodes: string[] =
      db.charterClause.createMany.mock.calls[0][0].data.map(
        (c: { code: string }) => c.code
      );

    const { maxClass } = deriveVendorMaxClass({
      tier: "APPROVED",
      dpa: true,
      clauseCodes: createdCodes,
    });

    expect(maxClass).not.toBe("PUBLIC");
    expect(maxClass).toBe("RESTRICTED");
  });

  it("sem as cláusulas do bootstrap (estado de hoje sem esta feature), o mesmo fornecedor trava em PUBLIC", () => {
    const { maxClass } = deriveVendorMaxClass({
      tier: "APPROVED",
      dpa: true,
      clauseCodes: [],
    });

    expect(maxClass).toBe("PUBLIC");
  });
});
