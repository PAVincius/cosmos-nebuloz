# Quality Gates — Phase 2: AI Test Generation

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** Autonomous AI-driven test generation triggered by coverage threshold failure  
**Depends on:** Phase 1 (CI/CD + coverage thresholds in vitest configs)

---

## Context

Phase 1 established coverage thresholds (60% lines/functions, 50% branches) enforced in CI. Currently there are near-zero unit tests across the main workspaces. Phase 2 closes the loop: when CI fails due to coverage, the pipeline autonomously generates high-fidelity Vitest tests using Claude Haiku 4.5 and opens a PR for human review before merge.

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation: CI/CD + pre-commit hooks | ✅ Done |
| **2** | **Safety Net: AI test generation** | **This spec** |
| 3 | AI Fix Loop: auto-PR on CI failure | Planned |
| 4 | Prevention: AI risk scoring on every PR | Planned |

---

## Goals

- When CI coverage drops below 60%, Claude Haiku 4.5 automatically generates tests for the riskiest uncovered functions and opens a PR.
- Generated tests are high-fidelity: they read actual source + types + Prisma schema + feature docs.
- Cost per CI failure: ~$0.005 (5 functions × ~$0.001/function with Haiku 4.5).
- Human reviews and merges the PR — AI never merges autonomously.
- Idempotent: one PR per commit SHA, no spam.

---

## Architecture

```
CI: pnpm turbo test:coverage fails (threshold < 60%)
    ↓
generate-tests job (triggered only on coverage failure)
    ↓
scripts/generate-tests.ts
    ├── 1. Parse coverage/json-summary.json (all workspaces)
    ├── 2. Rank uncovered functions by risk heuristic
    │       risk_score = import_count × (uncovered_lines / total_lines)
    ├── 3. For each function (top 5 per run):
    │       a. Read full function source
    │       b. Collect context: callers, TypeScript types, Prisma schema, docs
    │       c. Call Claude Haiku 4.5 API (max 4096 output tokens/request)
    │       d. Write __tests__/generated/<function-name>.test.ts
    ├── 4. Run vitest on generated files (validate they compile + run)
    └── 5. git checkout -b ai/tests/<sha-7> → commit → gh pr create
```

**Limits per run:**
- Maximum 5 functions per execution (cost control)
- Maximum 1 PR per commit SHA (idempotency check before creating)
- `[skip ci]` in commit message prevents bot PR from triggering another cycle

---

## Section 1: Risk Heuristic

Uncovered functions are ranked by:

```
risk_score = import_count × (uncovered_lines / total_lines)
```

- `import_count`: number of files that import the module, found via `grep -r "from '.*<module>'"`.
- A function imported by 20 files with 0% coverage scores higher than a function imported by 1 file with 80% coverage.

**Scope:** All workspaces included in coverage:
- `apps/app/app/actions/**/*.ts`
- `apps/app/lib/**/*.ts`
- `packages/safe-engine/src/**/*.ts`
- `apps/api/app/**/*.ts`

---

## Section 2: Context Collection

For each function, the script collects before calling the API:

| Context piece | How collected | Max size |
|---------------|--------------|----------|
| Function source | Read file, extract function by name | ~50 lines |
| TypeScript types | Grep for interfaces/types used in params | ~30 lines |
| Prisma schema | If function uses `database.*`, read matching model from `packages/database/prisma/schema/` | ~20 lines |
| Feature docs | Glob `docs/**/<similar-name>*` for matching spec snippet | ~40 lines |
| Test patterns | Read one existing test file as style example (if any exists) | ~30 lines |

**Estimated input tokens per request:** 2,000–3,000  
**Estimated output tokens:** up to 4,096  
**Model:** `claude-haiku-4-5-20251001`  
**Cost estimate:** ~$0.001 per function, ~$0.005 per CI failure

---

## Section 3: Prompt Design

```
System: You are a Vitest/TypeScript test engineer for the COSMOS SAFe platform.
        Generate tests that reflect real behavior, not just structure.
        Use minimal mocks — only for external I/O (database calls, HTTP).
        Write describe/it blocks with descriptive Portuguese names.
        Output ONLY the TypeScript file content, no explanation.

User:
Function to test:
<function source>

TypeScript types:
<types>

Prisma model (if applicable):
<schema>

Feature documentation:
<docs snippet>

Test style example:
<existing test if any>

Generate __tests__/generated/<function-name>.test.ts covering:
1. Happy path with realistic inputs
2. Edge cases (null, empty, boundary values)
3. Error handling (what throws, what returns undefined)
4. Each branch of conditional logic
```

---

## Section 4: PR Creation Flow

```bash
# Idempotency check
existing=$(gh pr list --head "ai/tests/${GITHUB_SHA::7}" --json number | jq length)
if [ "$existing" -gt 0 ]; then exit 0; fi

# Configure bot identity
git config user.name "cosmos-ai-bot"
git config user.email "ai-bot@cosmos.app"

# Create branch and commit
git checkout -b "ai/tests/${GITHUB_SHA::7}"
git add __tests__/generated/
git commit -m "test(ai): generate tests for uncovered functions [skip ci]"
git push origin "ai/tests/${GITHUB_SHA::7}"

# Open PR
gh pr create \
  --title "🤖 AI: testes gerados para funções descobertas" \
  --body "Coverage abaixo de 60%. Haiku gerou testes para as 5 funções de maior risco.

**Funções cobertas:** <list>
**Coverage antes:** X% → **Estimado após merge:** Y%

⚠️ Revisar antes de merge — testes gerados por IA podem ter falsos positivos.

🤖 Generated with Claude Haiku 4.5" \
  --label "ai-generated,tests"
```

**GitHub Actions permissions required:**
```yaml
permissions:
  contents: write
  pull-requests: write
```

---

## Section 5: GitHub Actions Integration

New job added to `.github/workflows/ci.yml`:

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

    - name: Generate tests with AI
      run: pnpm tsx scripts/generate-tests.ts
```

**Required GitHub secret:** `ANTHROPIC_API_KEY`

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/generate-tests.ts` | Create — main generation script |
| `scripts/lib/coverage-parser.ts` | Create — parse json-summary, rank by risk |
| `scripts/lib/context-collector.ts` | Create — collect source + types + schema + docs |
| `scripts/lib/test-generator.ts` | Create — Claude API call + prompt |
| `scripts/lib/pr-creator.ts` | Create — git branch + commit + gh pr create |
| `.github/workflows/ci.yml` | Modify — add `generate-tests` job |
| `package.json` (root) | Modify — add `generate:tests` script for local use |

---

## Success Criteria

- When `test:coverage` fails in CI on `main`, a PR is automatically opened within 5 minutes.
- PR contains at least 3 test files for the highest-risk uncovered functions.
- Generated tests compile and run (`vitest run` exits 0 on the generated files).
- PR description includes before/after coverage estimate.
- No duplicate PRs for the same commit SHA.
- Total API cost per triggered run is under $0.01.
- `ANTHROPIC_API_KEY` is the only new secret required.

---

## Out of Scope

- Merging PRs autonomously (human always reviews)
- Generating E2E tests (Playwright) — unit/integration only
- Test generation for frontend components (React) — actions and pure functions only
- Phase 3 (AI Fix Loop for non-coverage failures)
- Phase 4 (AI risk scoring on PRs)
