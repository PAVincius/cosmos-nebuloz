// wsjf-math.ts — shared weighted WSJF scoring math.
//
// Byte-identical to app/actions/wsjf/score.ts's formula
// (costOfDelay = bv*weightBv + tc*weightTc + rr*weightRr; score =
// round((costOfDelay/js)*100)/100). Extracted so ScenarioSimulatorModal
// (Task 18) doesn't hand-duplicate the formula a third time — see the
// duplication history in score.ts (Task 16 weights) and
// app/(cosmos)/actions/kanban.ts's computeEpicWsjf (Task 17, unweighted).
// Plain module, no "use server": importable from both client components
// and "use server" action files.

export type WsjfScoreComponents = {
  bv: number;
  tc: number;
  rr: number;
  js: number;
};

export type WsjfWeights = {
  weightBv: number;
  weightTc: number;
  weightRr: number;
};

export function computeWeightedWsjfScore(
  components: WsjfScoreComponents,
  weights: WsjfWeights
): number {
  const costOfDelay =
    components.bv * weights.weightBv +
    components.tc * weights.weightTc +
    components.rr * weights.weightRr;
  return Math.round((costOfDelay / components.js) * 100) / 100;
}
