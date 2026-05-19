import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  riskFindFirst: vi.fn(),
  riskUpdate: vi.fn(),
  riskCreate: vi.fn(),
  pIPlanFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    risk: {
      findFirst: mocks.riskFindFirst,
      update: mocks.riskUpdate,
      create: mocks.riskCreate,
    },
    pIPlan: { findFirst: mocks.pIPlanFindFirst },
  },
}));

import { createRisk, updateRiskStatus } from "../../app/actions/arts/risks";

const NOT_FOUND_RX = NOT_FOUND_RX;
const ART_ID = "art-1";
const PI_ID = "pi-1";
const RISK_ID = "risk-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.requireTenantSession.mockResolvedValue(tenantCtx);
  mocks.revalidatePath.mockReturnValue(undefined);
});

describe("updateRiskStatus", () => {
  it("updates risk status and revalidates path", async () => {
    mocks.riskFindFirst.mockResolvedValue({
      id: RISK_ID,
      piPlan: { art: { id: ART_ID } },
    });
    mocks.riskUpdate.mockResolvedValue({ id: RISK_ID, status: "resolved" });

    const result = await updateRiskStatus(RISK_ID, "resolved");

    expect(mocks.riskUpdate).toHaveBeenCalledWith({
      where: { id: RISK_ID },
      data: { status: "resolved" },
    });
    expect(result).toMatchObject({ status: "resolved" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      expect.stringContaining(ART_ID)
    );
  });

  it("throws when risk not found in tenant", async () => {
    mocks.riskFindFirst.mockResolvedValue(null);
    await expect(updateRiskStatus("missing", "owned")).rejects.toThrow(
      NOT_FOUND_RX
    );
  });
});

describe("createRisk", () => {
  it("creates risk with tenant scope and revalidates", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue({
      id: PI_ID,
      art: { id: ART_ID },
    });
    mocks.riskCreate.mockResolvedValue({ id: RISK_ID, title: "Risco X" });

    const result = await createRisk({
      piPlanId: PI_ID,
      title: "Risco X",
      impact: "high",
      probability: "medium",
    });

    expect(mocks.riskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tenantCtx.tenantId,
        piPlanId: PI_ID,
        title: "Risco X",
        status: "owned",
      }),
    });
    expect(result).toMatchObject({ id: RISK_ID });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      expect.stringContaining(ART_ID)
    );
  });

  it("throws when PI plan not found in tenant", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue(null);
    await expect(
      createRisk({
        piPlanId: "missing",
        title: "T",
        impact: "low",
        probability: "low",
      })
    ).rejects.toThrow(NOT_FOUND_RX);
  });

  it("uses provided status over default", async () => {
    mocks.pIPlanFindFirst.mockResolvedValue({ id: PI_ID, art: { id: ART_ID } });
    mocks.riskCreate.mockResolvedValue({ id: RISK_ID });

    await createRisk({
      piPlanId: PI_ID,
      title: "T",
      impact: "low",
      probability: "low",
      status: "mitigated",
    });

    expect(mocks.riskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "mitigated" }),
    });
  });
});
