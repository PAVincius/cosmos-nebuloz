import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../helpers/action-mocks";

const h = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  requireRole: vi.fn(),
  revalidateTag: vi.fn(),
  riskFindMany: vi.fn(),
  riskFindFirst: vi.fn(),
  riskCreate: vi.fn(),
  riskUpdate: vi.fn(),
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
      findFirst: h.riskFindFirst,
      create: h.riskCreate,
      update: h.riskUpdate,
    },
    user: {
      findMany: h.userFindMany,
    },
  },
}));
vi.mock("../../app/actions/audit/log-audit", () => ({ logAudit: h.logAudit }));

import { database } from "@repo/database";
import {
  createRisk,
  listRisks,
  roamTransition,
} from "../../app/(cosmos)/actions/risks";

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

  // story-059 AC-004 — o vocabulário estende low/medium/high com as duas pontas
  // que faltavam; nenhum valor anterior deixa de ser aceito.
  it("accepts the two new ends of the five-level scale (AC-004)", async () => {
    h.riskCreate.mockResolvedValue({ id: "new-risk-3" });

    const res = await createRisk({
      title: "Fornecedor único de KYC",
      probability: "very_low",
      impact: "very_high",
    });

    expect(res.ok).toBe(true);
    expect(h.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          probability: "very_low",
          impact: "very_high",
        }),
      })
    );
  });
});

// story-059 AC-001/AC-002/AC-003 — sem transição o risco nasce UNCLASSIFIED e
// congela, e o gate de commitment da story-019 AC-003 nunca pode ser satisfeito
// pela tela que registra o risco.
describe("roamTransition", () => {
  const owned = {
    riskId: "r1",
    roamStatus: "OWNED" as const,
    ownerUserId: "u1",
  };

  beforeEach(() => {
    h.riskFindFirst.mockResolvedValue({ id: "r1", roamStatus: "UNCLASSIFIED" });
    h.riskUpdate.mockResolvedValue({ id: "r1" });
  });

  it("is denied when the role is not permitted (RBAC) — AC-002", async () => {
    h.requireRole.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "nope");
    });

    const res = await roamTransition(owned);

    expect(res.ok).toBe(false);
    expect(h.requireRole).toHaveBeenCalledWith(["ADMIN", "RTE"], tenantCtx);
    expect(h.riskUpdate).not.toHaveBeenCalled();
  });

  it("rejects a risk that is not owned by the tenant (IDOR guard) — AC-002", async () => {
    h.riskFindFirst.mockResolvedValue(null);

    const res = await roamTransition(owned);

    expect(res.ok).toBe(false);
    expect(h.riskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1", tenantId: tenantCtx.tenantId },
      })
    );
    expect(h.riskUpdate).not.toHaveBeenCalled();
  });

  it("refuses OWNED without an owner — AC-001", async () => {
    const res = await roamTransition({ riskId: "r1", roamStatus: "OWNED" });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("ownerRequired");
    }
    expect(h.riskUpdate).not.toHaveBeenCalled();
  });

  it("stamps ownedAt and the owner on OWNED — AC-001", async () => {
    const res = await roamTransition(owned);

    expect(res.ok).toBe(true);
    expect(h.riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({
          roamStatus: "OWNED",
          ownerUserId: "u1",
          ownedAt: expect.any(Date),
        }),
      })
    );
  });

  it("refuses MITIGATED with a plan shorter than 30 chars — AC-001", async () => {
    const res = await roamTransition({
      riskId: "r1",
      roamStatus: "MITIGATED",
      mitigationPlan: "plano curto",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("mitigationPlanRequired");
    }
    expect(h.riskUpdate).not.toHaveBeenCalled();
  });

  it("accepts MITIGATED with a plan of at least 30 chars — AC-001", async () => {
    const res = await roamTransition({
      riskId: "r1",
      roamStatus: "MITIGATED",
      mitigationPlan:
        "Antecipar o contrato do provedor secundário para a sprint 15.",
    });

    expect(res.ok).toBe(true);
    expect(h.riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roamStatus: "MITIGATED" }),
      })
    );
  });

  it("refuses RESOLVED without a resolution note — AC-001", async () => {
    const res = await roamTransition({ riskId: "r1", roamStatus: "RESOLVED" });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("resolutionNoteRequired");
    }
    expect(h.riskUpdate).not.toHaveBeenCalled();
  });

  it("stamps resolvedAt on RESOLVED with a note — AC-001", async () => {
    const res = await roamTransition({
      riskId: "r1",
      roamStatus: "RESOLVED",
      resolutionNote: "Provedor secundário homologado.",
    });

    expect(res.ok).toBe(true);
    expect(h.riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
      })
    );
  });

  it("takes ACCEPTED with no extra field — AC-001", async () => {
    const res = await roamTransition({ riskId: "r1", roamStatus: "ACCEPTED" });

    expect(res.ok).toBe(true);
    expect(h.riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roamStatus: "ACCEPTED" }),
      })
    );
  });

  it("refuses UNCLASSIFIED as a destination — AC-003", async () => {
    const res = await roamTransition({
      riskId: "r1",
      roamStatus: "UNCLASSIFIED" as unknown as "ACCEPTED",
    });

    expect(res.ok).toBe(false);
    expect(h.riskUpdate).not.toHaveBeenCalled();
  });

  it("audits the previous roamStatus and revalidates — AC-002", async () => {
    h.riskFindFirst.mockResolvedValue({ id: "r1", roamStatus: "OWNED" });

    const res = await roamTransition({
      riskId: "r1",
      roamStatus: "ACCEPTED",
    });

    expect(res.ok).toBe(true);
    expect(h.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "status_changed",
        entityType: "risk",
        entityId: "r1",
        diff: expect.objectContaining({ roamStatus: "OWNED→ACCEPTED" }),
      })
    );
    expect(h.revalidateTag).toHaveBeenCalled();
  });

  // Risk.status é a coluna legada que outros leitores (arts/pi-plans, exports)
  // ainda consultam. Não escrevê-la deixaria duas verdades sobre o mesmo risco.
  it("keeps the legacy Risk.status column in sync — AC-002", async () => {
    const res = await roamTransition({ riskId: "r1", roamStatus: "ACCEPTED" });

    expect(res.ok).toBe(true);
    expect(h.riskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
  });
});
