# Security Policy

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities by email: **security@nebuloz.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

Response time: **24 hours** acknowledgment, **72 hours** initial assessment.

We follow responsible disclosure — coordinated publication after a fix is deployed.

## Supported Versions

| Version | Security Updates |
|---------|----------------|
| Latest  | ✅ Active       |
| < 1.0   | ❌ Not supported |

## Security Architecture

Cosmos is a multi-tenant SaaS platform. Security is layered:

### Authentication & Authorization
- **Better Auth** — session-based auth with JWT, OAuth providers, magic links
- **Two-Factor Authentication (TOTP)** — enforced for admin roles
- **RBAC** — roles: `owner`, `admin`, `rte`, `po`, `sm`, `member`, `viewer`
- **Session timeout** — 24h idle, 7d absolute

### Network Security
- **WAF** (Arcjet) — shields against OWASP Top 10 attacks
- **Bot detection** — blocks scrapers, allows search engines and monitoring
- **Rate limiting** — Upstash sliding window (10 req/10s per identifier)
- **Security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Content Security Policy (CSP)** — strict, nonce-based

### Data Security
- **Encryption in transit** — TLS 1.2+ enforced on all endpoints
- **Encryption at rest** — AES-256 via Supabase/PostgreSQL provider
- **Multi-tenant isolation** — Row-Level Security (RLS) on all database tables
- **Secrets management** — environment variables only, no secrets in source code

### Monitoring & Logging
- **Audit logging** — all security events: login, logout, permission changes, data exports
- **Application logging** — BetterStack (production), structured JSON
- **Uptime monitoring** — BetterStack (99.9% SLA target)
- **Alerting** — anomaly detection on failed logins, unusual API activity

### Compliance
- SOC2 Type I (in progress) — see `docs/compliance/soc2/`
- LGPD / GDPR compliant data handling
- Annual penetration testing

## Security Controls by Layer

| Layer | Control | Status |
|-------|---------|--------|
| Auth | Better Auth + 2FA | ✅ Active |
| Auth | MFA enforcement for admins | ✅ Active |
| Network | Arcjet WAF | ✅ Active |
| Network | Rate limiting (Upstash) | ✅ Active |
| Network | Security headers + CSP | ✅ Active |
| Data | TLS 1.2+ in transit | ✅ Active |
| Data | AES-256 at rest | ✅ Active |
| Data | RLS multi-tenant isolation | ✅ Active |
| Monitoring | Audit logging | ✅ Active |
| Monitoring | BetterStack logging | ✅ Active |
| Monitoring | Uptime monitoring | ✅ Active |
| Dependency | Automated vulnerability scanning | ✅ CI/CD |

## Dependencies

Dependencies are scanned on every CI run using `pnpm audit`. Critical and high vulnerabilities block deployment.

Dependency updates are reviewed weekly.

## Incident Response

See `docs/compliance/soc2/policies/02-incident-response-plan.md` for the full incident response playbook.

Summary:
1. Detection — automated alerts or user report
2. Triage — severity classification (P0–P3)
3. Containment — isolate affected systems within 1 hour (P0)
4. Eradication — remove root cause
5. Recovery — restore service
6. Post-mortem — within 5 business days

**P0 (Critical breach):** Notify affected customers within 72 hours per LGPD/GDPR.
