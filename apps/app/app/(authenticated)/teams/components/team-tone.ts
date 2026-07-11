// ART → tone mapping (screens-team.js: DB.teams[].tone). Mirrors the same
// convention already used in
// portfolio/roadmap/components/roadmap-gantt-utils.ts (KNOWN_ART_TONE /
// LANE_TONE_CYCLE) so ART colors stay consistent across screens.
export type TeamTone = "blue" | "purple" | "green" | "amber";

const KNOWN_ART_TONE: Record<string, TeamTone> = {
  Payments: "blue",
  Platform: "purple",
  Growth: "green",
  "Data & AI": "amber",
};

const TONE_CYCLE: TeamTone[] = ["blue", "purple", "green", "amber"];

export function toneForArt(artName: string | undefined, index: number): TeamTone {
  if (artName && KNOWN_ART_TONE[artName]) {
    return KNOWN_ART_TONE[artName];
  }
  return TONE_CYCLE[index % TONE_CYCLE.length];
}

/**
 * Deterministic mock flow efficiency based on team name — no stored metric
 * exists for this yet. Same formula as
 * arts/[artId]/components/team-health-grid.tsx so a given team shows the
 * same flow-eff number on both screens.
 */
export function mockFlowEfficiency(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return 49 + (hash % 40); // 49–88%
}
