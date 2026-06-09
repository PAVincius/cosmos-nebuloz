import { describe, expect, it } from "vitest";
import {
  detectDelayedDependencies,
  type SprintIndexedDep,
} from "../../lib/solution-train/cross-art-delay";
import {
  filterByThreshold,
  type RiskSuggestion,
  ROAM_SIMILARITY_THRESHOLD,
  topN,
} from "../../lib/solution-train/roam-suggest";
import {
  daysStale,
  filterStaleFeatures,
  isFeatureStale,
  STALE_THRESHOLD_DAYS,
} from "../../lib/solution-train/staleness";
import { checkSolutionWriteAccess } from "../../lib/solution-train/ste-guard";

// ─── Cross-ART delay detection (AC-002) ──────────────────────────────────────

describe("detectDelayedDependencies (AC-002)", () => {
  const mkDep = (
    id: string,
    type: SprintIndexedDep["type"],
    srcIdx: number,
    tgtIdx: number
  ): SprintIndexedDep => ({
    dependencyId: id,
    sourceFeatureId: `F-src-${id}`,
    targetFeatureId: `F-tgt-${id}`,
    sourceSprintIdx: srcIdx,
    targetSprintIdx: tgtIdx,
    type,
  });

  it("detects NEEDS dep where target sprint > source sprint", () => {
    const deps = [mkDep("d1", "NEEDS", 3, 4)];
    const alerts = detectDelayedDependencies(deps);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      dependencyId: "d1",
      delayedBy: 1,
    });
  });

  it("ignores NEEDS dep in same sprint (no delay)", () => {
    const deps = [mkDep("d2", "NEEDS", 3, 3)];
    expect(detectDelayedDependencies(deps)).toHaveLength(0);
  });

  it("ignores NEEDS dep where target is earlier (provider ahead)", () => {
    const deps = [mkDep("d3", "NEEDS", 4, 3)];
    expect(detectDelayedDependencies(deps)).toHaveLength(0);
  });

  it("ignores PROVIDES dep regardless of sprint order", () => {
    const deps = [mkDep("d4", "PROVIDES", 2, 5)];
    expect(detectDelayedDependencies(deps)).toHaveLength(0);
  });

  it("ignores BLOCKS dep", () => {
    const deps = [mkDep("d5", "BLOCKS", 1, 4)];
    expect(detectDelayedDependencies(deps)).toHaveLength(0);
  });

  it("calculates delayedBy correctly", () => {
    const deps = [mkDep("d6", "NEEDS", 1, 5)];
    const alerts = detectDelayedDependencies(deps);
    expect(alerts[0]?.delayedBy).toBe(4);
  });

  it("processes multiple deps and returns only delayed ones", () => {
    const deps = [
      mkDep("ok1", "NEEDS", 2, 2),
      mkDep("delay1", "NEEDS", 2, 3),
      mkDep("ok2", "PROVIDES", 1, 5),
      mkDep("delay2", "NEEDS", 1, 4),
    ];
    const alerts = detectDelayedDependencies(deps);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.dependencyId)).toEqual(
      expect.arrayContaining(["delay1", "delay2"])
    );
  });
});

// ─── ROAM AI-suggest threshold (AC-004) ──────────────────────────────────────

describe("filterByThreshold (AC-004)", () => {
  const mkSuggestion = (id: string, sim: number): RiskSuggestion => ({
    riskId: id,
    title: `Risk ${id}`,
    originalPi: "PI-1",
    originalResolution: "Resolved via X",
    similarity: sim,
  });

  it("threshold default is 0.7", () => {
    expect(ROAM_SIMILARITY_THRESHOLD).toBe(0.7);
  });

  it("includes suggestions at exactly 0.7", () => {
    const result = filterByThreshold([mkSuggestion("r1", 0.7)]);
    expect(result).toHaveLength(1);
  });

  it("excludes suggestions below 0.7", () => {
    const result = filterByThreshold([mkSuggestion("r2", 0.69)]);
    expect(result).toHaveLength(0);
  });

  it("includes high-similarity suggestions", () => {
    const result = filterByThreshold([
      mkSuggestion("r3", 0.95),
      mkSuggestion("r4", 0.82),
    ]);
    expect(result).toHaveLength(2);
  });

  it("topN returns top 3 sorted by similarity", () => {
    const suggestions = [
      mkSuggestion("a", 0.75),
      mkSuggestion("b", 0.92),
      mkSuggestion("c", 0.85),
      mkSuggestion("d", 0.71),
    ];
    const top = topN(filterByThreshold(suggestions), 3);
    expect(top).toHaveLength(3);
    expect(top[0]?.riskId).toBe("b");
    expect(top[1]?.riskId).toBe("c");
    expect(top[2]?.riskId).toBe("a");
  });
});

// ─── STE role guard (AC-005) ─────────────────────────────────────────────────

describe("checkSolutionWriteAccess (AC-005)", () => {
  it("allows STE", () => {
    const result = checkSolutionWriteAccess("STE");
    expect(result.allowed).toBe(true);
  });

  it("allows ENTERPRISE_ARCHITECT", () => {
    const result = checkSolutionWriteAccess("ENTERPRISE_ARCHITECT");
    expect(result.allowed).toBe(true);
  });

  it("denies SCRUM_MASTER with SOLUTION_TRAIN_ACCESS_REQUIRED", () => {
    const result = checkSolutionWriteAccess("SCRUM_MASTER");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("SOLUTION_TRAIN_ACCESS_REQUIRED");
    }
  });

  it("denies MEMBER", () => {
    const result = checkSolutionWriteAccess("MEMBER");
    expect(result.allowed).toBe(false);
  });

  it("denies RTE (ART role only — not solution-level write)", () => {
    const result = checkSolutionWriteAccess("RTE");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe("SOLUTION_TRAIN_ACCESS_REQUIRED");
    }
  });
});

// ─── Staleness detection (AC-008) ────────────────────────────────────────────

describe("staleness detection (AC-008)", () => {
  const NOW = new Date("2026-06-09T10:00:00Z");

  it("STALE_THRESHOLD_DAYS is 14", () => {
    expect(STALE_THRESHOLD_DAYS).toBe(14);
  });

  it("feature last updated 15 days ago is stale", () => {
    const updatedAt = new Date(NOW);
    updatedAt.setDate(updatedAt.getDate() - 15);
    expect(isFeatureStale(updatedAt, NOW)).toBe(true);
  });

  it("feature last updated exactly 14 days ago is stale", () => {
    const updatedAt = new Date(NOW);
    updatedAt.setDate(updatedAt.getDate() - 14);
    expect(isFeatureStale(updatedAt, NOW)).toBe(true);
  });

  it("feature last updated 13 days ago is NOT stale", () => {
    const updatedAt = new Date(NOW);
    updatedAt.setDate(updatedAt.getDate() - 13);
    expect(isFeatureStale(updatedAt, NOW)).toBe(false);
  });

  it("daysStale returns correct day count", () => {
    const updatedAt = new Date(NOW);
    updatedAt.setDate(updatedAt.getDate() - 20);
    expect(daysStale(updatedAt, NOW)).toBe(20);
  });

  it("filterStaleFeatures returns only stale features", () => {
    const stale = new Date(NOW);
    stale.setDate(stale.getDate() - 20);
    const fresh = new Date(NOW);
    fresh.setDate(fresh.getDate() - 5);

    const features = [
      { id: "f1", updatedAt: stale },
      { id: "f2", updatedAt: fresh },
      { id: "f3", updatedAt: stale },
    ];

    const result = filterStaleFeatures(features, NOW);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id)).toEqual(["f1", "f3"]);
  });
});
