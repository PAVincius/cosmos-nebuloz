import { describe, expect, it } from "vitest";
import {
  getDefaultState,
  getNextStep,
  isOnboardingComplete,
  isStepCompleted,
  markStepComplete,
  ONBOARDING_STEPS,
  type OnboardingState,
  resumeAtStep,
} from "../../lib/onboarding/wizard";
import {
  buildQueueEntry,
  isInngestUnavailable,
  shouldDrainEntry,
} from "../../lib/platform/fallback-queue";
import {
  aggregateAll,
  aggregateSettled,
  overallStatus,
} from "../../lib/platform/health";

// ─── Onboarding wizard (AC-001, AC-002) ──────────────────────────────────────

describe("onboarding wizard (AC-001)", () => {
  it("starts at org-setup step", () => {
    const state = getDefaultState();
    expect(state.currentStep).toBe("org-setup");
    expect(state.completedSteps).toHaveLength(0);
  });

  it("has exactly 4 steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(4);
    expect(ONBOARDING_STEPS).toEqual([
      "org-setup",
      "art-setup",
      "invite-members",
      "connect-integration",
    ]);
  });

  it("markStepComplete advances to next step", () => {
    const state = markStepComplete(getDefaultState(), "org-setup");
    expect(state.completedSteps).toContain("org-setup");
    expect(state.currentStep).toBe("art-setup");
  });

  it("markStepComplete is idempotent", () => {
    const s1 = markStepComplete(getDefaultState(), "org-setup");
    const s2 = markStepComplete(s1, "org-setup");
    expect(s2.completedSteps.filter((s) => s === "org-setup")).toHaveLength(1);
  });

  it("isOnboardingComplete returns false when steps remain", () => {
    const state = markStepComplete(getDefaultState(), "org-setup");
    expect(isOnboardingComplete(state)).toBe(false);
  });

  it("isOnboardingComplete returns true when all 4 steps done", () => {
    let state = getDefaultState();
    for (const step of ONBOARDING_STEPS) {
      state = markStepComplete(state, step);
    }
    expect(isOnboardingComplete(state)).toBe(true);
  });

  it("getNextStep returns next step in sequence", () => {
    const state: OnboardingState = {
      currentStep: "art-setup",
      completedSteps: ["org-setup"],
      data: {},
    };
    expect(getNextStep(state)).toBe("invite-members");
  });

  it("getNextStep returns null at last step", () => {
    const state: OnboardingState = {
      currentStep: "connect-integration",
      completedSteps: ["org-setup", "art-setup", "invite-members"],
      data: {},
    };
    expect(getNextStep(state)).toBeNull();
  });
});

describe("onboarding wizard resumability (AC-002)", () => {
  it("resumeAtStep returns currentStep", () => {
    const state: OnboardingState = {
      currentStep: "invite-members",
      completedSteps: ["org-setup", "art-setup"],
      data: { orgName: "Acme", artId: "art-1" },
    };
    expect(resumeAtStep(state)).toBe("invite-members");
  });

  it("isStepCompleted returns correct status per step", () => {
    const state: OnboardingState = {
      currentStep: "invite-members",
      completedSteps: ["org-setup", "art-setup"],
      data: {},
    };
    expect(isStepCompleted(state, "org-setup")).toBe(true);
    expect(isStepCompleted(state, "art-setup")).toBe(true);
    expect(isStepCompleted(state, "invite-members")).toBe(false);
    expect(isStepCompleted(state, "connect-integration")).toBe(false);
  });
});

// ─── Health metric aggregation (AC-003, AC-004) ───────────────────────────────

describe("aggregateSettled (AC-003)", () => {
  it("fulfilled result maps to healthy", () => {
    const result = aggregateSettled({
      status: "fulfilled",
      value: { latency: 5 },
    });
    expect(result.status).toBe("healthy");
    expect(result.value).toEqual({ latency: 5 });
  });

  it("rejected result maps to unavailable with error message", () => {
    const result = aggregateSettled({
      status: "rejected",
      reason: new Error("connection refused"),
    });
    expect(result.status).toBe("unavailable");
    expect(result.error).toContain("connection refused");
  });

  it("rejected non-Error maps to unavailable", () => {
    const result = aggregateSettled({ status: "rejected", reason: "timeout" });
    expect(result.status).toBe("unavailable");
    expect(result.error).toBe("timeout");
  });
});

describe("overallStatus (AC-003)", () => {
  it("all healthy → healthy", () => {
    const results = [
      { status: "healthy" as const },
      { status: "healthy" as const },
    ];
    expect(overallStatus(results)).toBe("healthy");
  });

  it("any unavailable → unavailable", () => {
    const results = [
      { status: "healthy" as const },
      { status: "unavailable" as const, error: "down" },
    ];
    expect(overallStatus(results)).toBe("unavailable");
  });

  it("mix of healthy/degraded → degraded", () => {
    const results = [
      { status: "healthy" as const },
      { status: "degraded" as const },
    ];
    expect(overallStatus(results)).toBe("degraded");
  });

  it("aggregateAll processes all results", () => {
    const settled: PromiseSettledResult<number>[] = [
      { status: "fulfilled", value: 42 },
      { status: "rejected", reason: new Error("oops") },
    ];
    const results = aggregateAll(settled);
    expect(results).toHaveLength(2);
    expect(results[0]?.status).toBe("healthy");
    expect(results[1]?.status).toBe("unavailable");
  });
});

// ─── Fallback queue (AC-008) ──────────────────────────────────────────────────

describe("JobFallbackQueue (AC-008)", () => {
  it("buildQueueEntry creates PENDING entry", () => {
    const entry = buildQueueEntry("billing-sync", { tenantId: "t1" });
    expect(entry.status).toBe("PENDING");
    expect(entry.jobType).toBe("billing-sync");
  });

  it("buildQueueEntry includes tenantId when provided", () => {
    const entry = buildQueueEntry("webhook-delivery", {}, "tenant-abc");
    expect(entry.tenantId).toBe("tenant-abc");
  });

  it("isInngestUnavailable detects ECONNREFUSED", () => {
    expect(isInngestUnavailable(new Error("ECONNREFUSED 127.0.0.1:8288"))).toBe(
      true
    );
  });

  it("isInngestUnavailable detects fetch failed", () => {
    expect(isInngestUnavailable(new Error("fetch failed"))).toBe(true);
  });

  it("isInngestUnavailable returns false for non-network errors", () => {
    expect(isInngestUnavailable(new Error("invalid payload"))).toBe(false);
  });

  it("isInngestUnavailable returns false for non-Error", () => {
    expect(isInngestUnavailable("some string")).toBe(false);
  });

  it("shouldDrainEntry true for PENDING and FAILED", () => {
    expect(
      shouldDrainEntry({ jobType: "x", payload: {}, status: "PENDING" })
    ).toBe(true);
    expect(
      shouldDrainEntry({ jobType: "x", payload: {}, status: "FAILED" })
    ).toBe(true);
  });

  it("shouldDrainEntry false for DONE and PROCESSING", () => {
    expect(
      shouldDrainEntry({ jobType: "x", payload: {}, status: "DONE" })
    ).toBe(false);
    expect(
      shouldDrainEntry({ jobType: "x", payload: {}, status: "PROCESSING" })
    ).toBe(false);
  });
});
