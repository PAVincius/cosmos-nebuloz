import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  flowMetricSnapshotFindMany: vi.fn(),
  leanBudgetFindMany: vi.fn(),
  strategicThemeFindMany: vi.fn(),
  teamFindMany: vi.fn(),
  epicFindMany: vi.fn(),
  oKRFindMany: vi.fn(),
  featureCreate: vi.fn(),
  featureFindFirst: vi.fn(),
  featureUpdate: vi.fn(),
  featureUpdateMany: vi.fn(),
  featureFindMany: vi.fn(),
  piPlanFindFirst: vi.fn(),
  artFindMany: vi.fn(),
  pIObjectiveFindMany: vi.fn(),
  pIRiskFindMany: vi.fn(),
  searchKnowledge: vi.fn(),
  embed: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: { findMany: mocks.flowMetricSnapshotFindMany },
    leanBudget: { findMany: mocks.leanBudgetFindMany },
    strategicTheme: { findMany: mocks.strategicThemeFindMany },
    team: { findMany: mocks.teamFindMany },
    epic: { findMany: mocks.epicFindMany },
    oKR: { findMany: mocks.oKRFindMany },
    feature: {
      create: mocks.featureCreate,
      findFirst: mocks.featureFindFirst,
      update: mocks.featureUpdate,
      updateMany: mocks.featureUpdateMany,
      findMany: mocks.featureFindMany,
    },
    pIPlan: { findFirst: mocks.piPlanFindFirst },
    aRT: { findMany: mocks.artFindMany },
    pIObjective: { findMany: mocks.pIObjectiveFindMany },
    pIRisk: { findMany: mocks.pIRiskFindMany },
  },
}));

vi.mock("@repo/ai/lib/models", () => ({
  models: { embeddings: "text-embedding-3-small" },
}));

vi.mock("@repo/database/vector-search", () => ({
  searchKnowledge: mocks.searchKnowledge,
}));

vi.mock("ai", () => ({
  tool: (def: unknown) => def,
  embed: mocks.embed,
}));

vi.mock("../../../app/actions/safe-copilot/tools/pricing-tools", () => ({
  awsPricingTool: { description: "aws", inputSchema: {}, execute: vi.fn() },
  gcpPricingTool: { description: "gcp", inputSchema: {}, execute: vi.fn() },
}));

// ─── Subject under test (must come after vi.mock calls) ─────────────────────

import { buildCopilotTools } from "../../../app/actions/safe-copilot/tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = Record<string, { execute: (...args: any[]) => Promise<any> }>;

// ─── Shared setup ───────────────────────────────────────────────────────────

const TENANT_ID = "tenant-test";

beforeEach(() => {
  vi.clearAllMocks();

  // Default safe empty returns
  mocks.flowMetricSnapshotFindMany.mockResolvedValue([]);
  mocks.leanBudgetFindMany.mockResolvedValue([]);
  mocks.strategicThemeFindMany.mockResolvedValue([]);
  mocks.teamFindMany.mockResolvedValue([]);
  mocks.epicFindMany.mockResolvedValue([]);
  mocks.oKRFindMany.mockResolvedValue([]);
  mocks.featureFindMany.mockResolvedValue([]);
  mocks.artFindMany.mockResolvedValue([]);
  mocks.pIObjectiveFindMany.mockResolvedValue([]);
  mocks.pIRiskFindMany.mockResolvedValue([]);
});

// ─── queryFlowMetrics ───────────────────────────────────────────────────────

describe("queryFlowMetrics", () => {
  it("calls findMany with tenantId, scope, scopeId and take=periods; returns { scope, scopeId, snapshots }", async () => {
    const snapshot = {
      id: "snap-1",
      tenantId: TENANT_ID,
      scope: "team",
      scopeId: "team-42",
      periodRef: "2024-Q4",
      flowVelocityTotal: 80,
    };
    mocks.flowMetricSnapshotFindMany.mockResolvedValue([snapshot]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryFlowMetrics.execute(
      { scope: "team", scopeId: "team-42", periods: 2 },
      {} as never
    );

    expect(mocks.flowMetricSnapshotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, scope: "team", scopeId: "team-42" },
        orderBy: { periodRef: "desc" },
        take: 2,
      })
    );
    expect(result).toEqual({
      scope: "team",
      scopeId: "team-42",
      snapshots: [snapshot],
    });
  });

  it("returns empty snapshots array when no data found", async () => {
    mocks.flowMetricSnapshotFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryFlowMetrics.execute(
      { scope: "art", scopeId: "art-1", periods: 3 },
      {} as never
    );

    expect(result.snapshots).toHaveLength(0);
    expect(result.scope).toBe("art");
    expect(result.scopeId).toBe("art-1");
  });
});

// ─── queryLeanBudget ────────────────────────────────────────────────────────

describe("queryLeanBudget", () => {
  it("(entityType=art) calls leanBudget.findMany with artId filter and returns { entityType, entityId, budgets }", async () => {
    const budget = {
      id: "budget-1",
      name: "ART Alpha Budget",
      amount: 500_000,
      spent: 120_000,
      period: "PI-24.1",
      artId: "art-1",
    };
    mocks.leanBudgetFindMany.mockResolvedValue([budget]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryLeanBudget.execute(
      { entityId: "art-1", entityType: "art" },
      {} as never
    );

    expect(mocks.leanBudgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, artId: "art-1" },
        take: 10,
      })
    );
    expect(mocks.strategicThemeFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      entityType: "art",
      entityId: "art-1",
      budgets: [budget],
    });
  });

  it("(entityType=portfolio) calls both leanBudget.findMany and strategicTheme.findMany; returns { entityType, budgets, themes }", async () => {
    const budget = {
      id: "budget-2",
      name: "Portfolio Budget",
      amount: 2_000_000,
      spent: 800_000,
      period: "PI-24.1",
      artId: null,
    };
    const theme = {
      id: "theme-1",
      code: "ST1",
      title: "Digital Transformation",
      status: "ACTIVE",
      budgetTotal: 500_000,
    };
    mocks.leanBudgetFindMany.mockResolvedValue([budget]);
    mocks.strategicThemeFindMany.mockResolvedValue([theme]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryLeanBudget.execute(
      { entityId: "portfolio-1", entityType: "portfolio" },
      {} as never
    );

    expect(mocks.leanBudgetFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID },
        take: 20,
      })
    );
    expect(mocks.strategicThemeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID },
        take: 15,
      })
    );
    expect(result).toEqual({
      entityType: "portfolio",
      budgets: [budget],
      themes: [theme],
    });
  });
});

// ─── queryTeams ─────────────────────────────────────────────────────────────

describe("queryTeams", () => {
  it("returns all teams without artId filter when artId is omitted", async () => {
    const teams = [
      {
        id: "team-1",
        name: "Phoenix",
        velocity: 40,
        sprintLengthDays: 14,
        artId: "art-1",
      },
      {
        id: "team-2",
        name: "Falcon",
        velocity: 35,
        sprintLengthDays: 14,
        artId: "art-2",
      },
    ];
    mocks.teamFindMany.mockResolvedValue(teams);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryTeams.execute({}, {} as never);

    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } })
    );
    expect(result).toEqual({ teams });
  });

  it("passes artId filter to database query when provided", async () => {
    const team = {
      id: "team-1",
      name: "Phoenix",
      velocity: 40,
      sprintLengthDays: 14,
      artId: "art-1",
    };
    mocks.teamFindMany.mockResolvedValue([team]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryTeams.execute(
      { artId: "art-1" },
      {} as never
    );

    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, artId: "art-1" },
      })
    );
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].id).toBe("team-1");
  });
});

// ─── queryEpics ─────────────────────────────────────────────────────────────

describe("queryEpics", () => {
  it("maps _count.features to featuresCount and returns { epics }", async () => {
    mocks.epicFindMany.mockResolvedValue([
      {
        id: "epic-1",
        title: "Platform Modernisation",
        statusId: "IN_PROGRESS",
        strategicThemeId: "theme-1",
        _count: { features: 7 },
      },
    ]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryEpics.execute({ take: 15 }, {} as never);

    expect(result).toEqual({
      epics: [
        {
          id: "epic-1",
          title: "Platform Modernisation",
          statusId: "IN_PROGRESS",
          strategicThemeId: "theme-1",
          featuresCount: 7,
        },
      ],
    });
  });

  it("passes statusId filter when status is provided", async () => {
    mocks.epicFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    await tools.queryEpics.execute({ status: "BACKLOG", take: 5 }, {} as never);

    expect(mocks.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, statusId: "BACKLOG" },
        take: 5,
      })
    );
  });

  it("omits statusId from where clause when status is not provided", async () => {
    mocks.epicFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    await tools.queryEpics.execute({ take: 15 }, {} as never);

    expect(mocks.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID },
      })
    );
  });
});

// ─── queryOKRs ──────────────────────────────────────────────────────────────

describe("queryOKRs", () => {
  it("returns empty okrs array when no data found", async () => {
    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryOKRs.execute({}, {} as never);

    expect(result).toEqual({ okrs: [] });
  });

  it("passes status=AT_RISK filter to oKR.findMany", async () => {
    const okr = {
      id: "okr-1",
      title: "Improve delivery throughput",
      type: "pi_art",
      status: "AT_RISK",
      artId: "art-1",
      teamId: null,
      horizon: "PI-24.1",
      keyResults: [
        {
          id: "kr-1",
          title: "Cycle time < 5d",
          current: 6,
          target: 5,
          unit: "days",
          metric: "cycle_time",
        },
      ],
    };
    mocks.oKRFindMany.mockResolvedValue([okr]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.queryOKRs.execute(
      { status: "AT_RISK" },
      {} as never
    );

    expect(mocks.oKRFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, status: "AT_RISK" },
      })
    );
    expect(result).toEqual({ okrs: [okr] });
  });

  it("omits status from where clause when not provided", async () => {
    mocks.oKRFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    await tools.queryOKRs.execute({}, {} as never);

    expect(mocks.oKRFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID },
      })
    );
  });
});

// ─── createFeature ──────────────────────────────────────────────────────────

describe("createFeature", () => {
  it("calls feature.create with correct data and returns { ok: true, feature }", async () => {
    const createdFeature = {
      id: "feat-1",
      title: "Export to CSV",
      wsjfScore: 3,
      statusId: "BACKLOG",
    };
    mocks.featureCreate.mockResolvedValue(createdFeature);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.createFeature.execute(
      {
        title: "Export to CSV",
        epicId: "epic-1",
        piPlanId: undefined,
        bv: 8,
        tc: 4,
        rr: 3,
        js: 5,
        storyPoints: 13,
      },
      {} as never
    );

    expect(mocks.featureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT_ID,
          title: "Export to CSV",
          statusId: "BACKLOG",
          bv: 8,
          tc: 4,
          rr: 3,
          js: 5,
          wsjfScore: (8 + 4 + 3) / 5,
          storyPoints: 13,
          epicId: "epic-1",
        }),
      })
    );
    expect(result).toEqual({ ok: true, feature: createdFeature });
  });

  it("calculates wsjfScore as (bv + tc + rr) / js", async () => {
    mocks.featureCreate.mockResolvedValue({
      id: "feat-2",
      title: "Bulk Import",
      wsjfScore: 2.5,
      statusId: "BACKLOG",
    });

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    await tools.createFeature.execute(
      { title: "Bulk Import", bv: 10, tc: 5, rr: 5, js: 8, storyPoints: 8 },
      {} as never
    );

    expect(mocks.featureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wsjfScore: (10 + 5 + 5) / 8,
        }),
      })
    );
  });

  it("sets wsjfScore to 0 when js is 0", async () => {
    mocks.featureCreate.mockResolvedValue({
      id: "feat-3",
      title: "Zero JS feature",
      wsjfScore: 0,
      statusId: "BACKLOG",
    });

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    await tools.createFeature.execute(
      { title: "Zero JS feature", bv: 8, tc: 4, rr: 3, js: 0, storyPoints: 5 },
      {} as never
    );

    expect(mocks.featureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ wsjfScore: 0 }),
      })
    );
  });
});

// ─── moveFeature ────────────────────────────────────────────────────────────

describe("moveFeature", () => {
  it("(toStatus=IN_PROGRESS) calls feature.update with statusId and startedAt; returns { ok: true, feature }", async () => {
    const updatedFeature = {
      id: "feat-1",
      title: "Export to CSV",
      statusId: "IN_PROGRESS",
    };
    mocks.featureUpdate.mockResolvedValue(updatedFeature);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.moveFeature.execute(
      { featureId: "feat-1", toStatus: "IN_PROGRESS" },
      {} as never
    );

    expect(mocks.featureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feat-1", tenantId: TENANT_ID },
        data: expect.objectContaining({
          statusId: "IN_PROGRESS",
          startedAt: expect.any(Date),
        }),
      })
    );
    expect(result).toEqual({ ok: true, feature: updatedFeature });
  });

  it("(toStatus=DONE) calls feature.update with completedAt in data", async () => {
    const updatedFeature = {
      id: "feat-1",
      title: "Export to CSV",
      statusId: "DONE",
    };
    mocks.featureUpdate.mockResolvedValue(updatedFeature);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    const result = await tools.moveFeature.execute(
      { featureId: "feat-1", toStatus: "DONE" },
      {} as never
    );

    expect(mocks.featureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "feat-1", tenantId: TENANT_ID },
        data: expect.objectContaining({
          statusId: "DONE",
          completedAt: expect.any(Date),
        }),
      })
    );
    expect(result).toEqual({ ok: true, feature: updatedFeature });
  });

  it("(toStatus=BACKLOG) calls feature.update without extra date fields", async () => {
    const updatedFeature = {
      id: "feat-1",
      title: "Export to CSV",
      statusId: "BACKLOG",
    };
    mocks.featureUpdate.mockResolvedValue(updatedFeature);

    const tools = buildCopilotTools(TENANT_ID) as unknown as AnyTools;
    await tools.moveFeature.execute(
      { featureId: "feat-1", toStatus: "BACKLOG" },
      {} as never
    );

    const callArg = mocks.featureUpdate.mock.calls[0][0];
    expect(callArg.data).not.toHaveProperty("startedAt");
    expect(callArg.data).not.toHaveProperty("completedAt");
    expect(callArg.data.statusId).toBe("BACKLOG");
  });
});
