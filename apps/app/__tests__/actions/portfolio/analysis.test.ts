import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  reportCreate: vi.fn(),
  artFindFirst: vi.fn(),
  reportFindFirst: vi.fn(),
  reportFindFirstOrThrow: vi.fn(),
  reportUpdate: vi.fn(),
  inngestSend: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("@repo/database", () => ({
  database: {
    portfolioAnalysisReport: {
      create: mocks.reportCreate,
      findFirst: mocks.reportFindFirst,
      findFirstOrThrow: mocks.reportFindFirstOrThrow,
      update: mocks.reportUpdate,
    },
    aRT: { findFirst: mocks.artFindFirst },
  },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));
vi.mock("@repo/rate-limit", () => ({
  redis: { set: mocks.redisSet },
}));

import { triggerPortfolioAnalysis } from "../../../app/actions/portfolio/analysis";
import { buildPortfolioReport } from "../../../app/actions/portfolio/analysis-report";

// ─── buildPortfolioReport (pure) ─────────────────────────────────────────────

describe("buildPortfolioReport (AC-008/AC-009)", () => {
  it("returns COMPLETE when all epics analyzed (AC-008)", () => {
    const results = [
      { epicId: "e1", status: "COMPLETE" as const, investScore: 80 },
      { epicId: "e2", status: "COMPLETE" as const, investScore: 50 },
    ];
    const report = buildPortfolioReport(results);
    expect(report.completionStatus).toBe("COMPLETE");
    expect(report.skippedEpics).toHaveLength(0);
  });

  it("returns PARTIAL_SUCCESS when some epics unavailable (AC-008)", () => {
    const results = [
      { epicId: "e1", status: "COMPLETE" as const, investScore: 80 },
      {
        epicId: "e2",
        status: "UNAVAILABLE" as const,
        reason: "INSUFFICIENT_CONTENT",
      },
      {
        epicId: "e3",
        status: "UNAVAILABLE" as const,
        reason: "INSUFFICIENT_CONTENT",
      },
    ];
    const report = buildPortfolioReport(results);
    expect(report.completionStatus).toBe("PARTIAL_SUCCESS");
    expect(report.skippedEpics).toHaveLength(2);
  });

  it("includes change-diff vs prior report (AC-009)", () => {
    const results = [
      { epicId: "e1", status: "COMPLETE" as const, investScore: 75 }, // was NOT_READY → now READY
    ];
    const prior = { epicCategories: { e1: "NOT_READY" } };
    const report = buildPortfolioReport(results, prior);
    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]).toEqual({
      epicId: "e1",
      from: "NOT_READY",
      to: "READY",
    });
  });

  it("no change when category unchanged (AC-009)", () => {
    const results = [
      { epicId: "e1", status: "COMPLETE" as const, investScore: 75 }, // READY
    ];
    const prior = { epicCategories: { e1: "READY" } };
    const report = buildPortfolioReport(results, prior);
    expect(report.changes).toHaveLength(0);
  });
});

// ─── triggerPortfolioAnalysis ─────────────────────────────────────────────────

describe("triggerPortfolioAnalysis (AC-006/AC-007)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue({ ...tenantCtx, role: "RTE" });
    mocks.reportCreate.mockResolvedValue({ id: "report-1" });
    mocks.reportUpdate.mockResolvedValue({ id: "report-1", jobId: "job-1" });
    mocks.inngestSend.mockResolvedValue({ ids: ["job-1"] });
    mocks.artFindFirst.mockResolvedValue({ id: "art-1" });
  });

  it("rejects an artId that is not owned by the tenant, without taking the lock (IDOR guard)", async () => {
    mocks.artFindFirst.mockResolvedValue(null);

    const result = await triggerPortfolioAnalysis({
      artId: "art-of-another-tenant",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("ART_NOT_FOUND");
    expect(mocks.redisSet).not.toHaveBeenCalled();
    expect(mocks.reportCreate).not.toHaveBeenCalled();
  });

  it("creates report and enqueues Inngest job (AC-006)", async () => {
    mocks.redisSet.mockResolvedValue("OK"); // lock acquired

    const result = await triggerPortfolioAnalysis({ artId: "art-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("QUEUED");
    expect(result.data.jobId).toBe("job-1");
    expect(mocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "portfolio/analysis.requested",
        data: expect.objectContaining({ artId: "art-1" }),
      })
    );
  });

  it("returns ANALYSIS_RUNNING when lock held (AC-007)", async () => {
    mocks.redisSet.mockResolvedValue(null); // lock NOT acquired
    mocks.reportFindFirst.mockResolvedValue({
      jobId: "job-existing",
      createdAt: new Date(),
    });

    const result = await triggerPortfolioAnalysis({ artId: "art-1" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("ANALYSIS_RUNNING");
    expect(mocks.inngestSend).not.toHaveBeenCalled();
  });

  it("passes 90-day expiresAt to report creation (AC-009)", async () => {
    mocks.redisSet.mockResolvedValue("OK");

    await triggerPortfolioAnalysis({ artId: "art-1" });

    const createCall = mocks.reportCreate.mock.calls[0][0];
    const expiresAt = createCall.data.expiresAt as Date;
    const diffDays = (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(90, 0);
  });
});
