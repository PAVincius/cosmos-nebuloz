import { describe, expect, it } from "vitest";
import {
  computeStaleness,
  type StalenessInput,
} from "@/app/actions/flow-intelligence/staleness-rules";

const NOW = new Date("2026-05-21T10:00:00Z");

function makeInput(overrides: Partial<StalenessInput> = {}): StalenessInput {
  return {
    snapshotRecordedAt: new Date("2026-05-21T10:00:00Z"),
    sprintDurationDays: 14,
    currentSpDelivered: null,
    snapshotSpDelivered: null,
    currentTeamCompositionHash: null,
    snapshotTeamCompositionHash: null,
    latestAssessmentAt: null,
    currentFlowEfficiency: null,
    currentFlowPredictability: null,
    currentFlowLoadRatio: null,
    now: NOW,
    ...overrides,
  };
}

describe("computeStaleness — R1 age rules", () => {
  it("returns FRESH when snapshot is < 2 sprints old", () => {
    const input = makeInput({
      snapshotRecordedAt: new Date("2026-05-08T10:00:00Z"),
    }); // 13 days
    expect(computeStaleness(input).state).toBe("FRESH");
  });

  it("returns AGING when snapshot is 2–4 sprints old", () => {
    const input = makeInput({
      snapshotRecordedAt: new Date("2026-04-22T10:00:00Z"),
    }); // 29 days
    expect(computeStaleness(input).state).toBe("AGING");
    expect(computeStaleness(input).rules).toContain("R1_AGE_AGING");
  });

  it("returns STALE when snapshot is 4–6 sprints old", () => {
    const input = makeInput({
      snapshotRecordedAt: new Date("2026-03-25T10:00:00Z"),
    }); // 57 days
    expect(computeStaleness(input).state).toBe("STALE");
  });

  it("returns CRITICAL when snapshot > 6 sprints old", () => {
    const input = makeInput({
      snapshotRecordedAt: new Date("2026-02-25T10:00:00Z"),
    }); // 85 days
    expect(computeStaleness(input).state).toBe("CRITICAL");
  });
});

describe("computeStaleness — R2 velocity drift", () => {
  it("returns STALE when current SP < 80% of snapshot baseline", () => {
    const input = makeInput({
      currentSpDelivered: 30,
      snapshotSpDelivered: 45,
    }); // 67%
    expect(computeStaleness(input).state).toBe("STALE");
    expect(computeStaleness(input).rules).toContain("R2_VELOCITY_DRIFT");
  });

  it("stays FRESH when velocity drift is within 20%", () => {
    const input = makeInput({
      currentSpDelivered: 37,
      snapshotSpDelivered: 45,
    }); // 82%
    expect(computeStaleness(input).state).toBe("FRESH");
  });
});

describe("computeStaleness — R3 composition change", () => {
  it("returns STALE when hash mismatch", () => {
    const input = makeInput({
      currentTeamCompositionHash: "abc123",
      snapshotTeamCompositionHash: "def456",
    });
    expect(computeStaleness(input).state).toBe("STALE");
    expect(computeStaleness(input).rules).toContain("R3_COMPOSITION_CHANGE");
  });

  it("stays FRESH when hashes match", () => {
    const input = makeInput({
      currentTeamCompositionHash: "abc123",
      snapshotTeamCompositionHash: "abc123",
    });
    expect(computeStaleness(input).state).toBe("FRESH");
  });
});

describe("computeStaleness — R4 assessment age", () => {
  it("returns STALE when latest assessment > 90 days old", () => {
    const input = makeInput({
      latestAssessmentAt: new Date("2026-02-19T10:00:00Z"),
    }); // 91 days
    expect(computeStaleness(input).state).toBe("STALE");
    expect(computeStaleness(input).rules).toContain("R4_ASSESSMENT_AGE");
  });

  it("stays FRESH when assessment < 90 days old", () => {
    const input = makeInput({
      latestAssessmentAt: new Date("2026-03-01T10:00:00Z"),
    }); // 81 days
    expect(computeStaleness(input).state).toBe("FRESH");
  });
});

describe("computeStaleness — R5 multi-metric", () => {
  it("returns STALE when 2+ metrics breach thresholds", () => {
    const input = makeInput({
      currentFlowEfficiency: 0.35, // < 0.4 ✓
      currentFlowPredictability: 0.55, // < 0.6 ✓
      currentFlowLoadRatio: 1.1, // within threshold
    });
    expect(computeStaleness(input).state).toBe("STALE");
    expect(computeStaleness(input).rules).toContain("R5_MULTI_METRIC");
  });

  it("stays FRESH when only 1 metric breaches", () => {
    const input = makeInput({
      currentFlowEfficiency: 0.35,
      currentFlowPredictability: 0.75,
      currentFlowLoadRatio: 1.0,
    });
    expect(computeStaleness(input).state).toBe("FRESH");
  });
});

describe("computeStaleness — priority (highest wins)", () => {
  it("CRITICAL beats STALE", () => {
    const input = makeInput({
      snapshotRecordedAt: new Date("2026-02-25T10:00:00Z"), // 85d = CRITICAL (R1)
      currentSpDelivered: 20,
      snapshotSpDelivered: 45, // also STALE (R2)
    });
    expect(computeStaleness(input).state).toBe("CRITICAL");
  });

  it("accumulates all fired rules", () => {
    const input = makeInput({
      snapshotRecordedAt: new Date("2026-02-25T10:00:00Z"), // CRITICAL
      currentTeamCompositionHash: "abc",
      snapshotTeamCompositionHash: "xyz", // also STALE
    });
    const result = computeStaleness(input);
    expect(result.state).toBe("CRITICAL");
    expect(result.rules).toContain("R1_AGE_CRITICAL");
    expect(result.rules).toContain("R3_COMPOSITION_CHANGE");
  });
});
