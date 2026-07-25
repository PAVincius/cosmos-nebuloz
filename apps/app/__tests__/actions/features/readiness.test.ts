import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  featureFindFirstOrThrow: vi.fn(),
  featureFindFirst: vi.fn(),
  featureUpdateMany: vi.fn(),
  depLinkCount: vi.fn(),
  riskCount: vi.fn(),
  epicFindFirst: vi.fn(),
  artFindFirst: vi.fn(),
  artSequenceCounterUpsert: vi.fn(),
  decisionLogCreate: vi.fn(),
  featureCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    feature: {
      findFirstOrThrow: mocks.featureFindFirstOrThrow,
      findFirst: mocks.featureFindFirst,
      updateMany: mocks.featureUpdateMany,
      create: mocks.featureCreate,
    },
    dependencyLink: { count: mocks.depLinkCount },
    risk: { count: mocks.riskCount },
    epic: { findFirst: mocks.epicFindFirst },
    aRT: { findFirst: mocks.artFindFirst },
    artSequenceCounter: { upsert: mocks.artSequenceCounterUpsert },
    decisionLogEntry: { create: mocks.decisionLogCreate },
    $transaction: mocks.transaction,
  },
}));

import {
  createARTFeature,
  evaluateFeatureReadiness,
  markFeatureReady,
  overrideFeatureReadiness,
} from "../../../app/actions/features/readiness";

const ART_SCOPED_ID_REGEX = /^F-\d{3}$/;

const fullyReadyFeature = {
  wsjfScore: 8.5,
  wsjfConfidence: "HIGH",
  acceptanceCriteria: ["AC1", "AC2", "AC3"],
  epicId: "epic-1",
  assignedTeamId: "team-1",
  piPlanId: "pi-1",
};

describe("evaluateFeatureReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.featureFindFirstOrThrow.mockResolvedValue(fullyReadyFeature);
    mocks.depLinkCount.mockResolvedValue(0);
    mocks.riskCount.mockResolvedValue(0);
  });

  it("returns pass=true when all criteria met", async () => {
    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.pass).toBe(true);
    expect(result.data.failures).toHaveLength(0);
  });

  it("fails wsjf criterion when score is null", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...fullyReadyFeature,
      wsjfScore: null,
    });

    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.pass).toBe(false);
    const wsjfCriterion = result.data.criteria.find((c) => c.key === "wsjf");
    expect(wsjfCriterion?.pass).toBe(false);
  });

  it("fails wsjf criterion when confidence is LOW", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...fullyReadyFeature,
      wsjfConfidence: "LOW",
    });

    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    if (!result.ok) {
      return;
    }
    const wsjfCriterion = result.data.criteria.find((c) => c.key === "wsjf");
    expect(wsjfCriterion?.pass).toBe(false);
  });

  it("fails ac criterion when fewer than 3 ACs", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...fullyReadyFeature,
      acceptanceCriteria: ["AC1", "AC2"],
    });

    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    if (!result.ok) {
      return;
    }
    const acCriterion = result.data.criteria.find((c) => c.key === "ac");
    expect(acCriterion?.pass).toBe(false);
    expect(acCriterion?.hint).toContain("3 acceptance criteria");
  });

  it("fails team criterion when assignedTeamId is null (AC-003)", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...fullyReadyFeature,
      assignedTeamId: null,
    });

    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    if (!result.ok) {
      return;
    }
    const teamCriterion = result.data.criteria.find((c) => c.key === "team");
    expect(teamCriterion?.pass).toBe(false);
    expect(result.data.failures).toHaveLength(1);
    expect(result.data.failures[0].key).toBe("team");
  });

  it("fails deps criterion when open blocking deps exist", async () => {
    mocks.depLinkCount.mockResolvedValue(2);

    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    if (!result.ok) {
      return;
    }
    const depsCriterion = result.data.criteria.find((c) => c.key === "deps");
    expect(depsCriterion?.pass).toBe(false);
  });

  it("fails risks criterion when high-severity unclassified risk exists", async () => {
    mocks.riskCount.mockResolvedValue(1);

    const result = await evaluateFeatureReadiness({ featureId: "feat-1" });

    if (!result.ok) {
      return;
    }
    const risksCriterion = result.data.criteria.find((c) => c.key === "risks");
    expect(risksCriterion?.pass).toBe(false);
  });
});

describe("markFeatureReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.featureFindFirstOrThrow.mockResolvedValue(fullyReadyFeature);
    mocks.depLinkCount.mockResolvedValue(0);
    mocks.riskCount.mockResolvedValue(0);
    mocks.featureUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("sets status=READY when all criteria pass", async () => {
    const result = await markFeatureReady({ featureId: "feat-1" });

    expect(result.ok).toBe(true);
    expect(mocks.featureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { statusId: "READY" },
      })
    );
  });

  it("throws READINESS_GATE_FAILED when criteria fail", async () => {
    mocks.featureFindFirstOrThrow.mockResolvedValue({
      ...fullyReadyFeature,
      wsjfScore: null,
      assignedTeamId: null,
    });

    const result = await markFeatureReady({ featureId: "feat-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("READINESS_GATE_FAILED");
    expect(mocks.featureUpdateMany).not.toHaveBeenCalled();
  });
});

describe("overrideFeatureReadiness (AC-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.transaction.mockImplementation(
      (
        fn: (tx: {
          feature: { updateMany: typeof vi.fn };
          decisionLogEntry: { create: typeof vi.fn };
        }) => unknown
      ) => {
        if (typeof fn === "function") {
          return fn({
            feature: { updateMany: mocks.featureUpdateMany },
            decisionLogEntry: { create: mocks.decisionLogCreate },
          });
        }
        return Promise.all(fn as Promise<unknown>[]);
      }
    );
    mocks.featureUpdateMany.mockResolvedValue({ count: 1 });
    mocks.decisionLogCreate.mockResolvedValue({ id: "log-1" });
  });

  it("RTE can override readiness + creates DecisionLogEntry", async () => {
    const result = await overrideFeatureReadiness({
      featureId: "feat-1",
      justification:
        "Team assignment pending stakeholder approval; shipping unblocks 3 dependent teams",
    });

    expect(result.ok).toBe(true);
    expect(mocks.featureUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readinessOverridden: true,
          statusId: "READY",
        }),
      })
    );
    expect(mocks.decisionLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: "READINESS_OVERRIDE",
          targetType: "feature",
          targetId: "feat-1",
          decisao: "override",
        }),
      })
    );
  });

  it("FORBIDDEN for non-RTE/ADMIN", async () => {
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });

    const result = await overrideFeatureReadiness({
      featureId: "feat-1",
      justification: "short",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("FORBIDDEN");
  });

  it("rejects justification shorter than 20 chars", async () => {
    const result = await overrideFeatureReadiness({
      featureId: "feat-1",
      justification: "too short",
    });

    expect(result.ok).toBe(false);
  });
});

describe("createARTFeature (AC-001 + AC-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "PO" });
    mocks.epicFindFirst.mockResolvedValue({ id: "epic-1" });
    mocks.artFindFirst.mockResolvedValue({ id: "art-1" });
    mocks.artSequenceCounterUpsert.mockResolvedValue({ next: 42 });
    mocks.featureCreate.mockResolvedValue({
      id: "feat-new",
      artScopedId: "F-041",
    });
    mocks.transaction.mockImplementation(
      (
        fn: (tx: {
          artSequenceCounter: { upsert: typeof vi.fn };
          feature: { create: typeof vi.fn };
        }) => unknown
      ) => {
        if (typeof fn === "function") {
          return fn({
            artSequenceCounter: { upsert: mocks.artSequenceCounterUpsert },
            feature: { create: mocks.featureCreate },
          });
        }
        return Promise.all(fn as Promise<unknown>[]);
      }
    );
  });

  it("creates feature with ART-scoped ID (AC-001)", async () => {
    const result = await createARTFeature({
      artId: "art-1",
      epicId: "epic-1",
      title: "Automated risk detection",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.artScopedId).toMatch(ART_SCOPED_ID_REGEX);
    expect(mocks.artSequenceCounterUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { next: { increment: 1 } },
      })
    );
  });

  it("rejects feature without epicId (AC-002)", async () => {
    mocks.epicFindFirst.mockResolvedValue(null);

    const result = await createARTFeature({
      artId: "art-1",
      epicId: "nonexistent",
      title: "Orphan feature",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("EPIC_LINK_REQUIRED");
  });
});
