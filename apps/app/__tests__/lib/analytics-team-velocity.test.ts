// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTeamVelocityRows } from "../../lib/analytics-team-velocity";

// Helpers
function makeTeam(id: string, velocity: number | null = null) {
  return { id, name: `Team ${id}`, velocity };
}

function makeSprint(teamId: string, points: (number | null)[]) {
  return {
    teamId,
    endDate: new Date(),
    stories: points.map((p) => ({ storyPoints: p })),
  };
}

describe("buildTeamVelocityRows", () => {
  it("returns [] when teams array is empty", () => {
    expect(buildTeamVelocityRows([], [])).toEqual([]);
  });

  it("returns correct velocity sums for a team with 6 sprints", () => {
    const team = makeTeam("t1", 0);
    // Sprints already desc from DB; slice(0,6) → all 6; reverse → asc for display
    const sprints = [
      makeSprint("t1", [3, 2]), // most recent → index 0 after slice
      makeSprint("t1", [5]),
      makeSprint("t1", [1, 1]),
      makeSprint("t1", [4]),
      makeSprint("t1", [2, 2]),
      makeSprint("t1", [10]), // oldest → index 5 after slice
    ];
    const rows = buildTeamVelocityRows([team], sprints);
    expect(rows).toHaveLength(1);
    // After slice(0,6).reverse() → oldest first: [10, 4, 2, 1+1, 5, 3+2]
    expect(rows[0].sprints).toEqual([10, 4, 4, 2, 5, 5]);
  });

  it("pads with nulls when team has fewer than 6 sprints", () => {
    const team = makeTeam("t2", 0);
    const sprints = [makeSprint("t2", [3]), makeSprint("t2", [7])];
    const rows = buildTeamVelocityRows([team], sprints);
    expect(rows).toHaveLength(1);
    // slice(0,6) = both, reverse → oldest first: [7, 3], rest null
    expect(rows[0].sprints).toEqual([7, 3, null, null, null, null]);
  });

  it("excludes team with null velocity AND no sprints (hasData = false)", () => {
    const team = makeTeam("t3", null);
    const rows = buildTeamVelocityRows([team], []);
    expect(rows).toEqual([]);
  });

  it("includes team with velocity > 0 even when no sprints exist", () => {
    const team = makeTeam("t4", 42);
    const rows = buildTeamVelocityRows([team], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].velocity).toBe(42);
    expect(rows[0].sprints).toEqual([null, null, null, null, null, null]);
  });

  it("correctly groups sprints by teamId for multiple teams", () => {
    const t1 = makeTeam("team-a", 0);
    const t2 = makeTeam("team-b", 0);
    const sprints = [
      makeSprint("team-a", [5]),
      makeSprint("team-b", [8]),
      makeSprint("team-a", [3]),
    ];
    const rows = buildTeamVelocityRows([t1, t2], sprints);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.id === "team-a")!;
    const b = rows.find((r) => r.id === "team-b")!;
    // team-a: slice(0,6)=[5,3].reverse()=[3,5], rest null
    expect(a.sprints).toEqual([3, 5, null, null, null, null]);
    // team-b: slice(0,6)=[8].reverse()=[8], rest null
    expect(b.sprints).toEqual([8, null, null, null, null, null]);
  });

  it("treats null storyPoints as 0", () => {
    const team = makeTeam("t5", 0);
    const sprints = [makeSprint("t5", [null, null, 5])];
    const rows = buildTeamVelocityRows([team], sprints);
    // null story points → 0; sum = 5
    expect(rows[0].sprints[0]).toBe(5);
  });

  it("uses only the 6 most recent sprints when more than 6 exist", () => {
    const team = makeTeam("t6", 0);
    // 8 sprints desc from DB; slice(0,6) takes first 6 (most recent)
    const sprints = [
      makeSprint("t6", [1]), // most recent
      makeSprint("t6", [2]),
      makeSprint("t6", [3]),
      makeSprint("t6", [4]),
      makeSprint("t6", [5]),
      makeSprint("t6", [6]), // 6th most recent — included
      makeSprint("t6", [7]), // 7th — excluded
      makeSprint("t6", [8]), // 8th — excluded
    ];
    const rows = buildTeamVelocityRows([team], sprints);
    expect(rows[0].sprints).toHaveLength(6);
    // reversed for display: oldest→newest: 6,5,4,3,2,1
    expect(rows[0].sprints).toEqual([6, 5, 4, 3, 2, 1]);
    // values 7 and 8 must NOT appear
    expect(rows[0].sprints).not.toContain(7);
    expect(rows[0].sprints).not.toContain(8);
  });
});
