import { describe, expect, it } from "vitest";
import {
  buildAncestorBreadcrumb,
  type DagNode,
  detectAlignmentGaps,
  findOrphans,
  findUnlinkedEpics,
} from "../../lib/strategy/dag";
import {
  deepCopyScenario,
  diffScenarios,
  exceedsScenarioLimit,
  MAX_SCENARIOS_PER_ART_PER_YEAR,
  type RoadmapItem,
} from "../../lib/strategy/scenario";

// ─── Strategy Map DAG (AC-001) ────────────────────────────────────────────────

const mkNode = (
  id: string,
  type: DagNode["type"],
  parentId: string | null = null
): DagNode => ({ id, type, parentId });

describe("findOrphans (AC-001)", () => {
  it("returns empty when all parents exist", () => {
    const nodes = [
      mkNode("t1", "THEME"),
      mkNode("o1", "OKR", "t1"),
      mkNode("e1", "EPIC", "o1"),
    ];
    expect(findOrphans(nodes)).toHaveLength(0);
  });

  it("detects node with missing parent", () => {
    const nodes = [mkNode("e1", "EPIC", "nonexistent")];
    expect(findOrphans(nodes).map((n) => n.id)).toContain("e1");
  });

  it("nodes with null parentId are not orphans", () => {
    const nodes = [mkNode("t1", "THEME", null)];
    expect(findOrphans(nodes)).toHaveLength(0);
  });
});

describe("findUnlinkedEpics (AC-001)", () => {
  it("finds epics with null parentId", () => {
    const nodes = [
      mkNode("t1", "THEME"),
      mkNode("e1", "EPIC", null),
      mkNode("e2", "EPIC", "t1"),
    ];
    expect(findUnlinkedEpics(nodes)).toEqual(["e1"]);
  });

  it("returns empty when all epics linked", () => {
    const nodes = [mkNode("e1", "EPIC", "t1")];
    expect(findUnlinkedEpics(nodes)).toHaveLength(0);
  });
});

describe("detectAlignmentGaps (AC-001)", () => {
  it("UNLINKED_EPIC gap for unlinked epic", () => {
    const nodes = [mkNode("e1", "EPIC", null)];
    const gaps = detectAlignmentGaps(nodes, []);
    expect(
      gaps.some((g) => g.type === "UNLINKED_EPIC" && g.entityId === "e1")
    ).toBe(true);
  });

  it("OKR_AT_RISK gap for at-risk OKRs", () => {
    const gaps = detectAlignmentGaps([], ["okr1", "okr2"]);
    expect(gaps.filter((g) => g.type === "OKR_AT_RISK")).toHaveLength(2);
  });

  it("no gaps for clean graph", () => {
    const nodes = [mkNode("e1", "EPIC", "t1")];
    expect(detectAlignmentGaps(nodes, [])).toHaveLength(0);
  });
});

describe("buildAncestorBreadcrumb (AC-001)", () => {
  it("returns chain from root to node", () => {
    const nodes = [
      mkNode("t1", "THEME"),
      mkNode("o1", "OKR", "t1"),
      mkNode("e1", "EPIC", "o1"),
    ];
    expect(buildAncestorBreadcrumb(nodes, "e1")).toEqual(["t1", "o1", "e1"]);
  });

  it("single node breadcrumb", () => {
    const nodes = [mkNode("t1", "THEME")];
    expect(buildAncestorBreadcrumb(nodes, "t1")).toEqual(["t1"]);
  });

  it("missing node returns empty breadcrumb", () => {
    expect(buildAncestorBreadcrumb([], "missing")).toEqual([]);
  });
});

// ─── Roadmap scenarios (AC-002) ───────────────────────────────────────────────

const mkItem = (
  epicId: string,
  q: number,
  y: number,
  confidence = 80
): RoadmapItem => ({
  id: `ri-${epicId}`,
  epicId,
  artId: "art1",
  quarter: q,
  year: y,
  confidence,
  scenarioName: null,
});

describe("exceedsScenarioLimit (AC-002)", () => {
  it("MAX_SCENARIOS_PER_ART_PER_YEAR is 5", () => {
    expect(MAX_SCENARIOS_PER_ART_PER_YEAR).toBe(5);
  });

  it("false at 4, true at 5", () => {
    expect(exceedsScenarioLimit(4)).toBe(false);
    expect(exceedsScenarioLimit(5)).toBe(true);
  });
});

describe("deepCopyScenario (AC-002)", () => {
  it("assigns new scenario name", () => {
    const items = [mkItem("ep1", 1, 2026)];
    const copy = deepCopyScenario(items, "optimistic");
    expect(copy[0]?.scenarioName).toBe("optimistic");
  });

  it("strips original id", () => {
    const items = [mkItem("ep1", 1, 2026)];
    const copy = deepCopyScenario(items, "s1");
    expect(copy[0]).not.toHaveProperty("id");
  });

  it("preserves other fields", () => {
    const items = [mkItem("ep1", 2, 2026, 70)];
    const copy = deepCopyScenario(items, "s1");
    expect(copy[0]?.quarter).toBe(2);
    expect(copy[0]?.confidence).toBe(70);
  });
});

describe("diffScenarios (AC-002)", () => {
  it("detects added items", () => {
    const base = [mkItem("ep1", 1, 2026)];
    const scenario = [mkItem("ep1", 1, 2026), mkItem("ep2", 2, 2026)];
    const diff = diffScenarios(base, scenario);
    expect(diff.added.map((i) => i.epicId)).toContain("ep2");
  });

  it("detects removed items", () => {
    const base = [mkItem("ep1", 1, 2026), mkItem("ep2", 2, 2026)];
    const scenario = [mkItem("ep1", 1, 2026)];
    const diff = diffScenarios(base, scenario);
    expect(diff.removed.map((i) => i.epicId)).toContain("ep2");
  });

  it("detects modified quarter", () => {
    const base = [mkItem("ep1", 1, 2026)];
    const scenario = [mkItem("ep1", 3, 2026)];
    const diff = diffScenarios(base, scenario);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.scenario.quarter).toBe(3);
  });

  it("no diff for identical scenarios", () => {
    const items = [mkItem("ep1", 1, 2026)];
    const diff = diffScenarios(items, [...items]);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });
});
