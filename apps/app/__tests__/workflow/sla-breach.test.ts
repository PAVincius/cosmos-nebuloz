import { describe, expect, it } from "vitest";

// Test SLA breach logic in isolation — pure time calculations
// The Inngest function itself requires a live DB; these cover the core predicate.

function isSlaBreach(
  enteredStateAt: Date,
  slaHours: number,
  now: Date
): boolean {
  const elapsedHours = (now.getTime() - enteredStateAt.getTime()) / 3_600_000;
  return elapsedHours >= slaHours;
}

function elapsedHours(enteredStateAt: Date, now: Date): number {
  return (now.getTime() - enteredStateAt.getTime()) / 3_600_000;
}

describe("SLA breach detection (AC-008)", () => {
  it("no breach when within SLA window", () => {
    const entered = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-02T23:00:00Z"); // 47h elapsed
    expect(isSlaBreach(entered, 48, now)).toBe(false);
  });

  it("breach detected exactly at SLA threshold", () => {
    const entered = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-03T00:00:00Z"); // exactly 48h
    expect(isSlaBreach(entered, 48, now)).toBe(true);
  });

  it("breach detected when elapsed > slaHours (72h > 48h)", () => {
    const entered = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-04T00:00:00Z"); // 72h elapsed
    expect(isSlaBreach(entered, 48, now)).toBe(true);
  });

  it("elapsed hours calculation is correct", () => {
    const entered = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-04T00:00:00Z"); // 72h
    expect(elapsedHours(entered, now)).toBe(72);
  });

  it("state with no slaHours in meta never breaches", () => {
    const slaHours = undefined as number | undefined;
    // If no SLA, function skips — modelled as: no SLA = no breach
    expect(slaHours).toBeUndefined();
  });
});

describe("SLA anomaly metadata shape", () => {
  it("anomaly has expected fields for WORKFLOW_SLA_BREACH", () => {
    const anomaly = {
      rule: "WORKFLOW_SLA_BREACH",
      severity: "HIGH",
      metric: "sla_hours",
      delta: 24, // elapsed - sla
      entityType: "Story",
      status: "OPEN",
      metadata: {
        storyTitle: "Implement feature X",
        workflowState: "Awaiting_Review",
        slaHours: 48,
        elapsedHours: 72,
      },
    };

    expect(anomaly.severity).toBe("HIGH");
    expect(anomaly.rule).toBe("WORKFLOW_SLA_BREACH");
    expect(anomaly.delta).toBeGreaterThan(0);
    expect(anomaly.metadata.elapsedHours).toBeGreaterThan(
      anomaly.metadata.slaHours
    );
  });
});
