import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  artFindMany: vi.fn(),
  flowMetricSnapshotFindMany: vi.fn(),
  teamFindMany: vi.fn(),
  epicFindMany: vi.fn(),
  okrFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    aRT: { findMany: mocks.artFindMany },
    flowMetricSnapshot: { findMany: mocks.flowMetricSnapshotFindMany },
    team: { findMany: mocks.teamFindMany },
    epic: { findMany: mocks.epicFindMany },
    oKR: { findMany: mocks.okrFindMany },
  },
}));

vi.mock("@repo/ai/lib/models", () => ({
  models: { embeddings: "text-embedding-3-small" },
}));

vi.mock("@repo/database/vector-search", () => ({
  searchKnowledge: vi.fn(),
}));

vi.mock("ai", () => ({
  embed: vi.fn(),
  tool: (def: unknown) => def,
}));

import { buildCopilotTools } from "../../app/actions/safe-copilot/tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTools = Record<string, { execute: (...args: any[]) => Promise<any> }>;

const TID = "tenant-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.artFindMany.mockResolvedValue([]);
  mocks.flowMetricSnapshotFindMany.mockResolvedValue([]);
  mocks.teamFindMany.mockResolvedValue([]);
  mocks.epicFindMany.mockResolvedValue([]);
  mocks.okrFindMany.mockResolvedValue([]);
});

// ─── queryARTs ─────────────────────────────────────────────────────────────

describe("queryARTs", () => {
  it("returns empty arts when no data", async () => {
    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryARTs.execute(
      { includeMetrics: true },
      {} as never
    );

    expect(result).toEqual({ arts: [] });
  });

  it("returns arts with latestMetrics=null when no snapshots", async () => {
    mocks.artFindMany.mockResolvedValue([
      { id: "art-1", name: "ART Alpha", cadence: "PI" },
    ]);
    mocks.flowMetricSnapshotFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryARTs.execute(
      { includeMetrics: true },
      {} as never
    );

    expect(result).toEqual({
      arts: [
        { id: "art-1", name: "ART Alpha", cadence: "PI", latestMetrics: null },
      ],
    });
  });

  it("attaches latestMetrics from matching snapshot (first snapshot for scopeId wins)", async () => {
    mocks.artFindMany.mockResolvedValue([
      { id: "art-1", name: "ART Alpha", cadence: "PI" },
      { id: "art-2", name: "ART Beta", cadence: "PI" },
    ]);

    const snap1 = {
      scopeId: "art-1",
      periodRef: "2024-Q1",
      flowVelocityTotal: 120,
      flowEfficiency: 0.75,
      flowPredictability: 0.9,
    };
    const snap2 = {
      scopeId: "art-1",
      periodRef: "2023-Q4",
      flowVelocityTotal: 100,
      flowEfficiency: 0.6,
      flowPredictability: 0.8,
    };

    mocks.flowMetricSnapshotFindMany.mockResolvedValue([snap1, snap2]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryARTs.execute(
      { includeMetrics: true },
      {} as never
    );

    expect(result).toEqual({
      arts: [
        { id: "art-1", name: "ART Alpha", cadence: "PI", latestMetrics: snap1 },
        { id: "art-2", name: "ART Beta", cadence: "PI", latestMetrics: null },
      ],
    });
  });

  it("includeMetrics=false skips snapshot query", async () => {
    mocks.artFindMany.mockResolvedValue([
      { id: "art-1", name: "ART Alpha", cadence: "PI" },
    ]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryARTs.execute(
      { includeMetrics: false },
      {} as never
    );

    expect(mocks.flowMetricSnapshotFindMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      arts: [{ id: "art-1", name: "ART Alpha", cadence: "PI" }],
    });
  });
});

// ─── queryTeams ────────────────────────────────────────────────────────────

describe("queryTeams", () => {
  it("returns all teams when no artId filter", async () => {
    mocks.teamFindMany.mockResolvedValue([
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
    ]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryTeams.execute({}, {} as never);

    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TID } })
    );
    expect(result.teams).toHaveLength(2);
  });

  it("passes artId filter to database query", async () => {
    mocks.teamFindMany.mockResolvedValue([
      {
        id: "team-1",
        name: "Phoenix",
        velocity: 40,
        sprintLengthDays: 14,
        artId: "art-1",
      },
    ]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryTeams.execute(
      { artId: "art-1" },
      {} as never
    );

    expect(mocks.teamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TID, artId: "art-1" },
      })
    );
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].id).toBe("team-1");
  });
});

// ─── queryEpics ────────────────────────────────────────────────────────────

describe("queryEpics", () => {
  it("returns mapped epics with featuresCount from _count.features", async () => {
    mocks.epicFindMany.mockResolvedValue([
      {
        id: "epic-1",
        title: "Platform Modernisation",
        statusId: "IN_PROGRESS",
        strategicThemeId: "theme-1",
        _count: { features: 7 },
      },
    ]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
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

  it("passes status filter when provided", async () => {
    mocks.epicFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    await tools.queryEpics.execute({ status: "DONE", take: 15 }, {} as never);

    expect(mocks.epicFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TID, statusId: "DONE" },
      })
    );
  });
});

// ─── queryOKRs ─────────────────────────────────────────────────────────────

describe("queryOKRs", () => {
  it("returns empty when no OKRs", async () => {
    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryOKRs.execute({}, {} as never);

    expect(result).toEqual({ okrs: [] });
  });

  it("returns OKRs with keyResults", async () => {
    const okr = {
      id: "okr-1",
      title: "Improve delivery throughput",
      type: "pi_art",
      status: "ON_TRACK",
      artId: "art-1",
      teamId: null,
      horizon: "2024-Q1",
      keyResults: [
        {
          id: "kr-1",
          title: "Increase velocity",
          current: 80,
          target: 100,
          unit: "points",
          metric: "velocity",
        },
      ],
    };
    mocks.okrFindMany.mockResolvedValue([okr]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    const result = await tools.queryOKRs.execute({}, {} as never);

    expect(result).toEqual({ okrs: [okr] });
    expect(result.okrs[0].keyResults).toHaveLength(1);
  });

  it("passes status filter when provided", async () => {
    mocks.okrFindMany.mockResolvedValue([]);

    const tools = buildCopilotTools(TID) as unknown as AnyTools;
    await tools.queryOKRs.execute({ status: "AT_RISK" }, {} as never);

    expect(mocks.okrFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TID, status: "AT_RISK" },
      })
    );
  });
});
