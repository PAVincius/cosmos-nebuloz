# Quality Gates Phase 2 — AI Test Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When CI coverage fails on `main`, automatically generate Vitest tests for the 5 highest-risk uncovered files and open a PR via Claude Haiku 4.5.

**Architecture:** Five TypeScript modules under `scripts/lib/` (coverage parser, context collector, test generator, PR creator) wired by a root orchestrator `scripts/generate-tests.ts`. GitHub Actions `generate-tests` job triggers on `test` job failure, downloads coverage artifacts, and runs the orchestrator. All shell commands use `spawnSync` with args array (not string interpolation) to prevent command injection.

**Tech Stack:** TypeScript, `tsx`, `@anthropic-ai/sdk`, `glob`, Vitest json-summary, GitHub CLI (`gh`), Node.js `child_process.spawnSync`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` (root) | Modify | Add `@anthropic-ai/sdk`, `tsx`, `glob` to devDeps; add `generate:tests` script |
| `scripts/lib/coverage-parser.ts` | Create | Parse json-summary, compute risk score, return top-5 ranked files |
| `scripts/lib/context-collector.ts` | Create | Collect file source, types, Prisma schema, doc snippet |
| `scripts/lib/test-generator.ts` | Create | Build prompt and call Claude Haiku 4.5 API |
| `scripts/lib/pr-creator.ts` | Create | Git + gh operations using `spawnSync` with args array |
| `scripts/generate-tests.ts` | Create | Orchestrates pipeline |
| `.github/workflows/ci.yml` | Modify | Add `generate-tests` job after `test` failure |
| `scripts/lib/__tests__/coverage-parser.test.ts` | Create | Unit tests for pure parser and risk heuristic |

---

### Task 1: Install dependencies and add generate:tests script

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add devDependencies and script to root `package.json`**

Open `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/package.json`. The current `devDependencies` section ends with `"zod": "4.1.13"`. Add the three new deps and the `generate:tests` script. Final result:

```json
{
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "check": "npx ultracite@latest check",
    "fix": "npx ultracite@latest fix",
    "test": "turbo test",
    "test:coverage": "turbo test:coverage",
    "analyze": "turbo analyze",
    "translate": "turbo translate",
    "boundaries": "turbo boundaries",
    "prepare": "simple-git-hooks",
    "generate:tests": "tsx scripts/generate-tests.ts",
    "bump-deps": "npx npm-check-updates --deep -u -x recharts && pnpm install",
    "bump-ui": "npx shadcn@latest add --all --overwrite -c packages/design-system",
    "migrate": "cd packages/database && npx prisma format && npx prisma generate && npx prisma db push",
    "clean": "git clean -xdf node_modules"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.54.0",
    "@auto-it/first-time-contributor": "^11.3.6",
    "@biomejs/biome": "2.3.8",
    "@repo/typescript-config": "workspace:*",
    "@turbo/gen": "^2.6.3",
    "@types/node": "^24.10.1",
    "glob": "^11.0.2",
    "lint-staged": "^15.5.2",
    "simple-git-hooks": "^2.13.0",
    "tsup": "^8.5.1",
    "tsx": "^4.19.4",
    "turbo": "^2.6.3",
    "typescript": "^5.9.3",
    "ultracite": "6.3.9",
    "vitest": "^4.0.15",
    "zod": "4.1.13"
  }
}
```

- [ ] **Step 2: Install new deps**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm install
```

Expected: `+ @anthropic-ai/sdk`, `+ glob`, `+ tsx` in output. Exit code 0.

- [ ] **Step 3: Verify tsx works**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
node -e "console.log('node ok')" && pnpm tsx --version
```

Expected: `node ok` then tsx version (e.g., `4.x.x`).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add anthropic-sdk, tsx, glob for AI test generation scripts"
```

---

### Task 2: Coverage parser

**Files:**
- Create: `scripts/lib/coverage-parser.ts`
- Create: `scripts/lib/__tests__/coverage-parser.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `scripts/lib/__tests__/coverage-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeRiskScore, parseCoverage } from "../coverage-parser.js";

describe("computeRiskScore", () => {
  it("returns 0 when importCount is 0", () => {
    expect(computeRiskScore(0, 20, 5)).toBe(0);
  });

  it("returns 0 when all lines are covered", () => {
    expect(computeRiskScore(10, 20, 20)).toBe(0);
  });

  it("returns higher score for more imports and more uncovered lines", () => {
    const highRisk = computeRiskScore(20, 20, 4);  // 20 imports, 80% uncovered
    const lowRisk = computeRiskScore(2, 20, 18);   // 2 imports, 10% uncovered
    expect(highRisk).toBeGreaterThan(lowRisk);
  });

  it("score is proportional: doubling imports doubles score", () => {
    const s1 = computeRiskScore(5, 20, 10);
    const s2 = computeRiskScore(10, 20, 10);
    expect(s2).toBeCloseTo(s1 * 2, 5);
  });
});

describe("parseCoverage", () => {
  it("returns empty array when no coverage files exist", () => {
    const result = parseCoverage("/nonexistent-dir-12345");
    expect(result).toEqual([]);
  });

  it("returns an array", () => {
    const result = parseCoverage(process.cwd());
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns at most 5 files", () => {
    const result = parseCoverage(process.cwd());
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm vitest run scripts/lib/__tests__/coverage-parser.test.ts
```

Expected: FAIL — `coverage-parser.js` does not exist yet.

- [ ] **Step 3: Create `scripts/lib/coverage-parser.ts`**

```typescript
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
  if (importCount === 0 || totalLines === 0) return 0;
  const uncoveredRatio = (totalLines - coveredLines) / totalLines;
  return importCount * uncoveredRatio;
}

function getImportCount(fileName: string, repoRoot: string): number {
  // Use spawnSync with args array — safe from shell injection
  const result = spawnSync(
    "grep",
    ["-rl", fileName, repoRoot, "--include=*.ts", "--include=*.tsx"],
    { encoding: "utf-8", timeout: 5000 }
  );
  if (result.error || result.status !== 0) return 0;
  const lines = result.stdout.split("\n").filter(Boolean);
  // Subtract 1 to exclude the file itself from its own import count
  return Math.max(0, lines.length - 1);
}

export function parseCoverage(repoRoot: string): RankedFile[] {
  const files: RankedFile[] = [];

  for (const coveragePath of COVERAGE_PATHS) {
    const fullPath = path.join(repoRoot, coveragePath);
    if (!fs.existsSync(fullPath)) continue;

    let report: JsonSummary;
    try {
      report = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as JsonSummary;
    } catch {
      continue;
    }

    for (const [filePath, coverage] of Object.entries(report)) {
      if (filePath === "total") continue;
      if (!fs.existsSync(filePath)) continue;
      if (coverage.lines.total === 0) continue;
      if (coverage.lines.pct >= 80) continue;

      const uncoveredLines = coverage.lines.total - coverage.lines.covered;
      const fileName = path.basename(filePath, path.extname(filePath));
      const importCount = getImportCount(fileName, repoRoot);
      const riskScore = computeRiskScore(importCount, coverage.lines.total, coverage.lines.covered);

      files.push({
        filePath,
        uncoveredLines,
        totalLines: coverage.lines.total,
        importCount,
        riskScore,
        coveragePct: coverage.lines.pct,
      });
    }
  }

  return files.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm vitest run scripts/lib/__tests__/coverage-parser.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/coverage-parser.ts scripts/lib/__tests__/coverage-parser.test.ts
git commit -m "feat(scripts): add coverage parser with risk heuristic"
```

---

### Task 3: Context collector

**Files:**
- Create: `scripts/lib/context-collector.ts`

- [ ] **Step 1: Create `scripts/lib/context-collector.ts`**

```typescript
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

export type FileContext = {
  filePath: string;
  relativePath: string;
  fileContent: string;
  relatedTypes: string;
  prismaSchema: string;
  docSnippet: string;
};

function extractRelatedTypes(fileContent: string, fileDir: string): string {
  const typeImportRegex = /import\s+type\s+\{[^}]+\}\s+from\s+['"](\.[^'"]+)['"]/g;
  const importPaths = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = typeImportRegex.exec(fileContent)) !== null) {
    importPaths.add(match[1]);
  }

  const types: string[] = [];
  for (const imp of [...importPaths].slice(0, 3)) {
    const candidates = [`${imp}.ts`, `${imp}/index.ts`].map((s) =>
      path.resolve(fileDir, s)
    );
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        types.push(fs.readFileSync(candidate, "utf-8").slice(0, 400));
        break;
      }
    }
  }
  return types.join("\n").slice(0, 800);
}

function extractPrismaSchema(fileContent: string, repoRoot: string): string {
  const modelMatches = [...fileContent.matchAll(/database\.(\w+)\./g)].map(
    (m) => m[1]
  );
  if (modelMatches.length === 0) return "";

  const schemaDir = path.join(repoRoot, "packages/database/prisma/schema");
  if (!fs.existsSync(schemaDir)) return "";

  const schemas: string[] = [];
  const uniqueModels = [...new Set(modelMatches)].slice(0, 2);

  for (const model of uniqueModels) {
    const schemaFiles = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".prisma"));
    for (const schemaFile of schemaFiles) {
      const schema = fs.readFileSync(path.join(schemaDir, schemaFile), "utf-8");
      const modelRegex = new RegExp(`model\\s+${model}\\s+\\{[^}]+\\}`, "is");
      const found = schema.match(modelRegex);
      if (found) {
        schemas.push(found[0]);
        break;
      }
    }
  }
  return schemas.join("\n\n").slice(0, 600);
}

async function findDocSnippet(filePath: string, repoRoot: string): Promise<string> {
  const fileName = path.basename(filePath, path.extname(filePath));
  const docsDir = path.join(repoRoot, "docs");
  if (!fs.existsSync(docsDir)) return "";

  try {
    const docFiles = await glob(`**/*${fileName}*`, {
      cwd: docsDir,
      absolute: true,
      ignore: ["**/node_modules/**"],
    });
    if (docFiles.length === 0) return "";
    return fs.readFileSync(docFiles[0], "utf-8").slice(0, 800);
  } catch {
    return "";
  }
}

export async function collectContext(
  filePath: string,
  repoRoot: string
): Promise<FileContext> {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(repoRoot, filePath);

  const [relatedTypes, prismaSchema, docSnippet] = await Promise.all([
    Promise.resolve(extractRelatedTypes(fileContent, fileDir)),
    Promise.resolve(extractPrismaSchema(fileContent, repoRoot)),
    findDocSnippet(filePath, repoRoot),
  ]);

  return {
    filePath,
    relativePath,
    fileContent: fileContent.slice(0, 3000),
    relatedTypes,
    prismaSchema,
    docSnippet,
  };
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm tsx -e "import('./scripts/lib/context-collector.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'collectContext' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/context-collector.ts
git commit -m "feat(scripts): add context collector for test generation"
```

---

### Task 4: Test generator (Claude Haiku 4.5 API)

**Files:**
- Create: `scripts/lib/test-generator.ts`

- [ ] **Step 1: Create `scripts/lib/test-generator.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import type { FileContext } from "./context-collector.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type GeneratedTest = {
  testContent: string;
  outputPath: string;
  targetFile: string;
};

function buildUserMessage(context: FileContext): string {
  const parts: string[] = [
    `File to test: ${context.relativePath}\n`,
    "Source code:",
    "```typescript",
    context.fileContent,
    "```",
  ];

  if (context.relatedTypes) {
    parts.push("\nTypeScript types:", "```typescript", context.relatedTypes, "```");
  }
  if (context.prismaSchema) {
    parts.push("\nPrisma model:", "```prisma", context.prismaSchema, "```");
  }
  if (context.docSnippet) {
    parts.push("\nFeature documentation:", context.docSnippet);
  }

  const fileName = path.basename(context.relativePath, ".ts");
  const workspaceRoot = context.relativePath.split("/").slice(0, 2).join("/");

  parts.push(
    `\nGenerate ${workspaceRoot}/__tests__/generated/${fileName}.test.ts covering:`,
    "1. Happy path with realistic inputs",
    "2. Edge cases (null, empty string, zero, boundary values)",
    "3. Error handling (functions that throw or return null/undefined)",
    "4. Each branch of conditional logic",
    "\nOutput ONLY the TypeScript file content, no explanation or markdown fences."
  );

  return parts.join("\n");
}

export async function generateTest(
  context: FileContext,
  repoRoot: string
): Promise<GeneratedTest> {
  const fileName = path.basename(context.relativePath, ".ts");
  const workspaceRoot = context.relativePath.split("/").slice(0, 2).join("/");
  const outputPath = `${workspaceRoot}/__tests__/generated/${fileName}.test.ts`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: `You are a Vitest/TypeScript test engineer for the COSMOS SAFe platform.
Generate tests that reflect real behavior, not just structure.
Use minimal mocks — only for external I/O (database calls, HTTP requests).
For database calls: vi.mock('@repo/database', () => ({ database: { modelName: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } } }))
Write describe/it blocks with descriptive Portuguese names.
Always import from vitest: import { describe, it, expect, vi, beforeEach } from 'vitest'
Output ONLY the TypeScript file content, no explanation or markdown fences.`,
    messages: [{ role: "user", content: buildUserMessage(context) }],
  });

  const testContent =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  return { testContent, outputPath, targetFile: context.relativePath };
}
```

- [ ] **Step 2: Verify module loads without crashing**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
ANTHROPIC_API_KEY=dummy pnpm tsx -e "import('./scripts/lib/test-generator.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'generateTest' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/test-generator.ts
git commit -m "feat(scripts): add test generator using Claude Haiku 4.5"
```

---

### Task 5: PR creator (injection-safe)

**Files:**
- Create: `scripts/lib/pr-creator.ts`

- [ ] **Step 1: Create `scripts/lib/pr-creator.ts`**

All shell calls use `spawnSync` with separate args array — no string interpolation into shell.

```typescript
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type PROptions = {
  branch: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
  repoRoot: string;
  labels?: string[];
};

function run(
  cmd: string,
  args: string[],
  cwd: string
): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0 && !result.error,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function prExists(branch: string, repoRoot: string): boolean {
  const result = run(
    "gh",
    ["pr", "list", "--head", branch, "--json", "number"],
    repoRoot
  );
  if (!result.ok) return false;
  try {
    const prs = JSON.parse(result.stdout) as unknown[];
    return prs.length > 0;
  } catch {
    return false;
  }
}

export function createPR(options: PROptions): void {
  const { branch, title, body, files, repoRoot, labels = [] } = options;

  if (prExists(branch, repoRoot)) {
    console.log(`PR already exists for branch ${branch}. Skipping.`);
    return;
  }

  run("git", ["config", "user.name", "cosmos-ai-bot"], repoRoot);
  run("git", ["config", "user.email", "ai-bot@cosmos.app"], repoRoot);
  run("git", ["checkout", "-b", branch], repoRoot);

  for (const file of files) {
    const fullPath = path.join(repoRoot, file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, "utf-8");
  }

  run("git", ["add", "-A"], repoRoot);
  run("git", ["commit", "-m", `${title} [skip ci]`], repoRoot);
  run("git", ["push", "origin", branch], repoRoot);

  // Write body to temp file — avoids any shell escaping issues
  const bodyFile = path.join(repoRoot, ".github", "_pr_body.tmp");
  fs.writeFileSync(bodyFile, body, "utf-8");

  const ghArgs = ["pr", "create", "--title", title, "--body-file", bodyFile];
  if (labels.length > 0) {
    ghArgs.push("--label", labels.join(","));
  }

  try {
    const result = run("gh", ghArgs, repoRoot);
    if (!result.ok) {
      console.error("gh pr create failed:", result.stderr);
    } else {
      console.log("PR created:", result.stdout.trim());
    }
  } finally {
    fs.unlinkSync(bodyFile);
  }
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm tsx -e "import('./scripts/lib/pr-creator.js').then(m => console.log(Object.keys(m)))"
```

Expected: `[ 'prExists', 'createPR' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/pr-creator.ts
git commit -m "feat(scripts): add injection-safe PR creator using spawnSync"
```

---

### Task 6: Main orchestrator

**Files:**
- Create: `scripts/generate-tests.ts`

- [ ] **Step 1: Create `scripts/generate-tests.ts`**

```typescript
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseCoverage } from "./lib/coverage-parser.js";
import { collectContext } from "./lib/context-collector.js";
import { generateTest } from "./lib/test-generator.js";
import { createPR } from "./lib/pr-creator.js";

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
      if (data.total?.lines?.pct !== undefined) return data.total.lines.pct;
    } catch {
      continue;
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
  rankedFiles.forEach((f) =>
    console.log(`  ${f.filePath} (risk: ${f.riskScore.toFixed(2)}, coverage: ${f.coveragePct}%)`)
  );

  const generatedFiles: Array<{ path: string; content: string }> = [];
  const coveredFiles: string[] = [];

  for (const file of rankedFiles) {
    console.log(`\nProcessing ${file.filePath}...`);
    try {
      const context = await collectContext(file.filePath, repoRoot);
      const generated = await generateTest(context, repoRoot);

      if (generated.testContent.trim().length > 0) {
        generatedFiles.push({ path: generated.outputPath, content: generated.testContent });
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
```

- [ ] **Step 2: Verify graceful exit without API key**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
unset ANTHROPIC_API_KEY
pnpm generate:tests
```

Expected output:
```
ANTHROPIC_API_KEY not set. Skipping test generation.
```
Exit code: 0.

- [ ] **Step 3: Verify graceful exit with no coverage files**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
ANTHROPIC_API_KEY=dummy pnpm generate:tests
```

Expected output (coverage files not present locally):
```
Parsing coverage reports...
No uncovered files found. Nothing to generate.
```
Exit code: 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-tests.ts
git commit -m "feat(scripts): add generate-tests orchestrator"
```

---

### Task 7: GitHub Actions integration

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `generate-tests` job to `.github/workflows/ci.yml`**

Append after the closing of the `build` job (after line 143). The new job:

```yaml
  generate-tests:
    name: AI Test Generation
    runs-on: ubuntu-latest
    needs: [test]
    if: failure() && github.ref == 'refs/heads/main'
    permissions:
      contents: write
      pull-requests: write
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
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

      - name: Download coverage reports
        uses: actions/download-artifact@v4
        with:
          name: coverage-reports
        continue-on-error: true

      - name: Generate tests with AI
        run: pnpm generate:tests
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add AI test generation job triggered on coverage failure"
```

---

### Task 8: Run all unit tests

**Files:** none (verification only)

- [ ] **Step 1: Run coverage-parser unit tests**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
pnpm vitest run scripts/lib/__tests__/coverage-parser.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 2: Verify all scripts load correctly**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
for f in coverage-parser context-collector test-generator pr-creator; do
  echo -n "Loading $f... "
  ANTHROPIC_API_KEY=dummy pnpm tsx -e "import('./scripts/lib/$f.js').then(m => console.log(Object.keys(m).join(', ')))"
done
```

Expected:
```
Loading coverage-parser... computeRiskScore, parseCoverage
Loading context-collector... collectContext
Loading test-generator... generateTest
Loading pr-creator... prExists, createPR
```

- [ ] **Step 3: Final commit if any loose files**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
git status
# If any files modified by Biome during commit hooks, check and re-commit
```

---

## Success Checklist

- [ ] `pnpm generate:tests` exits gracefully without `ANTHROPIC_API_KEY` (code 0)
- [ ] `pnpm generate:tests` exits gracefully when no coverage files found (code 0)
- [ ] `computeRiskScore` unit tests pass (7 tests)
- [ ] Coverage parser returns `RankedFile[]` sorted by risk score, max 5 items
- [ ] Context collector extracts types, Prisma schema, and doc snippets
- [ ] Test generator builds correct prompt and calls `claude-haiku-4-5-20251001`
- [ ] PR creator uses `spawnSync` with args array (no shell injection)
- [ ] PR creator skips if branch already exists
- [ ] `generate-tests` job in ci.yml runs only on `test` failure on `main`
- [ ] All scripts pass Biome lint on commit (pre-commit hook validates)
