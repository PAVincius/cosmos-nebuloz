import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  riskUpdateMany: vi.fn(),
  riskCreate: vi.fn(),
  piPlanFindFirst: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    risk: {
      updateMany: mocks.riskUpdateMany,
      create: mocks.riskCreate,
    },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
  },
}));

import {
  createRoamRisk,
  roamTransitionRisk,
} from "../../../app/actions/risks/roam-transition";

describe("roamTransitionRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.riskUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("transitions to OWNED with ownerId sets ownedAt", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "OWNED",
      ownerId: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(mocks.riskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roamStatus: "OWNED",
          ownerId: "user-1",
          ownedAt: expect.any(Date),
        }),
      })
    );
  });

  it("OWNED guard fails without ownerId", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "OWNED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ownerRequired");
  });

  it("MITIGATED guard requires mitigationPlan >= 30 chars", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "MITIGATED",
      mitigationPlan: "too short",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("mitigationPlanRequired");
  });

  it("MITIGATED succeeds with long mitigation plan", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "MITIGATED",
      mitigationPlan:
        "We will move the release date to avoid the dependency conflict with team Alpha sprint 3.",
    });

    expect(result.ok).toBe(true);
  });

  it("RESOLVED guard fails without resolutionNote", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "RESOLVED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("resolutionNoteRequired");
  });

  it("RESOLVED succeeds with resolutionNote, sets resolvedAt", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "RESOLVED",
      resolutionNote: "Risk resolved by removing the dependency.",
    });

    expect(result.ok).toBe(true);
    expect(mocks.riskUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resolvedAt: expect.any(Date),
        }),
      })
    );
  });

  it("ACCEPTED requires no guard fields", async () => {
    const result = await roamTransitionRisk({
      riskId: "risk-1",
      roamStatus: "ACCEPTED",
    });

    expect(result.ok).toBe(true);
  });

  it("returns RISK_NOT_FOUND when updateMany count=0", async () => {
    mocks.riskUpdateMany.mockResolvedValue({ count: 0 });

    const result = await roamTransitionRisk({
      riskId: "nonexistent",
      roamStatus: "ACCEPTED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("RISK_NOT_FOUND");
  });
});

describe("createRoamRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.piPlanFindFirst.mockResolvedValue({ id: "pi-1" });
    mocks.riskCreate.mockResolvedValue({ id: "risk-new" });
  });

  it("creates risk with UNCLASSIFIED roamStatus", async () => {
    const result = await createRoamRisk({
      piPlanId: "pi-1",
      title: "Dependency risk with Team Beta",
      description:
        "Team Beta will not complete the API contract before sprint 3 starts.",
      category: "DEPENDENCY",
      severity: 3,
    });

    expect(result.ok).toBe(true);
    expect(mocks.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roamStatus: "UNCLASSIFIED",
          status: "IDENTIFIED",
          source: "MANUAL",
        }),
      })
    );
  });

  it("creates AI_SUGGESTED risk with confidence score", async () => {
    const result = await createRoamRisk({
      piPlanId: "pi-1",
      title: "AI-surfaced capacity risk",
      description:
        "Team velocity dropped 30% last sprint based on standup blockers.",
      category: "CAPACITY",
      severity: 4,
      source: "AI_SUGGESTED",
      aiConfidence: 0.82,
      aiJustification: "High similarity to previous capacity-related blockers",
    });

    expect(result.ok).toBe(true);
    expect(mocks.riskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "AI_SUGGESTED",
          aiConfidence: 0.82,
        }),
      })
    );
  });

  it("fails when piPlan not found", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    const result = await createRoamRisk({
      piPlanId: "nonexistent",
      title: "Risk",
      description: "A risk description that is long enough to pass validation.",
      category: "TECHNICAL",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("PI_PLAN_NOT_FOUND");
  });
});
