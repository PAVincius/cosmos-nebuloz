import { spawnSync } from "node:child_process";
import path from "node:path";
import { selectModel } from "./lib/model-router.js";
import { formatRiskComment, postPRComment } from "./lib/pr-commenter.js";
import { analyzeRisk } from "./lib/risk-analyzer.js";

const repoRoot = path.resolve(process.cwd());

function getPRDiff(prNumber: string): string {
  const result = spawnSync("gh", ["pr", "diff", prNumber], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30_000,
  });
  if (result.error || result.status !== 0) {
    console.error("Failed to fetch PR diff:", result.stderr);
    return "";
  }
  return result.stdout;
}

function getDiffStats(diff: string): string {
  const added = (diff.match(/^\+[^+]/gm) ?? []).length;
  const removed = (diff.match(/^-[^-]/gm) ?? []).length;
  return `+${added}/-${removed} lines`;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Skipping risk score.");
    process.exit(0);
  }

  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.error("PR_NUMBER not set. Skipping risk score.");
    process.exit(0);
  }

  console.log(`Fetching diff for PR #${prNumber}...`);
  const diff = getPRDiff(prNumber);

  if (!diff.trim()) {
    console.log("Empty diff. Skipping risk score.");
    process.exit(0);
  }

  const model = selectModel(diff);
  const modelKey = model.includes("sonnet") ? "sonnet" : "haiku";
  const diffStats = getDiffStats(diff);

  console.log(`Using model: ${model} | ${diffStats}`);

  const analysis = await analyzeRisk(diff, model);

  if (analysis === null) {
    console.error(
      "Failed to parse risk analysis after retry. Skipping comment."
    );
    process.exit(0);
  }

  console.log(`Risk score: ${analysis.score}`);

  const comment = formatRiskComment(analysis, diffStats, modelKey);
  postPRComment(comment, repoRoot, prNumber);
  console.log("Risk score comment posted.");
}

main().catch((err) => {
  console.error("risk-score failed:", err);
  process.exit(1);
});
