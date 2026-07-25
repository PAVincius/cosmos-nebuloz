// Fan-out batch job aggregation (story-045 AC-008)

export type SubJobResult = {
  artId: string;
  success: boolean;
  error?: string;
};

export type FanOutSummary = {
  completed: number;
  failed: number;
  errors: Array<{ artId: string; reason: string }>;
};

export function aggregateFanOut(results: SubJobResult[]): FanOutSummary {
  let completed = 0;
  const errors: FanOutSummary["errors"] = [];

  for (const r of results) {
    if (r.success) {
      completed++;
    } else {
      errors.push({ artId: r.artId, reason: r.error ?? "unknown" });
    }
  }

  return { completed, failed: errors.length, errors };
}

export function isPartialSuccess(summary: FanOutSummary): boolean {
  return summary.completed > 0 && summary.failed > 0;
}

export function isFullSuccess(summary: FanOutSummary): boolean {
  return summary.failed === 0 && summary.completed > 0;
}

export function isFullFailure(summary: FanOutSummary): boolean {
  return summary.completed === 0 && summary.failed > 0;
}
