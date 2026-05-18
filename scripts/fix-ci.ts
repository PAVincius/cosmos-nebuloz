import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { ErrorType, ParsedError } from "./lib/error-parser.js";
import { parseErrors } from "./lib/error-parser.js";
import { generateFix } from "./lib/fix-generator.js";
import { validateFix } from "./lib/fix-validator.js";
import { createIssue } from "./lib/issue-creator.js";
import { createPR } from "./lib/pr-creator.js";

const repoRoot = path.resolve(process.cwd());

function getCurrentSha(): string {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf-8",
    cwd: repoRoot,
  });
  return result.stdout.trim();
}

function runCheck(type: ErrorType): string {
  const opts = {
    cwd: repoRoot,
    encoding: "utf-8" as const,
    stdio: ["pipe", "pipe", "pipe"] as const,
    timeout: 120_000,
  };

  let result: ReturnType<typeof spawnSync>;

  if (type === "biome") {
    result = spawnSync("pnpm", ["exec", "biome", "check", "."], opts);
  } else if (type === "typescript") {
    result = spawnSync("pnpm", ["turbo", "typecheck"], opts);
  } else {
    result = spawnSync("pnpm", ["turbo", "build"], {
      ...opts,
      env: { ...process.env, SKIP_ENV_VALIDATION: "true" },
    });
  }

  return (result.stdout ?? "") + (result.stderr ?? "");
}

function detectFailedTypes(): ErrorType[] {
  const types: ErrorType[] = [];
  if (process.env.CI_FAILURE_LINT === "failure") {
    types.push("biome");
  }
  if (process.env.CI_FAILURE_TYPECHECK === "failure") {
    types.push("typescript");
  }
  if (process.env.CI_FAILURE_BUILD === "failure") {
    types.push("build");
  }
  return types;
}

async function processError(
  error: ParsedError,
  type: ErrorType
): Promise<void> {
  const relPath = path.relative(repoRoot, error.file);
  console.log(`\n  Fixing: ${relPath}:${error.line} [${error.rule}]`);

  const fix = await generateFix(error, repoRoot);

  if (fix === null) {
    createIssue({
      title: `CI failed: ${type} in ${relPath} — AI fix failed`,
      body: `## Error\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## What happened\nClaude could not generate a valid fix. Manual intervention required.`,
      repoRoot,
      labels: ["ci-failure", "needs-human"],
    });
    return;
  }

  console.log(
    `  Fix generated (confidence: ${(fix.confidence * 100).toFixed(0)}%, model: ${fix.modelUsed})`
  );

  if (fix.confidence < 0.6) {
    createIssue({
      title: `CI failed: ${type} in ${relPath} — AI fix not confident`,
      body: `## Error\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## What AI tried\n${fix.reason}\n\n## Confidence: ${(fix.confidence * 100).toFixed(0)}% (threshold: 60%)`,
      repoRoot,
      labels: ["ci-failure", "needs-human"],
    });
    return;
  }

  const originalContent = fs.readFileSync(error.file, "utf-8");
  fs.writeFileSync(error.file, fix.fixedContent, "utf-8");

  const validation = validateFix(error, repoRoot);

  if (!validation.passed) {
    fs.writeFileSync(error.file, originalContent, "utf-8");
    createIssue({
      title: `CI failed: ${type} in ${relPath} — AI fix did not pass validation`,
      body: `## Error\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## What AI tried\n${fix.reason}\n\n## Why validation failed\n\`\`\`\n${validation.output.slice(0, 1000)}\n\`\`\``,
      repoRoot,
      labels: ["ci-failure", "needs-human"],
    });
    return;
  }

  const sha = getCurrentSha();
  const branch = `ai/fix/${type}/${sha}`;
  const labels =
    fix.confidence >= 0.8
      ? ["ai-generated", `fix-${type}`]
      : ["ai-generated", `fix-${type}`, "ai-review-required"];

  createPR({
    branch,
    title: `fix(ai): resolve ${type} error in ${relPath}`,
    body: `## Error fixed\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## Confidence: ${(fix.confidence * 100).toFixed(0)}% (${fix.modelUsed})\nReason: ${fix.reason}\n\nValidate before merge.\n\nGenerated with ${fix.modelUsed}`,
    files: [{ path: relPath, content: fix.fixedContent }],
    repoRoot,
    labels,
  });
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Skipping AI fix.");
    process.exit(0);
  }

  const failedTypes = detectFailedTypes();
  if (failedTypes.length === 0) {
    console.log("No CI failures detected. Exiting.");
    process.exit(0);
  }

  console.log(`Detected failed checks: ${failedTypes.join(", ")}`);

  for (const type of failedTypes) {
    console.log(`\nRe-running ${type} check to capture errors...`);
    const rawOutput = runCheck(type);
    const errors = parseErrors(type, rawOutput, repoRoot);

    if (errors.length === 0) {
      console.log(`No parseable errors found for ${type}.`);
      continue;
    }

    console.log(`Found ${errors.length} error(s) to fix.`);
    for (const error of errors) {
      await processError(error, type);
    }
  }
}

main().catch((err) => {
  console.error("fix-ci failed:", err);
  process.exit(1);
});
