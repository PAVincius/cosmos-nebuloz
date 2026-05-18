import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ParsedError } from "./error-parser.js";

export type ValidationResult = {
  passed: boolean;
  output: string;
};

function getWorkspace(filePath: string, repoRoot: string): string {
  const rel = path.relative(repoRoot, filePath);
  const parts = rel.split(path.sep);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

function runBiomeCheck(file: string, repoRoot: string): ValidationResult {
  const result = spawnSync("pnpm", ["exec", "biome", "check", file], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    passed: result.status === 0 && !result.error,
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

function runTypescriptCheck(file: string, repoRoot: string): ValidationResult {
  const workspace = getWorkspace(file, repoRoot);
  const result = spawnSync(
    "pnpm",
    ["turbo", "typecheck", `--filter=${workspace}`],
    {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    }
  );
  return {
    passed: result.status === 0 && !result.error,
    output: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

export function validateFix(
  error: ParsedError,
  repoRoot: string
): ValidationResult {
  if (error.type === "biome") {
    return runBiomeCheck(error.file, repoRoot);
  }
  if (error.type === "typescript") {
    return runTypescriptCheck(error.file, repoRoot);
  }
  // Build: skip local validation — return passed so PR is created with ai-review-required
  return { passed: true, output: "Build validation skipped locally." };
}
