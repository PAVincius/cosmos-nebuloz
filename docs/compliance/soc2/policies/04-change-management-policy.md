# Change Management Policy

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** Engineering Lead
**Review cycle:** Annual

---

## 1. Purpose

Ensure all changes to Cosmos production systems are planned, reviewed, tested, and deployed in a controlled manner that minimizes risk to security, availability, and data integrity.

## 2. Scope

All changes to:
- Application code (frontend, backend, APIs)
- Database schema (migrations)
- Infrastructure configuration (Vercel, Railway, Supabase, Upstash)
- Security controls (WAF rules, CSP, rate limits)
- Third-party integrations

## 3. Change Categories

| Category | Description | Approval | Testing Required |
|----------|-------------|----------|-----------------|
| **Standard** | Routine features, bug fixes, dependency updates | PR review (1 engineer) | Unit + integration |
| **Significant** | New features with customer data impact, schema changes | PR review (Engineering Lead) | Full test suite + staging |
| **Emergency** | P0/P1 incident hotfix | Engineering Lead (async OK) | Smoke test; full suite post-deploy |
| **Infrastructure** | Cloud config, environment variables, secrets | CTO approval | Staging validation |

## 4. Development Workflow

### 4.1 Branching Strategy

```
main          ← production (protected)
  └─ feat/description    ← feature branches
  └─ fix/description     ← bug fix branches
  └─ hotfix/description  ← emergency fixes
```

Direct commits to `main` are blocked. All changes go through pull requests.

### 4.2 Pull Request Requirements

All PRs must:
- [ ] Have a descriptive title following conventional commits (`feat:`, `fix:`, `refactor:`, etc.)
- [ ] Include a description of what changed and why
- [ ] Pass all CI checks (lint, type check, tests, audit)
- [ ] Have at least 1 approval from a qualified reviewer
- [ ] Not have unresolved review comments

Security-sensitive PRs (auth, permissions, data access) require Engineering Lead review.

### 4.3 CI/CD Pipeline

Every push to a PR branch runs:
1. `pnpm lint` — code style and quality
2. `pnpm typecheck` — TypeScript type safety
3. `pnpm test` — unit and integration tests
4. `pnpm audit` — dependency vulnerability scan (blocks on critical/high)
5. Preview deployment to Vercel (for UI changes)

Every merge to `main` runs:
1. All CI checks above
2. E2E test suite
3. Production deployment (Vercel / Railway)
4. Post-deploy smoke tests

### 4.4 Database Migrations

- Migrations written with Prisma (`prisma migrate dev`)
- Migrations are forward-only (no destructive rollbacks in production)
- Migration tested on staging before production
- Rollback plan documented in PR for significant schema changes

## 5. Deployment Process

### 5.1 Standard Deployment (automated)
1. Merge to `main` triggers CI/CD
2. Tests pass → automatic deploy to production
3. Post-deploy health check via `/api/health`
4. BetterStack uptime check confirms availability

### 5.2 Infrastructure Changes
1. Change proposed in GitHub issue with justification
2. CTO reviews and approves
3. Applied to staging first
4. Validated for 30 minutes on staging
5. Applied to production
6. Monitored for 1 hour post-change

### 5.3 Emergency Hotfix
1. Create `hotfix/` branch from `main`
2. Apply minimal fix
3. Engineering Lead reviews (async via mobile if needed)
4. Deploy to production
5. Full test suite runs post-deploy
6. Post-mortem documents the emergency and preventive measures

## 6. Rollback

- **Application code:** Vercel instant rollback (<30 seconds) — available via Vercel dashboard or CLI
- **Database migrations:** Forward-only; data fix migrations applied via emergency hotfix process
- **Infrastructure:** Previous configuration restored from git history

Rollback decision authority: Engineering Lead or CTO.

## 7. Change Log

All significant changes are documented in:
- Git commit history (source of truth)
- GitHub PR description (context and justification)
- CHANGELOG.md (customer-facing summary)

---

*Approved by: CTO, Nebuloz*
*Date: 2026-05-19*
