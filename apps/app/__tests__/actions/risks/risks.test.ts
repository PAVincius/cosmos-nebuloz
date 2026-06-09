import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  enforce: vi.fn(),
  dispatchEvent: vi.fn(),
  logAudit: vi.fn(),
  riskFindMany: vi.fn(),
  riskFindFirst: vi.fn(),
  riskCreate: vi.fn(),
  riskUpdateMany: vi.fn(),
  riskDeleteMany: vi.fn(),
  piPlanFindFirst: vi.fn(),
  piPlanFindMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    risk: {
      findMany: mocks.riskFindMany,
      findFirst: mocks.riskFindFirst,
      create: mocks.riskCreate,
      updateMany: mocks.riskUpdateMany,
      deleteMany: mocks.riskDeleteMany,
    },
    pIPlan: {
      findFirst: mocks.piPlanFindFirst,
      findMany: mocks.piPlanFindMany,
    },
  },
}));
vi.mock("../../../app/actions/permissions", () => ({ enforce: mocks.enforce }));
vi.mock("../../../app/actions/events", () => ({
  dispatchEvent: mocks.dispatchEvent,
}));
vi.mock("../../../app/actions/audit/index", () => ({
  logAudit: mocks.logAudit,
}));

import {
  createRisk,
  deleteRisk,
  getPIPlans,
  getRisks,
  updateRisk,
  updateRiskStatus,
} from "../../../app/actions/risks/index";

const RISK_ID = "risk-abc";
const PI_PLAN_ID = "pi-xyz";

const sampleRisk = {
  id: RISK_ID,
  title: "Deploy regression",
  status: "IDENTIFIED",
  impact: "high",
  probability: "medium",
  tenantId: tenantCtx.tenantId,
  piPlan: { id: PI_PLAN_ID, name: "PI 1" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.enforce.mockReturnValue(undefined);
  mocks.dispatchEvent.mockResolvedValue(undefined);
  mocks.logAudit.mockReturnValue(undefined);
});

// ─── getRisks ────────────────────────────────────────────────────────────────

describe("getRisks", () => {
  it("returns risks scoped to tenant without piPlanId filter", async () => {
    mocks.riskFindMany.mockResolvedValue([sampleRisk]);

    const result = await getRisks();

    expect(mocks.riskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
      })
    );
    expect(result).toEqual([sampleRisk]);
  });

  it("passes piPlanId filter when provided", async () => {
    mocks.riskFindMany.mockResolvedValue([sampleRisk]);

    await getRisks(PI_PLAN_ID);

    expect(mocks.riskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId, piPlanId: PI_PLAN_ID },
      })
    );
  });

  it("returns empty array when tenant has no risks", async () => {
    mocks.riskFindMany.mockResolvedValue([]);

    const result = await getRisks();

    expect(result).toEqual([]);
  });
});

// ─── createRisk ──────────────────────────────────────────────────────────────

describe("createRisk", () => {
  const validRaw = {
    title: "Deploy regression",
    impact: "high",
    probability: "medium",
    status: "IDENTIFIED",
  };

  it("creates risk with valid data and dispatches event", async () => {
    mocks.riskCreate.mockResolvedValue({
      id: RISK_ID,
      title: "Deploy regression",
      impact: "high",
    });

    await createRisk(validRaw);

    expect(mocks.enforce).toHaveBeenCalledWith(
      tenantCtx.role,
      "Risk",
      "create"
    );
    expect(mocks.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenantCtx.tenantId,
          title: "Deploy regression",
          impact: "high",
        }),
      })
    );
    expect(mocks.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "risk.created", riskId: RISK_ID })
    );
    expect(mocks.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "created",
        entityType: "Risk",
        entityId: RISK_ID,
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/risks");
  });

  it("throws when enforce denies permission", async () => {
    mocks.enforce.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Not allowed");
    });

    await expect(createRisk(validRaw)).rejects.toThrow("Not allowed");
    expect(mocks.riskCreate).not.toHaveBeenCalled();
  });

  it("throws when piPlanId provided but PI not found in tenant", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    await expect(
      createRisk({ ...validRaw, piPlanId: "missing-pi" })
    ).rejects.toThrow(/PI Plan não encontrado/);

    expect(mocks.riskCreate).not.toHaveBeenCalled();
  });

  it("creates risk with piPlanId when PI exists", async () => {
    mocks.piPlanFindFirst.mockResolvedValue({ id: PI_PLAN_ID, name: "PI 1" });
    mocks.riskCreate.mockResolvedValue({
      id: RISK_ID,
      title: "T",
      impact: "low",
    });

    await createRisk({ ...validRaw, piPlanId: PI_PLAN_ID });

    expect(mocks.piPlanFindFirst).toHaveBeenCalledWith({
      where: { id: PI_PLAN_ID, tenantId: tenantCtx.tenantId },
    });
    expect(mocks.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ piPlanId: PI_PLAN_ID }),
      })
    );
  });
});

// ─── updateRiskStatus ────────────────────────────────────────────────────────

describe("updateRiskStatus", () => {
  it("updates status and dispatches event", async () => {
    mocks.riskFindFirst.mockResolvedValue({
      title: "Deploy regression",
      status: "IDENTIFIED",
      ownerUserId: "user-owner",
    });
    mocks.riskUpdateMany.mockResolvedValue({ count: 1 });

    await updateRiskStatus(RISK_ID, "RESOLVED");

    expect(mocks.enforce).toHaveBeenCalledWith(
      tenantCtx.role,
      "Risk",
      "update"
    );
    expect(mocks.riskUpdateMany).toHaveBeenCalledWith({
      where: { id: RISK_ID, tenantId: tenantCtx.tenantId },
      data: { status: "RESOLVED" },
    });
    expect(mocks.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "risk.status_changed",
        riskId: RISK_ID,
        from: "IDENTIFIED",
        to: "RESOLVED",
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/risks");
  });

  it("still updates and dispatches when existing risk not found (null guard)", async () => {
    mocks.riskFindFirst.mockResolvedValue(null);
    mocks.riskUpdateMany.mockResolvedValue({ count: 0 });

    await updateRiskStatus(RISK_ID, "ACCEPTED");

    expect(mocks.riskUpdateMany).toHaveBeenCalled();
    expect(mocks.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "risk.status_changed", riskTitle: "" })
    );
  });
});

// ─── updateRisk ──────────────────────────────────────────────────────────────

describe("updateRisk", () => {
  it("updates only provided fields (partial schema)", async () => {
    mocks.riskUpdateMany.mockResolvedValue({ count: 1 });

    await updateRisk(RISK_ID, { title: "New title", impact: "critical" });

    expect(mocks.enforce).toHaveBeenCalledWith(
      tenantCtx.role,
      "Risk",
      "update"
    );
    expect(mocks.riskUpdateMany).toHaveBeenCalledWith({
      where: { id: RISK_ID, tenantId: tenantCtx.tenantId },
      data: expect.objectContaining({ title: "New title", impact: "critical" }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/risks");
  });

  it("throws when enforce denies permission", async () => {
    mocks.enforce.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Not allowed");
    });

    await expect(updateRisk(RISK_ID, { title: "X" })).rejects.toThrow(
      "Not allowed"
    );
    expect(mocks.riskUpdateMany).not.toHaveBeenCalled();
  });
});

// ─── deleteRisk ──────────────────────────────────────────────────────────────

describe("deleteRisk", () => {
  it("deletes risk, calls logAudit, and revalidates path", async () => {
    mocks.riskDeleteMany.mockResolvedValue({ count: 1 });

    await deleteRisk(RISK_ID);

    expect(mocks.enforce).toHaveBeenCalledWith(
      tenantCtx.role,
      "Risk",
      "delete"
    );
    expect(mocks.riskDeleteMany).toHaveBeenCalledWith({
      where: { id: RISK_ID, tenantId: tenantCtx.tenantId },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      tenantCtx.tenantId,
      expect.objectContaining({
        action: "deleted",
        entityType: "Risk",
        entityId: RISK_ID,
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/risks");
  });

  it("throws when enforce denies permission", async () => {
    mocks.enforce.mockImplementation(() => {
      throw new MockAuthError("FORBIDDEN", "Not allowed");
    });

    await expect(deleteRisk(RISK_ID)).rejects.toThrow("Not allowed");
    expect(mocks.riskDeleteMany).not.toHaveBeenCalled();
  });
});

// ─── getPIPlans ──────────────────────────────────────────────────────────────

describe("getPIPlans", () => {
  it("returns PI plans scoped to tenant", async () => {
    const plans = [{ id: PI_PLAN_ID, name: "PI 1", artId: "art-1" }];
    mocks.piPlanFindMany.mockResolvedValue(plans);

    const result = await getPIPlans();

    expect(mocks.piPlanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: tenantCtx.tenantId },
        select: { id: true, name: true, artId: true },
      })
    );
    expect(result).toEqual(plans);
  });
});
