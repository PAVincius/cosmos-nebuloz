import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi
    .fn()
    .mockResolvedValue({ tenantId: "t1", userId: "u1" }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({}),
}));

vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: { findFirst: vi.fn(), findMany: vi.fn() },
    anomalyDetectionRun: { create: vi.fn(), update: vi.fn() },
    anomaly: { createMany: vi.fn() },
    improvementAction: { create: vi.fn(), findMany: vi.fn() },
    competencyAssessment: { findFirst: vi.fn() },
  },
}));

import { database } from "@repo/database";
import { analyzeFlowAnomalies } from "@/app/actions/flow-intelligence/analyze-flow";

const mockDb = database as any;

const HEALTHY = {
  id: "snap-1",
  tenantId: "t1",
  scope: "team",
  scopeId: "team-1",
  flowVelocityTotal: 40,
  flowTimeOverall: 5,
  flowEfficiency: 0.85,
  flowPredictability: 0.88,
  flowLoadCurrent: 15,
  flowDistribution: { story: 80, defect: 10, enabler: 10 },
};

const CRITICAL = {
  ...HEALTHY,
  flowVelocityTotal: 5,
  flowLoadCurrent: 50, // load > 2*velocity → CRITICAL
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.anomalyDetectionRun.create.mockResolvedValue({ id: "run-1" });
  mockDb.anomalyDetectionRun.update.mockResolvedValue({});
  mockDb.anomaly.createMany.mockResolvedValue({ count: 0 });
  mockDb.improvementAction.create.mockResolvedValue({ id: "act-1" });
  mockDb.improvementAction.findMany.mockResolvedValue([]);
  mockDb.competencyAssessment.findFirst.mockResolvedValue(null);
  mockDb.flowMetricSnapshot.findMany.mockResolvedValue([]);
});

describe("analyzeFlowAnomalies", () => {
  it("returns err when snapshot not found", async () => {
    mockDb.flowMetricSnapshot.findFirst.mockResolvedValue(null);
    const result = await analyzeFlowAnomalies("missing", "manual");
    expect(result.ok).toBe(false);
  });

  it("creates AnomalyDetectionRun with status RUNNING then COMPLETED", async () => {
    mockDb.flowMetricSnapshot.findFirst.mockResolvedValue(HEALTHY);
    await analyzeFlowAnomalies("snap-1", "manual");
    expect(mockDb.anomalyDetectionRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RUNNING",
          trigger: "manual",
        }),
      })
    );
    expect(mockDb.anomalyDetectionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });

  it("returns empty anomalies on healthy snapshot", async () => {
    mockDb.flowMetricSnapshot.findFirst.mockResolvedValue(HEALTHY);
    const result = await analyzeFlowAnomalies("snap-1", "manual");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.anomalies).toHaveLength(0);
    expect(result.data.summary.priority).toBe("HEALTHY");
  });

  it("auto-creates ImprovementAction for CRITICAL anomaly", async () => {
    mockDb.flowMetricSnapshot.findFirst.mockResolvedValue(CRITICAL);
    const result = await analyzeFlowAnomalies("snap-1", "manual");
    expect(result.ok).toBe(true);
    expect(mockDb.improvementAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "ai_copilot",
          sourceRunId: "run-1",
        }),
      })
    );
    if (!result.ok) {
      return;
    }
    expect(result.data.autoCreatedActionIds).toHaveLength(1);
  });
});
