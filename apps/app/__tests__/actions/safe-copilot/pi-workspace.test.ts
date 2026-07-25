import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  artFindFirst: vi.fn(),
  piPlanFindFirst: vi.fn(),
  riskFindMany: vi.fn(),
  featureFindMany: vi.fn(),
  teamFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRT: { findFirst: mocks.artFindFirst },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    risk: { findMany: mocks.riskFindMany },
    feature: { findMany: mocks.featureFindMany },
    team: { findMany: mocks.teamFindMany },
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  buildPIWorkspaceContext,
  getPIWorkspaceSummary,
} from "../../../app/actions/safe-copilot/context/pi-workspace";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TID = "tenant-abc";
const ART_ID = "art-1";
const PI_ID = "pi-1";

const ART = { name: "Platform ART" };

const PI = {
  name: "PI 2026.1",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-03-31"),
  piObjectives: [
    {
      id: "obj-1",
      title: "Enable checkout v2",
      businessValue: 10,
      isStretch: false,
      status: "committed",
      teamId: "team-1",
    },
  ],
};

const RISKS = [
  {
    id: "risk-1",
    title: "Key dependency risk",
    status: "open",
    category: "dependency",
    impact: "high",
    probability: "medium",
  },
];

const FEATURES = [
  {
    id: "feat-1",
    title: "Checkout redesign",
    statusId: "in-progress",
    storyPoints: 8,
    wsjfScore: 12.5,
    blocks: [{ blockedFeatureId: "feat-2" }],
    blockedBy: [],
  },
  {
    id: "feat-2",
    title: "Payment gateway",
    statusId: "planned",
    storyPoints: 13,
    wsjfScore: 9.0,
    blocks: [],
    blockedBy: [{ blockingFeatureId: "feat-1" }],
  },
];

const TEAMS = [
  { id: "team-1", name: "Team Alpha", velocity: 40 },
  { id: "team-2", name: "Team Beta", velocity: 35 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupDefaults() {
  mocks.artFindFirst.mockResolvedValue(ART);
  mocks.piPlanFindFirst.mockResolvedValue(PI);
  mocks.riskFindMany.mockResolvedValue(RISKS);
  mocks.featureFindMany.mockResolvedValue(FEATURES);
  mocks.teamFindMany.mockResolvedValue(TEAMS);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildPIWorkspaceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("with artId + piId → fetches all data, returns full PIWorkspaceContext", async () => {
    const ctx = await buildPIWorkspaceContext(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    // ART looked up by specific id
    expect(mocks.artFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ART_ID, tenantId: TID }),
      })
    );

    // PI looked up by specific id
    expect(mocks.piPlanFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: PI_ID, tenantId: TID }),
      })
    );

    expect(ctx.artName).toBe("Platform ART");
    expect(ctx.piName).toBe("PI 2026.1");
    expect(ctx.piDates).toEqual({ start: "2026-01-01", end: "2026-03-31" });
    expect(ctx.objectives).toHaveLength(1);
    expect(ctx.objectives[0].title).toBe("Enable checkout v2");
    expect(ctx.risks).toHaveLength(1);
    expect(ctx.features).toHaveLength(2);
    expect(ctx.teams).toHaveLength(2);
  });

  it("without artId → falls back to most-recent ART lookup (no id filter)", async () => {
    const ctx = await buildPIWorkspaceContext(TID, { piId: PI_ID });

    // Should NOT include id in the where clause
    expect(mocks.artFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ id: expect.anything() }),
        orderBy: { createdAt: "desc" },
      })
    );

    // artName still resolves from the mock
    expect(ctx.artName).toBe("Platform ART");
  });

  it("without artId and ART returns null → artName is fallback string", async () => {
    mocks.artFindFirst.mockResolvedValue(null);

    const ctx = await buildPIWorkspaceContext(TID, { piId: PI_ID });

    expect(ctx.artName).toBe("ART desconhecida");
  });

  it("without piId → falls back to most-recent PI lookup (no id filter)", async () => {
    const ctx = await buildPIWorkspaceContext(TID, { artId: ART_ID });

    expect(mocks.piPlanFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ id: expect.anything() }),
        orderBy: { createdAt: "desc" },
      })
    );

    expect(ctx.piName).toBe("PI 2026.1");
  });

  it("without piId and PI returns null → piName fallback, piDates null, objectives empty", async () => {
    mocks.piPlanFindFirst.mockResolvedValue(null);

    const ctx = await buildPIWorkspaceContext(TID, { artId: ART_ID });

    expect(ctx.piName).toBe("PI não encontrado");
    expect(ctx.piDates).toEqual({ start: null, end: null });
    expect(ctx.objectives).toEqual([]);
  });

  it("empty features list → features is []", async () => {
    mocks.featureFindMany.mockResolvedValue([]);

    const ctx = await buildPIWorkspaceContext(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(ctx.features).toEqual([]);
  });

  it("empty teams list → teams is []", async () => {
    mocks.teamFindMany.mockResolvedValue([]);

    const ctx = await buildPIWorkspaceContext(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(ctx.teams).toEqual([]);
  });

  it("features are mapped correctly (blocksCount / blockedByCount)", async () => {
    const ctx = await buildPIWorkspaceContext(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    const feat1 = ctx.features.find((f) => f.id === "feat-1")!;
    expect(feat1.blocksCount).toBe(1);
    expect(feat1.blockedByCount).toBe(0);

    const feat2 = ctx.features.find((f) => f.id === "feat-2")!;
    expect(feat2.blocksCount).toBe(0);
    expect(feat2.blockedByCount).toBe(1);
  });

  it("risks are mapped with all required fields", async () => {
    const ctx = await buildPIWorkspaceContext(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(ctx.risks[0]).toEqual({
      id: "risk-1",
      title: "Key dependency risk",
      status: "open",
      category: "dependency",
      impact: "high",
      probability: "medium",
    });
  });
});

describe("getPIWorkspaceSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it("returns a formatted string containing artName", async () => {
    const summary = await getPIWorkspaceSummary(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(summary).toContain("Platform ART");
  });

  it("returns a formatted string containing piName", async () => {
    const summary = await getPIWorkspaceSummary(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(summary).toContain("PI 2026.1");
  });

  it("returns a string with team count and feature count", async () => {
    const summary = await getPIWorkspaceSummary(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(summary).toContain("Teams: 2");
    expect(summary).toContain("Features: 2");
  });

  it("returns fallback strings when ART and PI are not found", async () => {
    mocks.artFindFirst.mockResolvedValue(null);
    mocks.piPlanFindFirst.mockResolvedValue(null);

    const summary = await getPIWorkspaceSummary(TID, {});

    expect(summary).toContain("ART desconhecida");
    expect(summary).toContain("PI não encontrado");
  });

  it("reflects zero counts when features and teams are empty", async () => {
    mocks.featureFindMany.mockResolvedValue([]);
    mocks.teamFindMany.mockResolvedValue([]);

    const summary = await getPIWorkspaceSummary(TID, {
      artId: ART_ID,
      piId: PI_ID,
    });

    expect(summary).toContain("Teams: 0");
    expect(summary).toContain("Features: 0");
  });
});
