// Roadmap scenario management — story-031 pure logic

export const MAX_SCENARIOS_PER_ART_PER_YEAR = 5;

export type RoadmapItem = {
  id: string;
  epicId: string;
  artId: string | null;
  quarter: number;
  year: number;
  confidence: number;
  scenarioName: string | null;
};

export type ScenarioDiff = {
  added: RoadmapItem[];
  removed: RoadmapItem[];
  modified: Array<{ base: RoadmapItem; scenario: RoadmapItem }>;
};

export function exceedsScenarioLimit(count: number): boolean {
  return count >= MAX_SCENARIOS_PER_ART_PER_YEAR;
}

export function deepCopyScenario(
  items: RoadmapItem[],
  newName: string
): Omit<RoadmapItem, "id">[] {
  return items.map(({ id: _id, ...rest }) => ({
    ...rest,
    scenarioName: newName,
  }));
}

export function diffScenarios(
  base: RoadmapItem[],
  scenario: RoadmapItem[]
): ScenarioDiff {
  const baseByEpic = new Map(base.map((i) => [i.epicId, i]));
  const scenarioByEpic = new Map(scenario.map((i) => [i.epicId, i]));

  const added: RoadmapItem[] = [];
  const removed: RoadmapItem[] = [];
  const modified: ScenarioDiff["modified"] = [];

  for (const [epicId, item] of scenarioByEpic) {
    const baseItem = baseByEpic.get(epicId);
    if (!baseItem) {
      added.push(item);
    } else if (
      baseItem.quarter !== item.quarter ||
      baseItem.year !== item.year ||
      baseItem.confidence !== item.confidence
    ) {
      modified.push({ base: baseItem, scenario: item });
    }
  }

  for (const [epicId, item] of baseByEpic) {
    if (!scenarioByEpic.has(epicId)) {
      removed.push(item);
    }
  }

  return { added, removed, modified };
}
