import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { RiskAnalysis } from "./risk-analyzer.js";

const MODEL_LABELS: Record<string, string> = {
  haiku: "Claude Haiku 4.5",
  sonnet: "Claude Sonnet 4.6",
};

function formatFindings(findings: RiskAnalysis["security"]): string {
  if (findings.length === 0) {
    return "_No findings_";
  }
  return findings
    .map((f) => `- ${f.severity}: \`${f.location}\` — ${f.risk}`)
    .join("\n");
}

export function formatRiskComment(
  analysis: RiskAnalysis,
  diffStats: string,
  modelKey: string
): string {
  const modelLabel = MODEL_LABELS[modelKey] ?? modelKey;
  const lines: string[] = [
    `## AI Risk Score: ${analysis.score}`,
    "",
    `Model: ${modelLabel} | Diff: ${diffStats}`,
    "",
  ];

  if (analysis.security.length > 0) {
    lines.push("### Security", formatFindings(analysis.security), "");
  }

  if (analysis.regression.length > 0) {
    lines.push("### Regression", formatFindings(analysis.regression), "");
  }

  if (analysis.safe_domain.length > 0) {
    lines.push("### SAFe Domain", formatFindings(analysis.safe_domain), "");
  }

  lines.push("### Summary", analysis.summary, "");

  if (analysis.checklist.length > 0) {
    lines.push(
      "### Checklist before merge",
      ...analysis.checklist.map((item) => `- [ ] ${item}`),
      ""
    );
  }

  lines.push("---", `Generated with ${modelLabel}`);

  return lines.join("\n");
}

export function postPRComment(
  body: string,
  repoRoot: string,
  prNumber: string
): void {
  const bodyFile = path.join(repoRoot, ".github", "_risk_comment.tmp");
  fs.writeFileSync(bodyFile, body, "utf-8");

  try {
    const editResult = spawnSync(
      "gh",
      ["pr", "comment", prNumber, "--edit-last", "--body-file", bodyFile],
      { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );

    if (editResult.status !== 0 || editResult.error) {
      spawnSync("gh", ["pr", "comment", prNumber, "--body-file", bodyFile], {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  } finally {
    if (fs.existsSync(bodyFile)) {
      fs.unlinkSync(bodyFile);
    }
  }
}
