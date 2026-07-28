import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for Task 6: the cron used to swallow a write failure with
// a bare .catch(), so a monthly audit that never once recorded a result
// still reported success. This test proves the handler THROWS (so Inngest
// records a failed run) in both failure modes: the audit write itself
// failing, and the RLS check finding a regression. It mocks @repo/database
// so it never touches a real database.
const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  queryRaw: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    $queryRaw: mocks.queryRaw,
    auditLog: { create: mocks.auditLogCreate },
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { createFunction: mocks.createFunction },
}));

import "@/lib/inngest/isolation-audit";

type StepCtx = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};
type HandlerFn = (ctx: { step: StepCtx }) => Promise<unknown>;

let capturedHandler: HandlerFn;

beforeAll(() => {
  const [[, handler]] = mocks.createFunction.mock.calls as [
    [unknown, HandlerFn],
  ];
  capturedHandler = handler;
});

function makeStep(): StepCtx {
  return {
    run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("monthlyIsolationAudit — write-audit-report failure", () => {
  it("throws when the RLS check passes but the audit write fails", async () => {
    mocks.queryRaw.mockResolvedValue([]); // no offenders
    mocks.auditLogCreate.mockRejectedValue(
      new Error(
        "Foreign key constraint violated on the constraint: `AuditLog_tenantId_fkey`"
      )
    );

    await expect(capturedHandler({ step: makeStep() })).rejects.toThrow(
      /AuditLog_tenantId_fkey/
    );
  });
});

describe("monthlyIsolationAudit — RLS regression", () => {
  it("writes the (failing) report and then throws when a table is missing RLS/FORCE/policy", async () => {
    mocks.queryRaw.mockResolvedValue([{ relname: "Epic" }]);
    mocks.auditLogCreate.mockResolvedValue({ id: "log-1" });

    await expect(capturedHandler({ step: makeStep() })).rejects.toThrow(
      /tenant isolation regression.*Epic/
    );

    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "system",
          metadata: expect.objectContaining({
            passed: false,
            tablesMissingRls: ["Epic"],
          }),
        }),
      })
    );
  });

  it("resolves without throwing when no table is missing RLS/FORCE/policy", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    mocks.auditLogCreate.mockResolvedValue({ id: "log-2" });

    const result = await capturedHandler({ step: makeStep() });

    expect(result).toEqual({ passed: true, tablesMissingRls: [] });
  });
});
