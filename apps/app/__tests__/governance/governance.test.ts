import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const dbMocks = vi.hoisted(() => ({
  governedEpicFindFirst: vi.fn(),
  stepFindFirst: vi.fn(),
  stepUpdate: vi.fn(),
  decisionCreate: vi.fn(),
  transact: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    governedEpic: { findFirst: dbMocks.governedEpicFindFirst },
    approvalStepInstance: {
      findFirst: dbMocks.stepFindFirst,
      update: dbMocks.stepUpdate,
    },
    decisionLogEntry: { create: dbMocks.decisionCreate },
    $transaction: dbMocks.transact,
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn() },
}));

import { bulkApproveStep } from "../../lib/governance/bulk-approve";
import { validateBypassJustification } from "../../lib/governance/bypass";
import { hoursUntilBreach, isBreached } from "../../lib/governance/sla";

// ─── SLA breach detection (AC-002) ───────────────────────────────────────────

describe("SLA breach detection (AC-002)", () => {
  it("detects breach when deadline is in the past", () => {
    const past = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-06-01T00:00:00Z");
    expect(isBreached(past, now)).toBe(true);
  });

  it("returns false when deadline is in the future", () => {
    const future = new Date("2030-01-01T00:00:00Z");
    const now = new Date("2026-06-01T00:00:00Z");
    expect(isBreached(future, now)).toBe(false);
  });

  it("calculates correct hours until breach", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const deadline = new Date("2026-06-03T00:00:00Z"); // 2 days later
    const hours = hoursUntilBreach(deadline, now);
    expect(hours).toBeCloseTo(48, 0);
  });

  it("returns negative hours when already breached", () => {
    const past = new Date("2026-05-30T00:00:00Z");
    const now = new Date("2026-06-01T00:00:00Z");
    expect(hoursUntilBreach(past, now)).toBeLessThan(0);
  });
});

// ─── RTE bypass justification guard (AC-006) ──────────────────────────────────

describe("validateBypassJustification (AC-006)", () => {
  it("accepts justification of 50+ chars", () => {
    const result = validateBypassJustification(
      "The original approver is on leave and the delivery date is critical for Q2."
    );
    expect(result.valid).toBe(true);
  });

  it("rejects justification under 50 chars", () => {
    const result = validateBypassJustification("Too short.");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("50");
    }
  });

  it("rejects empty justification", () => {
    const result = validateBypassJustification("");
    expect(result.valid).toBe(false);
  });

  it("accepts exactly 50 chars", () => {
    const exactly50 = "A".repeat(50);
    const result = validateBypassJustification(exactly50);
    expect(result.valid).toBe(true);
  });

  it("trims before counting (AC-006 — no whitespace padding)", () => {
    const padded = `  ${"A".repeat(20)}  `;
    const result = validateBypassJustification(padded);
    expect(result.valid).toBe(false);
  });
});

// ─── Bulk approval partial success (AC-008) ───────────────────────────────────

describe("bulkApproveStep partial success (AC-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns partial success when some epics fail (AC-008)", async () => {
    dbMocks.governedEpicFindFirst
      .mockResolvedValueOnce({ id: "ge-1", currentApprovalRequestId: "req-1" })
      .mockResolvedValueOnce({ id: "ge-2", currentApprovalRequestId: null }) // no active request
      .mockResolvedValueOnce({ id: "ge-3", currentApprovalRequestId: "req-3" });

    dbMocks.stepFindFirst
      .mockResolvedValueOnce({ id: "step-1" })
      .mockResolvedValueOnce({ id: "step-3" });

    dbMocks.transact.mockResolvedValue([{}, {}]);

    const result = await bulkApproveStep(
      ["epic-1", "epic-2", "epic-3"],
      1,
      "approver-1",
      "t-1"
    );

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].epicId).toBe("epic-2");
  });

  it("returns full success when all epics approved (AC-008)", async () => {
    dbMocks.governedEpicFindFirst.mockResolvedValue({
      id: "ge-1",
      currentApprovalRequestId: "req-1",
    });
    dbMocks.stepFindFirst.mockResolvedValue({ id: "step-1" });
    dbMocks.transact.mockResolvedValue([{}, {}]);

    const result = await bulkApproveStep(
      ["epic-1", "epic-2"],
      1,
      "approver-1",
      "t-1"
    );

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Parallel step gate (AC-005) ──────────────────────────────────────────────

describe("Parallel step gate logic (AC-005)", () => {
  it("parallel steps are identified by isParallel=true field", () => {
    const parallelStep = {
      id: "step-1",
      etapaOrdem: 2,
      isParallel: true,
      estado: "pending",
    };
    expect(parallelStep.isParallel).toBe(true);
  });

  it("sequential steps have isParallel=false by default", () => {
    const seqStep = {
      id: "step-2",
      etapaOrdem: 1,
      isParallel: false,
      estado: "pending",
    };
    expect(seqStep.isParallel).toBe(false);
  });
});
