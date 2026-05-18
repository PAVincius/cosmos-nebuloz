# Quality Gates — Phase 4: AI Risk Scoring on PRs

**Date:** 2026-05-18  
**Status:** Approved  
**Scope:** AI-generated risk score posted as a PR comment on every pull request  
**Depends on:** Phase 1 (CI/CD), Phases 2–3 (shared `scripts/lib/*` structure)

---

## Context

Phases 1–3 react to problems after they happen. Phase 4 shifts left: every PR gets a structured risk analysis before merge, covering security, regression risk, and SAFe domain impact. The analysis is informational — it never blocks merge. The developer reads and decides.

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation: CI/CD + pre-commit hooks | Done |
| 2 | Safety Net: AI test generation | Specced |
| 3 | AI Fix Loop: auto-fix deterministic CI failures | Specced |
| **4** | **Prevention: AI risk scoring on every PR** | **This spec** |

---

## Goals

- Every PR receives a structured risk comment within 2 minutes of open/update.
- Analysis covers 3 dimensions: security, regression, SAFe domain impact.
- Model routing keeps cost proportional to actual risk: Haiku for routine PRs, Sonnet for PRs touching auth/schema/tenant.
- Comment is updated (not duplicated) on each new push to the PR.
- Never blocks merge — informational only.
- Estimated cost: < $0.50/week at 10 PRs/week volume.

---

## Architecture

```
on: pull_request (opened, synchronize, reopened)
    ↓
risk-score job
    ↓
scripts/risk-score.ts
    ├── 1. gh pr diff → raw diff string
    ├── 2. Model routing heuristic:
    │       diff touches {prisma/schema, auth/, middleware, rls, tenant, security/}
    │       → claude-sonnet-4-6  (~$0.03)
    │       else
    │       → claude-haiku-4-5-20251001  (~$0.002)
    ├── 3. Call model with diff + repo context
    ├── 4. Receive structured JSON:
    │       { score, model_used, security[], regression[], safe_domain[],
    │         summary, checklist[] }
    └── 5. gh pr comment --edit-last (update existing comment if present)
```

---

## Section 1: Model Routing

**Critical path keywords (trigger Sonnet):**
```typescript
const CRITICAL_PATHS = [
  'prisma/schema',
  'packages/auth/',
  'middleware',
  'rls',
  'tenant',
  'security/',
  'packages/database/',
];

const usesSonnet = CRITICAL_PATHS.some(path => diff.includes(path));
```

**Cost estimate:**
- Routine PR (Haiku): ~$0.002
- Security/schema PR (Sonnet): ~$0.03
- 10 PRs/week mixed: < $0.15/week

---

## Section 2: Prompt

```
System: You are a senior engineer reviewing a PR for the COSMOS SAFe platform.
        It is a multi-tenant Next.js app using Prisma, Better Auth, and RLS.
        Analyze the diff across 3 dimensions and return JSON only.

        Scoring: LOW (safe to merge), MEDIUM (review recommended),
                 HIGH (careful review required), CRITICAL (stop and review)

User:
PR diff:
<raw diff>

Analyze:
1. SECURITY: RLS policies, auth bypass, tenant isolation, exposed secrets,
             SQL injection, XSS vectors, unvalidated inputs at system boundaries
2. REGRESSION: import count of changed files, test coverage of changed lines,
               breaking interface changes, side effects in shared packages
3. SAFE_DOMAIN: changes to PI Planning, Flow Metrics, ART governance,
                Lean Budget — these affect all tenants simultaneously

Return JSON:
{
  "score": "LOW|MEDIUM|HIGH|CRITICAL",
  "model_used": "haiku|sonnet",
  "security":    [{ "risk": "string", "location": "file:line", "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "regression":  [{ "risk": "string", "location": "string",   "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "safe_domain": [{ "risk": "string", "location": "string",   "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "summary": "one paragraph plain text",
  "checklist": ["item reviewer should verify before merging"]
}
```

---

## Section 3: PR Comment Format

```markdown
## AI Risk Score: HIGH

Model: Claude Sonnet 4.6 | Diff: +247/-89 lines

### Security
- HIGH: `packages/auth/server.ts:42` — token expiry check uses `<` not `<=`

### Regression
- MEDIUM: `packages/safe-engine/src/wsjf.ts` — imported by 12 files, no tests cover changed lines

### SAFe Domain
- HIGH: `app/actions/flow-metrics/index.ts` — Flow Efficiency calculation changed, affects all tenants

### Summary
Change touches core auth logic and flow metric calculations. Both areas
are imported widely and have no test coverage on the modified lines.
Review token expiry behavior and validate Flow Efficiency output in staging.

### Checklist before merge
- [ ] Verify token expiry still works with active sessions
- [ ] Run manual Flow Metrics test on staging tenant
- [ ] Check that RLS policies still apply after schema migration

---
Generated with Claude Sonnet 4.6
```

**Update behavior:** `gh pr comment --edit-last` replaces the previous risk score comment on each new push. One comment per PR, always current.

---

## Section 4: GitHub Actions Integration

Addition to `.github/workflows/ci.yml`:

```yaml
risk-score:
  name: AI Risk Score
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  permissions:
    pull-requests: write
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    PR_NUMBER: ${{ github.event.pull_request.number }}
  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4
      with:
        version: 10.24.0

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: AI risk score
      run: pnpm tsx scripts/risk-score.ts
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/risk-score.ts` | Create — orchestrator: diff fetch, routing, call, comment |
| `scripts/lib/model-router.ts` | Create — Haiku vs Sonnet routing heuristic |
| `scripts/lib/risk-analyzer.ts` | Create — prompt construction + API call |
| `scripts/lib/pr-commenter.ts` | Create — gh pr comment --edit-last logic |
| `.github/workflows/ci.yml` | Modify — add `risk-score` job |

---

## Success Criteria

- Every PR receives a risk comment within 2 minutes of open or push.
- Comment is updated (not duplicated) on subsequent pushes.
- PRs touching `auth/`, `prisma/schema`, or `tenant` are routed to Sonnet automatically.
- JSON response is always valid and parseable (retry once if malformed).
- Weekly cost at 10 PRs/week stays under $0.50.
- `ANTHROPIC_API_KEY` is already present from Phases 2–3 — no new secrets.

---

## Out of Scope

- Blocking merges based on risk score (informational only)
- Auto-requesting specific reviewers based on risk areas
- Historical risk score tracking (dashboard)
- Scoring commits pushed directly to main (PR-only)
