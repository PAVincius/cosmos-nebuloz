// @vitest-environment node
// Platform health helpers + sendSafe fallback (AC-003, AC-008)

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  jobFallbackCreate: vi.fn(),
  jobFallbackFindMany: vi.fn(),
  jobFallbackUpdate: vi.fn(),
  jobFallbackCount: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    jobFallbackQueue: {
      create: dbMocks.jobFallbackCreate,
      findMany: dbMocks.jobFallbackFindMany,
      update: dbMocks.jobFallbackUpdate,
      count: dbMocks.jobFallbackCount,
    },
    $queryRaw: dbMocks.queryRaw,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));

const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: inngestMock }));

import { sendSafe } from "../../lib/inngest/send-safe";
import { aggregateSettled, overallStatus } from "../../lib/platform/health";

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.jobFallbackCreate.mockResolvedValue({ id: "jfq-1" });
  inngestMock.send.mockResolvedValue(undefined);
});

// ─── aggregateSettled ─────────────────────────────────────────────────────────

describe("aggregateSettled (AC-003)", () => {
  it("returns healthy status on fulfilled promise", () => {
    const settled: PromiseSettledResult<{ latencyMs: number }> = {
      status: "fulfilled",
      value: { latencyMs: 2.5 },
    };
    const result = aggregateSettled(settled);
    expect(result.status).toBe("healthy");
    expect(result.value).toEqual({ latencyMs: 2.5 });
    expect(result.error).toBeUndefined();
  });

  it("returns unavailable status on rejected promise", () => {
    const settled: PromiseSettledResult<unknown> = {
      status: "rejected",
      reason: new Error("Connection refused"),
    };
    const result = aggregateSettled(settled);
    expect(result.status).toBe("unavailable");
    expect(result.error).toBe("Connection refused");
    expect(result.value).toBeUndefined();
  });
});

describe("overallStatus (AC-003)", () => {
  it("returns healthy when all metrics healthy", () => {
    expect(overallStatus([{ status: "healthy" }, { status: "healthy" }])).toBe(
      "healthy"
    );
  });

  it("returns unavailable when any metric unavailable", () => {
    expect(
      overallStatus([{ status: "healthy" }, { status: "unavailable" }])
    ).toBe("unavailable");
  });

  it("returns degraded when some degraded but none unavailable", () => {
    expect(overallStatus([{ status: "healthy" }, { status: "degraded" }])).toBe(
      "degraded"
    );
  });
});

// ─── sendSafe (AC-008) ────────────────────────────────────────────────────────

describe("sendSafe (AC-008)", () => {
  it("sends event via inngest when healthy", async () => {
    await sendSafe({ name: "test/event", data: {} });

    expect(inngestMock.send).toHaveBeenCalledWith({
      name: "test/event",
      data: {},
    });
    expect(dbMocks.jobFallbackCreate).not.toHaveBeenCalled();
  });

  it("writes to JobFallbackQueue when inngest.send throws", async () => {
    inngestMock.send.mockRejectedValue(new Error("network error"));

    await sendSafe({ name: "test/event", data: { id: "x" } }, "tenant-1");

    expect(dbMocks.jobFallbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          jobType: "test/event",
          status: "PENDING",
        }),
      })
    );
  });

  it("does not throw even if both inngest and fallback DB fail", async () => {
    inngestMock.send.mockRejectedValue(new Error("inngest down"));
    dbMocks.jobFallbackCreate.mockRejectedValue(new Error("db down"));

    await expect(
      sendSafe({ name: "test/event", data: {} })
    ).resolves.not.toThrow();
  });
});
