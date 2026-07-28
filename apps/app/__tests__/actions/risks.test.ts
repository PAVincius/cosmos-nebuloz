import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  riskFindMany: vi.fn(),
  riskCreate: vi.fn(),
  userFindMany: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: h.headers }));
vi.mock("next/cache", () => ({ revalidateTag: h.revalidateTag }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSession,
  requireRole: h.requireRole,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    risk: {
      findMany: h.riskFindMany,
      create: h.riskCreate,
    },
    user: {
      findMany: h.userFindMany,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import { createRisk, listRisks } from "../../app/(cosmos)/actions/risks";

beforeEach(() => {
  vi.clearAllMocks();
  h.headers.mockResolvedValue(new Headers());
  h.requireTenantSession.mockResolvedValue(tenantCtx);
  h.requireRole.mockReturnValue(undefined);
});

describe("listRisks", () => {
  it("returns tenant-scoped risks ordered by severity desc", async () => {
    h.riskFindMany.mockResolvedValue([
      {
        id: "r1",
        title: "Latência antifraude",
        roamStatus: "OWNED",
        severity: 4,
        probability: "high",
        impact: "high",
        category: "TECHNICAL",
        ownerUserId: null,
      },
    ]);
    h.userFindMany.mockResolvedValue([]);

    const r = await listRisks();
    expect(r.ok).toBe(true);
    expect(database.risk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    if (r.ok) {
      expect(r.data[0].title).toBe("Latência antifraude");
    }
  });

  it("resolves the owner's display name from ownerUserId", async () => {
    h.riskFindMany.mockResolvedValue([
      {
        id: "r1",
        title: "Latência antifraude",
        roamStatus: "OWNED",
        severity: 4,
        probability: "high",
        impact: "high",
        category: "TECHNICAL",
        ownerUserId: "u1",
      },
    ]);
    h.userFindMany.mockResolvedValue([{ id: "u1", name: "Marina Alves" }]);

    const r = await listRisks();
    expect(r.ok).toBe(true);
    expect(database.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["u1"] } } })
    );
    if (r.ok) {
      expect(r.data[0].ownerName).toBe("Marina Alves");
    }
  });

  it("degrades to em dash when ownerUserId is unset", async () => {
    h.riskFindMany.mockResolvedValue([
      {
        id: "r2",
        title: "Sem dono",
        roamStatus: "UNCLASSIFIED",
        severity: 2,
        probability: "low",
        impact: "low",
        category: "TECHNICAL",
        ownerUserId: null,
      },
    ]);
    h.userFindMany.mockResolvedValue([]);

    const r = await listRisks();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0].ownerName).toBe("—");
    }
  });
});

describe("createRisk", () => {
  const validInput = {
    title: "Instabilidade no gateway de pagamento",
    description: "Provedor externo com histórico de outages.",
    category: "TECHNICAL" as const,
    severity: 4,
    probability: "high" as const,
    impact: "high" as const,
  };

  it("is denied when the role is not permitted (RBAC)", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await createRisk(validInput);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(
      ["ADMIN", "RTE", "PO", "SM"],
      tenantCtx
    );
    expect(h.riskCreate).not.toHaveBeenCalled();
  });

  it("creates, audits, and revalidates on success", async () => {
    h.riskCreate.mockResolvedValue({ id: "new-risk" });

    const res = await createRisk(validInput);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("new-risk");
    }
    expect(h.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: validInput.title,
          description: validInput.description,
          category: "TECHNICAL",
          severity: 4,
          probability: "high",
          impact: "high",
        }),
      })
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "risk",
        entityId: "new-risk",
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  it("defaults severity/probability/impact when omitted", async () => {
    h.riskCreate.mockResolvedValue({ id: "new-risk-2" });

    await createRisk({ title: "Risco simples" });

    expect(h.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: 3,
          probability: "medium",
          impact: "medium",
          category: null,
        }),
      })
    );
  });
});
