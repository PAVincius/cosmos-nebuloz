import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { collectContext } from "./lib/context-collector.js";
import { parseCoverage } from "./lib/coverage-parser.js";
import { createPR } from "./lib/pr-creator.js";
import { generateTest } from "./lib/test-generator.js";

const repoRoot = path.resolve(process.cwd());

function getCurrentSha(): string {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf-8",
    cwd: repoRoot,
  });
  return result.stdout.trim();
}

function getOverallCoveragePct(root: string): number {
  const summaryPaths = [
    path.join(root, "apps/app/coverage/json-summary.json"),
    path.join(root, "apps/api/coverage/json-summary.json"),
    path.join(root, "packages/safe-engine/coverage/json-summary.json"),
  ];
  for (const fullPath of summaryPaths) {
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as {
        total?: { lines?: { pct?: number } };
      };
      if (data.total?.lines?.pct !== undefined) {
        return data.total.lines.pct;
      }
    } catch {
      // file missing or invalid JSON — skip
    }
  }
  return 0;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Skipping test generation.");
    process.exit(0);
  }

  console.log("Parsing coverage reports...");
  const rankedFiles = parseCoverage(repoRoot);

  if (rankedFiles.length === 0) {
    console.log("No uncovered files found. Nothing to generate.");
    process.exit(0);
  }

  const beforePct = getOverallCoveragePct(repoRoot);
  console.log(`Current coverage: ${beforePct}%`);
  console.log(`Generating tests for ${rankedFiles.length} files...`);

  for (const f of rankedFiles) {
    console.log(
      `  ${f.filePath} (risk: ${f.riskScore.toFixed(2)}, coverage: ${f.coveragePct}%)`
    );
  }

  const generatedFiles: Array<{ path: string; content: string }> = [];
  const coveredFiles: string[] = [];

  for (const file of rankedFiles) {
    console.log(`\nProcessing ${file.filePath}...`);
    try {
      const context = await collectContext(file.filePath, repoRoot);
      const generated = await generateTest(context, repoRoot);

      if (generated.testContent.trim().length > 0) {
        generatedFiles.push({
          path: generated.outputPath,
          content: generated.testContent,
        });
        coveredFiles.push(generated.targetFile);
        console.log(`  -> ${generated.outputPath}`);
      }
    } catch (err) {
      console.error(`  Failed for ${file.filePath}:`, err);
    }
  }

  if (generatedFiles.length === 0) {
    console.log("No tests generated. Exiting without creating PR.");
    process.exit(0);
  }

  const sha = getCurrentSha();
  const fileList = coveredFiles.map((f) => `- \`${f}\``).join("\n");

  const body = `Coverage below 60%. Claude Haiku 4.5 generated tests for the ${coveredFiles.length} highest-risk uncovered files.

**Coverage before:** ${beforePct}%

**Files covered:**
${fileList}

Review before merge — AI-generated tests may have false positives or incorrect assertions.

Generated with Claude Haiku 4.5`;

  createPR({
    branch: `ai/tests/${sha}`,
    title: "test(ai): generate tests for uncovered functions",
    body,
    files: generatedFiles,
    repoRoot,
    labels: ["ai-generated", "tests"],
  });
}

main().catch((err) => {
  console.error("generate-tests failed:", err);
  process.exit(1);
});
