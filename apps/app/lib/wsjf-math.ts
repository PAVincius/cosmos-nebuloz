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

// Modified Fibonacci set — the ONLY values scoreWsjfAction
// (app/actions/wsjf/score.ts) accepts for bv/tc/rr/js. That file has
// "use server", which permits only async function exports, so this is the
// shared source of truth both it and any client component (e.g.
// ScenarioSimulatorModal's sliders) import from, instead of each hardcoding
// the literal and risking drift.
export const WSJF_FIBONACCI_VALUES = [1, 2, 3, 5, 8, 13, 20] as const;

// Index of the closest Modified Fibonacci value to an arbitrary number —
// backs index-based slider stepping so a slider always snaps onto the set
// even when the starting value (e.g. legacy/seed data) isn't already on it.
export function closestWsjfFibonacciIndex(value: number): number {
  let closest = 0;
  let minDiff = Number.POSITIVE_INFINITY;
  for (const [index, fib] of WSJF_FIBONACCI_VALUES.entries()) {
    const diff = Math.abs(fib - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = index;
    }
  }
  return closest;
}
