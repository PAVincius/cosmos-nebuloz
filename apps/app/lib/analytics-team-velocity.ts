type Team = { id: string; name: string; velocity: number | null };
type Sprint = {
  teamId: string;
  endDate: Date;
  stories: { storyPoints: number | null }[];
};

export type TeamVelocityRow = {
  id: string;
  name: string;
  velocity: number;
  sprints: (number | null)[];
};

export function buildTeamVelocityRows(
  teams: Team[],
  completedSprints: Sprint[]
): TeamVelocityRow[] {
  const byTeam = new Map<string, Sprint[]>();
  for (const s of completedSprints) {
    const list = byTeam.get(s.teamId) ?? [];
    list.push(s);
    byTeam.set(s.teamId, list);
  }

  const rows: TeamVelocityRow[] = [];
  for (const team of teams) {
    // sprints already ordered desc by endDate from DB — take 6 most recent, reverse for display
    const recent = (byTeam.get(team.id) ?? []).slice(0, 6).reverse();
    const sprints: (number | null)[] = Array.from({ length: 6 }, (_, i) => {
      const s = recent[i];
      if (!s) {
        return null;
      }
      return s.stories.reduce((sum, st) => sum + (st.storyPoints ?? 0), 0);
    });

    const hasData = sprints.some((v) => v !== null) || (team.velocity ?? 0) > 0;
    if (hasData) {
      rows.push({
        id: team.id,
        name: team.name,
        velocity: team.velocity ?? 0,
        sprints,
      });
    }
  }
  return rows;
}
