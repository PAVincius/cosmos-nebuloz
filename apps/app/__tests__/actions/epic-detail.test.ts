import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
  governedFindFirstMock: vi.fn(),
  artFindFirstMock: vi.fn(),
  requireTenantSessionMock: vi.fn(async () => ({
    tenantId: "tenant-1",
    userId: "user-1",
  })),
}));

vi.mock("@repo/database", () => ({
  database: {
    epic: { findFirst: h.findFirstMock },
    pIObjective: { findMany: h.findManyMock },
    governedEpic: { findFirst: h.governedFindFirstMock },
    aRT: { findFirst: h.artFindFirstMock },
  },
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: h.requireTenantSessionMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { getEpicDetailFull } from "../../app/(cosmos)/actions/epic-detail";

describe("getEpicDetailFull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes epic, PI objectives, and governance lookups to the tenant", async () => {
    h.findFirstMock.mockResolvedValue({
      id: "epic-1",
      title: "Epic 1",
      lifecycleStatus: "IMPLEMENTING",
      wsjf: 12.5,
      sizePoints: 8,
      investScore: 70,
      hypothesis: "We believe...",
      hypothesisResolution: null,
      businessOutcomes: [],
      leadingIndicators: [],
      nfrs: null,
      mvp: null,
      sizeEstimate: "M",
      descriptionVersions: [],
      leanBudgetAllocation: 50_000,
      artId: "art-1",
      ownerName: "Alice",
      strategicTheme: { id: "theme-1", title: "Modernização", color: "#fff" },
      investBreakdown: {
        breakdown: { I: 80, N: 70, V: 90, E: 60, S: 50, T: 85 },
        rationale: { I: "", N: "", V: "", E: "", S: "", T: "" },
        compositeScore: 72.5,
        isSmall: false,
      },
      features: [
        {
          id: "f1",
          title: "Feature 1",
          statusId: "IN_PROGRESS",
          wsjfScore: 9,
          progressPct: 40,
          storyPoints: 13,
          piPlanId: "pi-1",
        },
      ],
    });
    h.findManyMock.mockResolvedValue([
      {
        id: "obj-1",
        title: "Objective 1",
        status: "IN_PROGRESS",
        businessValue: 8,
        achievedValue: 3,
      },
    ]);
    h.governedFindFirstMock.mockResolvedValue({
      id: "ge-1",
      governanceStatus: "review",
      currentApprovalRequestId: "req-1",
    });
    h.artFindFirstMock.mockResolvedValue({ id: "art-1", name: "ART Alpha" });

    const result = await getEpicDetailFull("epic-1");

    expect(result.ok).toBe(true);
    expect(h.findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "epic-1", tenantId: "tenant-1" },
      })
    );
    expect(h.findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", piPlanId: { in: ["pi-1"] } },
      })
    );
    expect(h.governedFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { epicId: "epic-1", tenantId: "tenant-1" },
      })
    );
    expect(h.artFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-1", tenantId: "tenant-1" },
      })
    );
    if (result.ok && result.data) {
      expect(result.data.piObjectives).toHaveLength(1);
      expect(result.data.governance.governanceStatus).toBe("review");
      expect(result.data.features[0]).not.toHaveProperty("piPlanId");
      expect(result.data.art).toEqual({ id: "art-1", name: "ART Alpha" });
      expect(result.data.theme).toEqual({
        id: "theme-1",
        title: "Modernização",
        color: "#fff",
      });
      expect(result.data.owner).toBe("Alice");
      expect(result.data.investBreakdown).toEqual({
        I: 80,
        N: 70,
        V: 90,
        E: 60,
        S: 50,
        T: 85,
      });
    }
  });

  it("returns null when the epic does not exist for this tenant", async () => {
    h.findFirstMock.mockResolvedValue(null);
    const result = await getEpicDetailFull("missing");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  const baseEpic = {
    id: "epic-1",
    title: "Epic 1",
    lifecycleStatus: "IMPLEMENTING",
    wsjf: 12.5,
    sizePoints: 8,
    investScore: 70,
    hypothesis: null,
    hypothesisResolution: null,
    businessOutcomes: [],
    leadingIndicators: [],
    nfrs: null,
    mvp: null,
    sizeEstimate: "M",
    leanBudgetAllocation: null,
    artId: null,
    ownerName: null,
    strategicTheme: null,
    investBreakdown: null,
    features: [],
  };

  it("never fabricates art/theme/owner/investBreakdown when nothing is stored — all null, no ART lookup", async () => {
    h.findFirstMock.mockResolvedValue(baseEpic);
    h.findManyMock.mockResolvedValue([]);
    h.governedFindFirstMock.mockResolvedValue(null);

    const result = await getEpicDetailFull("epic-1");

    expect(result.ok).toBe(true);
    expect(h.artFindFirstMock).not.toHaveBeenCalled();
    if (result.ok && result.data) {
      expect(result.data.art).toBeNull();
      expect(result.data.theme).toBeNull();
      expect(result.data.owner).toBeNull();
      expect(result.data.investBreakdown).toBeNull();
    }
  });

  it("never surfaces an ART row from another tenant — a tenant-scoped miss yields art: null, not a cross-tenant row", async () => {
    h.findFirstMock.mockResolvedValue({ ...baseEpic, artId: "art-other" });
    h.findManyMock.mockResolvedValue([]);
    h.governedFindFirstMock.mockResolvedValue(null);
    // Prisma's tenant-scoped findFirst simply returns null for a row that
    // belongs to a different tenant (IDOR guard) — never a leaked row.
    h.artFindFirstMock.mockResolvedValue(null);

    const result = await getEpicDetailFull("epic-1");

    expect(result.ok).toBe(true);
    expect(h.artFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-other", tenantId: "tenant-1" },
      })
    );
    if (result.ok && result.data) {
      expect(result.data.art).toBeNull();
    }
  });

  it("parses the analyze-invest API route's { I: {score}, N: {score}, ... } investBreakdown shape", async () => {
    h.findFirstMock.mockResolvedValue({
      ...baseEpic,
      investBreakdown: {
        I: { score: 65, feedback: "", suggestion: "" },
        N: { score: 55, feedback: "", suggestion: "" },
        V: { score: 75, feedback: "", suggestion: "" },
        E: { score: 45, feedback: "", suggestion: "" },
        S: { score: 60, feedback: "", suggestion: "" },
        T: { score: 80, feedback: "", suggestion: "" },
        composite: 63.3,
      },
    });
    h.findManyMock.mockResolvedValue([]);
    h.governedFindFirstMock.mockResolvedValue(null);

    const result = await getEpicDetailFull("epic-1");

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.investBreakdown).toEqual({
        I: 65,
        N: 55,
        V: 75,
        E: 45,
        S: 60,
        T: 80,
      });
    }
  });

  it("renders the aggregate-only honestly (null breakdown) for an unrecognized investBreakdown shape — never a guessed decomposition", async () => {
    h.findFirstMock.mockResolvedValue({
      ...baseEpic,
      investScore: 70,
      investBreakdown: { somethingElse: true },
    });
    h.findManyMock.mockResolvedValue([]);
    h.governedFindFirstMock.mockResolvedValue(null);

    const result = await getEpicDetailFull("epic-1");

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.investScore).toBe(70);
      expect(result.data.investBreakdown).toBeNull();
    }
  });
});
