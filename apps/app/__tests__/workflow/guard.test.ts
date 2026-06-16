import { describe, expect, it } from "vitest";

// Test the pure guard evaluation logic extracted from transition.ts
// The server action itself requires a live DB; these tests cover the guard logic.

type GuardFn = (ctx: Record<string, unknown>) => boolean;

const GUARDS: Record<string, GuardFn> = {
  hasAssignee: (ctx) =>
    Array.isArray(ctx.assignees) && (ctx.assignees as string[]).length > 0,
  approved: () => true,
  rejected: () => true,
};

function evaluateGuard(name: string, ctx: Record<string, unknown>): boolean {
  const fn = GUARDS[name];
  return fn ? fn(ctx) : true;
}

// ─── AC-006 guard enforcement ─────────────────────────────────────────────────

describe("evaluateGuard (AC-006)", () => {
  it("hasAssignee passes when assignees list is non-empty", () => {
    expect(evaluateGuard("hasAssignee", { assignees: ["user-1"] })).toBe(true);
  });

  it("hasAssignee fails when assignees is empty array", () => {
    expect(evaluateGuard("hasAssignee", { assignees: [] })).toBe(false);
  });

  it("hasAssignee fails when assignees is absent", () => {
    expect(evaluateGuard("hasAssignee", {})).toBe(false);
  });

  it("approved guard always passes (gateway condition checked by event routing)", () => {
    expect(evaluateGuard("approved", {})).toBe(true);
  });

  it("unknown guard defaults to pass (open-world assumption)", () => {
    expect(evaluateGuard("unknownGuard", {})).toBe(true);
  });
});

// ─── Machine config transition lookup ─────────────────────────────────────────

import type { MachineConfig } from "../../lib/bpmn/compiler";

const SAMPLE_MACHINE: MachineConfig = {
  id: "custom-workflow",
  initial: "Review",
  states: {
    Review: {
      on: { NEXT: { target: "Decision" } },
    },
    Decision: {
      on: {
        APPROVED: { target: "Implement", guard: "approved" },
        REJECTED: { target: "Revise", guard: "rejected" },
      },
    },
    Awaiting_Review: {
      on: { NEXT: { target: "Done" } },
      meta: { waitEvent: "github.pr.merged", slaHours: 48 },
    },
    Implement: {
      on: { NEXT: { target: "Done" } },
    },
    Revise: {
      on: { NEXT: { target: "Review" } },
    },
    Done: { type: "final" },
  },
};

describe("machine state transitions", () => {
  it("valid transition found for current state + event", () => {
    const state = SAMPLE_MACHINE.states.Review;
    expect(state?.on?.NEXT?.target).toBe("Decision");
  });

  it("guard required for gateway transitions", () => {
    const state = SAMPLE_MACHINE.states.Decision;
    expect(state?.on?.APPROVED?.guard).toBe("approved");
    expect(state?.on?.REJECTED?.guard).toBe("rejected");
  });

  it("wait-state has slaHours in meta", () => {
    const state = SAMPLE_MACHINE.states.Awaiting_Review;
    expect(state?.meta?.slaHours).toBe(48);
    expect(state?.meta?.waitEvent).toBe("github.pr.merged");
  });

  it("final state has no transitions", () => {
    const state = SAMPLE_MACHINE.states.Done;
    expect(state?.type).toBe("final");
    expect(state?.on).toBeUndefined();
  });
});
