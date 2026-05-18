import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type RankedFile = {
  filePath: string;
  uncoveredLines: number;
  totalLines: number;
  importCount: number;
  riskScore: number;
  coveragePct: number;
};

type CoverageEntry = {
  lines: { total: number; covered: number; pct: number };
};

type JsonSummary = Record<string, CoverageEntry>;

const COVERAGE_PATHS = [
  "apps/app/coverage/json-summary.json",
  "apps/api/coverage/json-summary.json",
  "packages/safe-engine/coverage/json-summary.json",
];

export function computeRiskScore(
  importCount: number,
  totalLines: number,
  coveredLines: number
): number {
  if (importCount === 0 || totalLines === 0) {
    return 0;
  }
  const uncoveredRatio = (totalLines - coveredLines) / totalLines;
  return importCount * uncoveredRatio;
}

function getImportCount(fileName: string, repoRoot: string): number {
  const result = spawnSync(
    "grep",
    ["-rl", fileName, repoRoot, "--include=*.ts", "--include=*.tsx"],
    { encoding: "utf-8", timeout: 5000 }
  );
  if (result.error || result.status !== 0) {
    return 0;
  }
  const lines = result.stdout.split("\n").filter(Boolean);
  return Math.max(0, lines.length - 1);
}

function parseReportFile(fullPath: string, repoRoot: string): RankedFile[] {
  let report: JsonSummary;
  try {
    report = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as JsonSummary;
  } catch {
    return [];
  }

  const files: RankedFile[] = [];
  for (const [filePath, coverage] of Object.entries(report)) {
    if (
      filePath === "total" ||
      !fs.existsSync(filePath) ||
      coverage.lines.total === 0 ||
      coverage.lines.pct >= 80
    ) {
      continue;
    }

    const uncoveredLines = coverage.lines.total - coverage.lines.covered;
    const fileName = path.basename(filePath, path.extname(filePath));
    const importCount = getImportCount(fileName, repoRoot);
    const riskScore = computeRiskScore(
      importCount,
      coverage.lines.total,
      coverage.lines.covered
    );

    files.push({
      filePath,
      uncoveredLines,
      totalLines: coverage.lines.total,
      importCount,
      riskScore,
      coveragePct: coverage.lines.pct,
    });
  }
  return files;
}

export function parseCoverage(repoRoot: string): RankedFile[] {
  const files: RankedFile[] = [];

  for (const coveragePath of COVERAGE_PATHS) {
    const fullPath = path.join(repoRoot, coveragePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }
    files.push(...parseReportFile(fullPath, repoRoot));
  }

  return files.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
}
