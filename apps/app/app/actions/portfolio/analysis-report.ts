// ─── buildPortfolioReport (pure) ──────────────────────────────────────────────

type EpicResult = {
  epicId: string;
  status: "COMPLETE" | "UNAVAILABLE";
  reason?: string;
  investScore?: number;
};

export function buildPortfolioReport(
  results: EpicResult[],
  priorReportJson?: { epicCategories?: Record<string, string> }
): {
  completionStatus: "COMPLETE" | "PARTIAL_SUCCESS";
  skippedEpics: EpicResult[];
  changes: { epicId: string; from: string; to: string }[];
} {
  const skippedEpics = results.filter((r) => r.status === "UNAVAILABLE");
  const completionStatus =
    skippedEpics.length > 0 ? "PARTIAL_SUCCESS" : "COMPLETE";

  // AC-009: change diff vs prior report
  const changes: { epicId: string; from: string; to: string }[] = [];
  if (priorReportJson?.epicCategories) {
    for (const result of results) {
      if (result.status !== "COMPLETE") {
        continue;
      }
      const category =
        result.investScore !== undefined
          ? result.investScore >= 70
            ? "READY"
            : result.investScore >= 40
              ? "NEEDS_WORK"
              : "NOT_READY"
          : "UNKNOWN";
      const prior = priorReportJson.epicCategories[result.epicId];
      if (prior && prior !== category) {
        changes.push({ epicId: result.epicId, from: prior, to: category });
      }
    }
  }

  return { completionStatus, skippedEpics, changes };
}
