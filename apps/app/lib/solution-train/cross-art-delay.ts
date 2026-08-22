// Cross-ART dependency delay detection (story-043 AC-002)

type CrossArtDepType = "PROVIDES" | "NEEDS" | "BLOCKS";

export type SprintIndexedDep = {
  dependencyId: string;
  sourceFeatureId: string;
  targetFeatureId: string;
  sourceSprintIdx: number;
  targetSprintIdx: number;
  type: CrossArtDepType;
};

export type CrossArtDelayAlert = {
  dependencyId: string;
  sourceFeatureId: string;
  targetFeatureId: string;
  delayedBy: number;
};

export function detectDelayedDependencies(
  deps: SprintIndexedDep[]
): CrossArtDelayAlert[] {
  return deps
    .filter((d) => d.type === "NEEDS" && d.targetSprintIdx > d.sourceSprintIdx)
    .map((d) => ({
      dependencyId: d.dependencyId,
      sourceFeatureId: d.sourceFeatureId,
      targetFeatureId: d.targetFeatureId,
      delayedBy: d.targetSprintIdx - d.sourceSprintIdx,
    }));
}
