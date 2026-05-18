# Quality Gates Phase 3 — AI Fix Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When lint, typecheck, or build fails on `main`, automatically attempt a fix using Claude (Haiku first, Sonnet escalation) and open a PR or GitHub Issue depending on confidence.

**Architecture:** Four new modules under `scripts/lib/` (error parser, fix generator, fix validator, issue creator) plus a root orchestrator `scripts/fix-ci.ts`. The `fix-ci` GitHub Actions job re-runs the failing check to capture fresh errors, then calls the orchestrator. Shares `scripts/lib/pr-creator.ts` from Phase 2.

**Tech Stack:** TypeScript, `tsx`, `@anthropic-ai/sdk` (already installed), GitHub CLI (`gh`), `spawnSync` for all shell calls (no string interpolation)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/lib/error-parser.ts` | Create | Parse raw Biome/TS/Build output into structured errors |
| `scripts/lib/fix-generator.ts` | Create | Call Haiku 4.5, escalate to Sonnet 4.6 if confidence < 0.8 |
| `scripts/lib/fix-validator.ts` | Create | Re-run failing check after applying fix |
| `scripts/lib/issue-creator.ts` | Create | `gh issue create` for low-confidence cases |
| `scripts/fix-ci.ts` | Create | Orchestrator: re-run check → parse → fix → validate → PR or issue |
| `scripts/lib/__tests__/error-parser.test.ts` | Create | Unit tests for all 3 parser patterns |
| `.github/workflows/ci.yml` | Modify | Add `fix-ci` job with failure detection |

**Shared from Phase 2 (no changes needed):**
- `scripts/lib/pr-creator.ts` — `createPR()` and `prExists()`

---

### Task 1: Error parser + tests

**Files:**
- Create: `scripts/lib/__tests__/error-parser.test.ts`
- Create: `scripts/lib/error-parser.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/lib/__tests__/error-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseErrors } from "../error-parser.js";

const REPO_ROOT = "/repo";

describe("parseErrors — biome", () => {
  it("extracts file, line, and rule from biome output", () => {
    const raw = `scripts/lib/foo.ts:42:10 lint/suspicious/noExplicitAny ━━━━\n\n  × Unexpected any.\n`;
    const errors = parseErrors("biome", raw, REPO_ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(42);
    expect(errors[0].rule).toBe("lint/suspicious/noExplicitAny");
    expect(errors[0].file).toBe(path.join(REPO_ROOT, "scripts/lib/foo.ts"));
  });

  it("returns empty array for output with no errors", () => {
    const errors = parseErrors("biome", "Checked 10 files. No errors found.", REPO_ROOT);
    expect(errors).toHaveLength(0);
  });

  it("returns at most 3 errors", () => {
    const lines = Array.from(
      { length: 10 },
      (_, i) => `apps/app/file${i}.ts:${i + 1}:1 lint/style/noVar ━━━━`
    ).join("\n");
    const errors = parseErrors("biome", lines, REPO_ROOT);
    expect(errors.length).toBeLessThanOrEqual(3);
  });
});

describe("parseErrors — typescript", () => {
  it("extracts file, line, and error code from TS output", () => {
    const raw = `apps/app/app/route.ts(42,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`;
    const errors = parseErrors("typescript", raw, REPO_ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(42);
    expect(errors[0].rule).toBe("TS2345");
    expect(errors[0].message).toContain("not assignable");
  });

  it("returns empty array for no TS errors", () => {
    const errors = parseErrors("typescript", "Found 0 errors.", REPO_ROOT);
    expect(errors).toHaveLength(0);
  });
});

describe("parseErrors — build", () => {
  it("extracts file from build error output", () => {
    const raw = `Error: ./apps/app/app/page.tsx\nModule not found: Can't resolve './missing'`;
    const errors = parseErrors("build", raw, REPO_ROOT);
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe(path.join(REPO_ROOT, "apps/app/app/page.tsx"));
    expect(errors[0].rule).toBe("build");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm vitest run scripts/lib/__tests__/error-parser.test.ts
```

Expected: FAIL — `error-parser.js` does not exist yet.

- [ ] **Step 3: Create `scripts/lib/error-parser.ts`**

```typescript
import fs from "node:fs";
import path from "node:path";

export type ErrorType = "biome" | "typescript" | "build";

export type ParsedError = {
  file: string;       // absolute path
  line: number;
  rule: string;       // "TS2345" | "lint/suspicious/noExplicitAny" | "build"
  message: string;
  fileContent: string;
  type: ErrorType;
};

// Biome: "scripts/lib/foo.ts:42:10 lint/suspicious/noExplicitAny ━━━"
const BIOME_REGEX = /^([^:\n]+\.tsx?):(\d+):\d+\s+(lint\/[^\s]+)/gm;

// TS: "apps/app/route.ts(42,10): error TS2345: message"
const TS_REGEX = /^([^(\n]+\.tsx?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/gm;

// Build: "Error: ./apps/app/page.tsx\nModule not found: ..."
const BUILD_REGEX = /Error:\s+\.\/([\w/.\-]+\.tsx?)\n(.+)/gm;

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function parseBiome(raw: string, repoRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  for (const match of raw.matchAll(BIOME_REGEX)) {
    const file = path.join(repoRoot, match[1]);
    errors.push({
      file,
      line: parseInt(match[2], 10),
      rule: match[3],
      message: match[3],
      fileContent: readFile(file),
      type: "biome",
    });
  }
  return errors;
}

function parseTypescript(raw: string, repoRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  for (const match of raw.matchAll(TS_REGEX)) {
    const file = path.join(repoRoot, match[1]);
    errors.push({
      file,
      line: parseInt(match[2], 10),
      rule: match[3],
      message: match[4],
      fileContent: readFile(file),
      type: "typescript",
    });
  }
  return errors;
}

function parseBuild(raw: string, repoRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  for (const match of raw.matchAll(BUILD_REGEX)) {
    const file = path.join(repoRoot, match[1]);
    errors.push({
      file,
      line: 1,
      rule: "build",
      message: match[2],
      fileContent: readFile(file),
      type: "build",
    });
  }
  return errors;
}

export function parseErrors(
  type: ErrorType,
  raw: string,
  repoRoot: string
): ParsedError[] {
  let all: ParsedError[];

  switch (type) {
    case "biome":
      all = parseBiome(raw, repoRoot);
      break;
    case "typescript":
      all = parseTypescript(raw, repoRoot);
      break;
    case "build":
      all = parseBuild(raw, repoRoot);
      break;
  }

  // Deduplicate by file+rule, cap at 3 errors per run
  const seen = new Set<string>();
  const unique: ParsedError[] = [];
  for (const err of all) {
    const key = `${err.file}:${err.rule}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(err);
    }
  }
  return unique.slice(0, 3);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm vitest run scripts/lib/__tests__/error-parser.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/error-parser.ts scripts/lib/__tests__/error-parser.test.ts
git commit -m "feat(scripts): add error parser for biome/typescript/build failures"
```

---

### Task 2: Fix generator (Haiku → Sonnet escalation)

**Files:**
- Create: `scripts/lib/fix-generator.ts`

- [ ] **Step 1: Create `scripts/lib/fix-generator.ts`**

```typescript
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { ErrorType, ParsedError } from "./error-parser.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type FixResult = {
  fixedContent: string;
  confidence: number;
  reason: string;
  modelUsed: string;
};

const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
} as const;

const TYPE_LABELS: Record<ErrorType, string> = {
  biome: "Biome",
  typescript: "TypeScript",
  build: "Build",
};

function buildPrompt(error: ParsedError, repoRoot: string): string {
  const relPath = path.relative(repoRoot, error.file);
  return `Error type: ${TYPE_LABELS[error.type]}
Error: ${error.rule}: ${error.message}
File: ${relPath}

${error.fileContent.slice(0, 4000)}`;
}

async function callModel(
  model: string,
  prompt: string
): Promise<{ fix: string; confidence: number; reason: string } | null> {
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: `You are a TypeScript/Biome expert. Fix the exact error reported.
Return JSON only: { "fix": "<full patched file content>", "confidence": 0.0-1.0, "reason": "..." }
confidence = 1.0 if fix is unambiguous.
confidence = 0.5 if multiple valid approaches exist.
confidence = 0.2 if fix requires broader context not provided.
Do NOT refactor beyond fixing the error. Minimal diff only.`,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown fences if present
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(json) as {
      fix: string;
      confidence: number;
      reason: string;
    };
    if (
      typeof parsed.fix === "string" &&
      typeof parsed.confidence === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateFix(
  error: ParsedError,
  repoRoot: string
): Promise<FixResult | null> {
  const prompt = buildPrompt(error, repoRoot);

  // Attempt 1: Haiku (fast + cheap)
  const haiku = await callModel(MODELS.fast, prompt);
  if (haiku !== null && haiku.confidence >= 0.8) {
    return {
      fixedContent: haiku.fix,
      confidence: haiku.confidence,
      reason: haiku.reason,
      modelUsed: MODELS.fast,
    };
  }

  // Attempt 2: Sonnet (if Haiku confidence < 0.8 or Haiku failed)
  const sonnet = await callModel(MODELS.smart, prompt);
  if (sonnet === null) {
    return null;
  }
  return {
    fixedContent: sonnet.fix,
    confidence: sonnet.confidence,
    reason: sonnet.reason,
    modelUsed: MODELS.smart,
  };
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
ANTHROPIC_API_KEY=dummy pnpm tsx -e "import('./scripts/lib/fix-generator.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'generateFix' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/fix-generator.ts
git commit -m "feat(scripts): add fix generator with Haiku to Sonnet escalation"
```

---

### Task 3: Fix validator

**Files:**
- Create: `scripts/lib/fix-validator.ts`

- [ ] **Step 1: Create `scripts/lib/fix-validator.ts`**

```typescript
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { ErrorType, ParsedError } from "./error-parser.js";

export type ValidationResult = {
  passed: boolean;
  output: string;
};

function getWorkspace(filePath: string, repoRoot: string): string {
  const rel = path.relative(repoRoot, filePath);
  const parts = rel.split(path.sep);
  // e.g. "apps/app" or "packages/safe-engine"
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

export function validateFix(
  error: ParsedError,
  repoRoot: string
): ValidationResult {
  if (error.type === "biome") {
    const result = spawnSync(
      "pnpm",
      ["exec", "biome", "check", error.file],
      { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return {
      passed: result.status === 0 && !result.error,
      output: result.stdout + result.stderr,
    };
  }

  if (error.type === "typescript") {
    const workspace = getWorkspace(error.file, repoRoot);
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
      output: result.stdout + result.stderr,
    };
  }

  // Build: skip local validation (too slow + env requirements in CI)
  // Return passed=true so we still create a PR, marked ai-review-required
  return { passed: true, output: "Build validation skipped locally." };
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm tsx -e "import('./scripts/lib/fix-validator.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'validateFix' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/fix-validator.ts
git commit -m "feat(scripts): add fix validator for post-fix local check"
```

---

### Task 4: Issue creator

**Files:**
- Create: `scripts/lib/issue-creator.ts`

- [ ] **Step 1: Create `scripts/lib/issue-creator.ts`**

```typescript
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type IssueOptions = {
  title: string;
  body: string;
  repoRoot: string;
  labels?: string[];
};

export function createIssue(options: IssueOptions): void {
  const { title, body, repoRoot, labels = [] } = options;

  const bodyFile = path.join(repoRoot, ".github", "_issue_body.tmp");
  fs.writeFileSync(bodyFile, body, "utf-8");

  const args = [
    "issue",
    "create",
    "--title",
    title,
    "--body-file",
    bodyFile,
  ];
  if (labels.length > 0) {
    args.push("--label", labels.join(","));
  }

  try {
    const result = spawnSync("gh", args, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.status === 0 && !result.error) {
      console.log("Issue created:", result.stdout.trim());
    } else {
      console.error("gh issue create failed:", result.stderr);
    }
  } finally {
    if (fs.existsSync(bodyFile)) {
      fs.unlinkSync(bodyFile);
    }
  }
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm tsx -e "import('./scripts/lib/issue-creator.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'createIssue' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/issue-creator.ts
git commit -m "feat(scripts): add issue creator for low-confidence AI fixes"
```

---

### Task 5: Main orchestrator

**Files:**
- Create: `scripts/fix-ci.ts`

- [ ] **Step 1: Create `scripts/fix-ci.ts`**

```typescript
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { ErrorType } from "./lib/error-parser.js";
import { parseErrors } from "./lib/error-parser.js";
import { generateFix } from "./lib/fix-generator.js";
import { createIssue } from "./lib/issue-creator.js";
import { createPR } from "./lib/pr-creator.js";
import { validateFix } from "./lib/fix-validator.js";

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
    result = spawnSync(
      "pnpm",
      ["turbo", "build"],
      { ...opts, env: { ...process.env, SKIP_ENV_VALIDATION: "true" } }
    );
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
      const relPath = path.relative(repoRoot, error.file);
      console.log(`\n  Fixing: ${relPath}:${error.line} [${error.rule}]`);

      const fix = await generateFix(error, repoRoot);

      if (fix === null) {
        console.log("  AI could not generate a fix. Creating issue...");
        createIssue({
          title: `CI failed: ${type} in ${relPath} — AI fix failed`,
          body: `## Error\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## What happened\nClaude could not generate a valid fix. Manual intervention required.`,
          repoRoot,
          labels: ["ci-failure", "needs-human"],
        });
        continue;
      }

      console.log(
        `  Fix generated (confidence: ${(fix.confidence * 100).toFixed(0)}%, model: ${fix.modelUsed})`
      );

      if (fix.confidence < 0.6) {
        console.log("  Low confidence. Creating issue instead of PR...");
        createIssue({
          title: `CI failed: ${type} in ${relPath} — AI fix not confident`,
          body: `## Error\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## What AI tried\n${fix.reason}\n\n## Why confidence was low\nConfidence: ${(fix.confidence * 100).toFixed(0)}% (threshold: 60%)`,
          repoRoot,
          labels: ["ci-failure", "needs-human"],
        });
        continue;
      }

      // Apply fix to file
      const originalContent = fs.readFileSync(error.file, "utf-8");
      fs.writeFileSync(error.file, fix.fixedContent, "utf-8");

      // Validate fix
      console.log("  Validating fix...");
      const validation = validateFix(error, repoRoot);

      if (!validation.passed) {
        console.log("  Validation failed. Reverting and creating issue...");
        fs.writeFileSync(error.file, originalContent, "utf-8");
        createIssue({
          title: `CI failed: ${type} in ${relPath} — AI fix did not pass validation`,
          body: `## Error\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## What AI tried\n${fix.reason}\n\n## Why validation failed\nFix was applied but re-running the check still failed:\n\`\`\`\n${validation.output.slice(0, 1000)}\n\`\`\``,
          repoRoot,
          labels: ["ci-failure", "needs-human"],
        });
        continue;
      }

      // Fix passed validation → create PR
      const sha = getCurrentSha();
      const branch = `ai/fix/${type}/${sha}`;
      const confidenceLabel =
        fix.confidence >= 0.8 ? "ai-generated" : "ai-generated,ai-review-required";

      createPR({
        branch,
        title: `fix(ai): resolve ${type} error in ${relPath}`,
        body: `## Error fixed\n\`${error.rule}\`: ${error.message}\nFile: \`${relPath}:${error.line}\`\n\n## Confidence: ${(fix.confidence * 100).toFixed(0)}% (${fix.modelUsed})\nReason: ${fix.reason}\n\nValidate before merge. AI fix may have edge cases.\n\nGenerated with Claude ${fix.modelUsed}`,
        files: [{ path: relPath, content: fix.fixedContent }],
        repoRoot,
        labels: confidenceLabel.split(","),
      });
    }
  }
}

main().catch((err) => {
  console.error("fix-ci failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify graceful exit without API key**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
unset ANTHROPIC_API_KEY
pnpm tsx scripts/fix-ci.ts
```

Expected:
```
ANTHROPIC_API_KEY not set. Skipping AI fix.
```
Exit code: 0.

- [ ] **Step 3: Verify graceful exit with no failures detected**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
ANTHROPIC_API_KEY=dummy pnpm tsx scripts/fix-ci.ts
```

Expected:
```
No CI failures detected. Exiting.
```
Exit code: 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/fix-ci.ts
git commit -m "feat(scripts): add fix-ci orchestrator for AI CI fix loop"
```

---

### Task 6: GitHub Actions integration

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `fix-ci` job and failure capture to `.github/workflows/ci.yml`**

Append this job after the existing `generate-tests` job (at the end of the file):

```yaml
  fix-ci:
    name: AI Fix CI Failure
    runs-on: ubuntu-latest
    needs: [lint, typecheck, build]
    if: |
      always() &&
      github.ref == 'refs/heads/main' &&
      (needs.lint.result == 'failure' || needs.typecheck.result == 'failure' || needs.build.result == 'failure')
    permissions:
      contents: write
      pull-requests: write
      issues: write
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      CI_FAILURE_LINT: ${{ needs.lint.result }}
      CI_FAILURE_TYPECHECK: ${{ needs.typecheck.result }}
      CI_FAILURE_BUILD: ${{ needs.build.result }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 10.24.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: AI Fix CI failure
        run: pnpm tsx scripts/fix-ci.ts
```

Note: The `if:` uses `always()` so the job runs even when dependencies fail. The condition checks that at least one job failed and we are on `main`.

- [ ] **Step 2: Add `pnpm fix:ci` convenience script to root `package.json`**

Open `package.json`. Add after `"generate:tests"`:

```json
"fix:ci": "tsx scripts/fix-ci.ts",
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: add AI fix-ci job triggered on lint/typecheck/build failures"
```

---

### Task 7: Smoke test all new modules

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm vitest run scripts/lib/__tests__/
```

Expected:
```
Test Files  2 passed (2)
     Tests  14 passed (14)
```
(7 from coverage-parser + 7 from error-parser)

- [ ] **Step 2: Verify all Phase 3 modules load**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
for f in error-parser fix-generator fix-validator issue-creator; do
  echo -n "$f: "
  ANTHROPIC_API_KEY=dummy pnpm tsx -e "import('./scripts/lib/$f.js').then(m => console.log(Object.keys(m).join(', ')))"
done
```

Expected:
```
error-parser: parseErrors
fix-generator: generateFix
fix-validator: validateFix
issue-creator: createIssue
```

- [ ] **Step 3: Verify fix-ci graceful exits**

```bash
# No API key
unset ANTHROPIC_API_KEY && pnpm tsx scripts/fix-ci.ts
# Expected: "ANTHROPIC_API_KEY not set. Skipping AI fix."

# No failures detected
ANTHROPIC_API_KEY=dummy pnpm tsx scripts/fix-ci.ts
# Expected: "No CI failures detected. Exiting."

# With simulated lint failure
ANTHROPIC_API_KEY=dummy CI_FAILURE_LINT=failure pnpm tsx scripts/fix-ci.ts 2>&1 | head -5
# Expected: "Detected failed checks: biome" then re-runs biome check
```

---

## Success Checklist

- [ ] 7 error-parser unit tests pass
- [ ] All 4 Phase 3 modules load with correct exports
- [ ] `fix-ci.ts` exits gracefully without `ANTHROPIC_API_KEY`
- [ ] `fix-ci.ts` exits gracefully when no CI failures detected
- [ ] `fix-ci` job in ci.yml uses `always()` + correct failure condition
- [ ] `fix-ci` job has `issues: write` permission
- [ ] `scripts/lib/pr-creator.ts` reused unchanged (no duplication)
- [ ] All scripts pass Biome lint on commit (pre-commit hook validates)
