// Story-022: Monte Carlo throughput forecasting

export type ForecastResult = {
  p50: number;
  p70: number;
  p85: number;
  p95: number;
};

const SAFETY_CAP = 100;
const DEFAULT_ITERATIONS = 1000;

export function monteCarloForecast(
  historicalThroughput: number[],
  remainingItems: number,
  iterations: number = DEFAULT_ITERATIONS
): ForecastResult {
  if (historicalThroughput.length === 0) {
    throw new Error(
      "INSUFFICIENT_DATA: historicalThroughput must not be empty"
    );
  }

  const completionSprints: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    let remaining = remainingItems;
    let sprintsNeeded = 0;

    while (remaining > 0) {
      const idx = Math.floor(Math.random() * historicalThroughput.length);
      remaining -= historicalThroughput[idx];
      sprintsNeeded += 1;
      if (sprintsNeeded > SAFETY_CAP) {
        break;
      }
    }
    completionSprints.push(sprintsNeeded);
  }

  completionSprints.sort((a, b) => a - b);

  return {
    p50: completionSprints[Math.floor(iterations * 0.5)],
    p70: completionSprints[Math.floor(iterations * 0.7)],
    p85: completionSprints[Math.floor(iterations * 0.85)],
    p95: completionSprints[Math.floor(iterations * 0.95)],
  };
}

// ─── Weighted average aggregation ─────────────────────────────────────────────

export function computeWeightedAverage(
  items: { value: number; weight: number }[]
): number {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight === 0) {
    return 0;
  }
  const weightedSum = items.reduce((s, i) => s + i.value * i.weight, 0);
  return weightedSum / totalWeight;
}

// ─── Cycle time outlier detection (median + 2×IQR) ───────────────────────────

export type OutlierResult = {
  q1: number;
  median: number;
  q3: number;
  iqr: number;
  upperFence: number;
  outlierIndices: number[];
};

export function detectCycleTimeOutliers(cycleTimes: number[]): OutlierResult {
  if (cycleTimes.length === 0) {
    return {
      q1: 0,
      median: 0,
      q3: 0,
      iqr: 0,
      upperFence: 0,
      outlierIndices: [],
    };
  }

  const sorted = [...cycleTimes].sort((a, b) => a - b);
  const n = sorted.length;

  const percentile = (p: number): number => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi
      ? sorted[lo]
      : sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
  };

  const q1 = percentile(0.25);
  const median = percentile(0.5);
  const q3 = percentile(0.75);
  const iqr = q3 - q1;
  const upperFence = median + 2 * iqr;

  const outlierIndices = cycleTimes
    .map((v, i) => (v > upperFence ? i : -1))
    .filter((i) => i !== -1);

  return { q1, median, q3, iqr, upperFence, outlierIndices };
}

// ─── PI benchmark comparison ──────────────────────────────────────────────────

export type BenchmarkComparison = {
  teamId: string;
  priorCycleTime: number;
  currentCycleTime: number;
  changePct: number;
  status: "RED" | "GREEN" | "NEUTRAL";
};

const RED_THRESHOLD = 0.2; // > 20% increase = red
const GREEN_THRESHOLD = 0.1; // > 10% improvement = green

export function computeBenchmarkComparisons(
  data: { teamId: string; priorCycleTime: number; currentCycleTime: number }[]
): BenchmarkComparison[] {
  return data.map((row) => {
    const changePct =
      row.priorCycleTime > 0
        ? (row.currentCycleTime - row.priorCycleTime) / row.priorCycleTime
        : 0;

    let status: "RED" | "GREEN" | "NEUTRAL" = "NEUTRAL";
    if (changePct > RED_THRESHOLD) {
      status = "RED";
    } else if (changePct < -GREEN_THRESHOLD) {
      status = "GREEN";
    }

    return { ...row, changePct, status };
  });
}
