# SOC2 Type I — Compliance Tracker

**Target:** SOC2 Type I certification
**Scope:** Cosmos platform (SaaS) — all Trust Service Criteria (Security required, Availability optional)
**Auditor:** TBD
**Last reviewed:** 2026-05-19

---

## Trust Service Criteria (TSC) Status

### CC1 — Control Environment

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC1.1 | Information security policy documented and communicated | ✅ | `policies/01-information-security-policy.md` |
| CC1.2 | Security roles and responsibilities defined | ✅ | `policies/01-information-security-policy.md` §3 |
| CC1.3 | Security awareness training program | ⚠️ Planned | Annual training — Q3 2026 |
| CC1.4 | Background checks for new hires | ⚠️ Planned | HR process — Q3 2026 |

### CC2 — Communication and Information

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC2.1 | Internal security communication process | ✅ | `policies/01-information-security-policy.md` §5 |
| CC2.2 | External vulnerability disclosure process | ✅ | `SECURITY.md` |
| CC2.3 | Incident communication to customers | ✅ | `policies/02-incident-response-plan.md` §6 |

### CC3 — Risk Assessment

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC3.1 | Risk assessment process defined | ✅ | `policies/01-information-security-policy.md` §6 |
| CC3.2 | Risks identified and ranked | ⚠️ Planned | Risk register — Q3 2026 |
| CC3.3 | Risk mitigation plans | ⚠️ Planned | Per-risk mitigation — Q3 2026 |

### CC4 — Monitoring Activities

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC4.1 | Continuous monitoring of security controls | ✅ | BetterStack alerts, audit logs |
| CC4.2 | Periodic access reviews | ⚠️ Planned | Quarterly — Q3 2026 |
| CC4.3 | Security metrics tracked | ✅ | BetterStack dashboard |

### CC5 — Control Activities

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC5.1 | Policies and procedures documented | ✅ | `policies/` |
| CC5.2 | Security controls implemented | ✅ | WAF, rate-limit, CSP, headers |
| CC5.3 | Code review required before deployment | ✅ | `policies/04-change-management-policy.md` |

### CC6 — Logical and Physical Access Controls

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC6.1 | Authentication required for all access | ✅ | Better Auth middleware |
| CC6.2 | MFA enforced for privileged accounts | ✅ | Better Auth TOTP, middleware check |
| CC6.3 | Session timeout configured | ✅ | 24h idle / 7d absolute |
| CC6.4 | RBAC with least privilege | ✅ | `policies/03-access-control-policy.md` |
| CC6.5 | Access provisioning/deprovisioning process | ✅ | `policies/03-access-control-policy.md` §4 |
| CC6.6 | Multi-tenant data isolation | ✅ | PostgreSQL RLS on all tables |
| CC6.7 | Audit log of access events | ✅ | `packages/audit/` |
| CC6.8 | Encryption in transit | ✅ | TLS 1.2+ enforced |
| CC6.9 | Encryption at rest | ✅ | AES-256 (Supabase) |

### CC7 — System Operations

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC7.1 | Vulnerability management program | ✅ | `pnpm audit` in CI |
| CC7.2 | Malware/threat protection | ✅ | Arcjet WAF + bot detection |
| CC7.3 | Security incident detection | ✅ | Audit log alerts |
| CC7.4 | Incident response procedures | ✅ | `policies/02-incident-response-plan.md` |
| CC7.5 | Recovery from incidents | ✅ | `policies/07-business-continuity-plan.md` |

### CC8 — Change Management

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC8.1 | Change management policy | ✅ | `policies/04-change-management-policy.md` |
| CC8.2 | Code review before merge | ✅ | GitHub PR policy |
| CC8.3 | Testing before production deploy | ✅ | CI/CD pipeline |
| CC8.4 | Rollback capability | ✅ | Vercel instant rollback |

### CC9 — Risk Mitigation

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| CC9.1 | Business continuity plan | ✅ | `policies/07-business-continuity-plan.md` |
| CC9.2 | Vendor risk management | ✅ | `policies/06-vendor-management-policy.md` |
| CC9.3 | Cyber insurance | ⚠️ Planned | Q3 2026 |

### Availability

| Control | Description | Status | Evidence |
|---------|-------------|--------|----------|
| A1.1 | Availability commitments defined (SLA) | ✅ | 99.9% uptime SLA |
| A1.2 | Uptime monitoring | ✅ | BetterStack |
| A1.3 | Disaster recovery plan with RTO/RPO | ✅ | `policies/07-business-continuity-plan.md` |

---

## Policy Documents

| # | Document | Status |
|---|----------|--------|
| 01 | [Information Security Policy](policies/01-information-security-policy.md) | ✅ |
| 02 | [Incident Response Plan](policies/02-incident-response-plan.md) | ✅ |
| 03 | [Access Control Policy](policies/03-access-control-policy.md) | ✅ |
| 04 | [Change Management Policy](policies/04-change-management-policy.md) | ✅ |
| 05 | [Data Classification & Retention Policy](policies/05-data-classification-policy.md) | ✅ |
| 06 | [Vendor Management Policy](policies/06-vendor-management-policy.md) | ✅ |
| 07 | [Business Continuity Plan](policies/07-business-continuity-plan.md) | ✅ |

---

## Open Items (⚠️)

| Item | Owner | Target |
|------|-------|--------|
| Security awareness training program | CTO | Q3 2026 |
| Background checks process | HR | Q3 2026 |
| Formal risk register | CTO | Q3 2026 |
| Quarterly access reviews (first run) | Engineering | Q3 2026 |
| Cyber insurance | CEO | Q3 2026 |
| Penetration test (first annual) | CTO | Q3 2026 |

---

## Audit Readiness Checklist

- [x] All policies documented and dated
- [x] Technical controls implemented and evidenced
- [x] Audit logging active (security events captured)
- [x] Encryption in transit and at rest
- [x] Multi-tenant data isolation (RLS)
- [x] MFA enforced for admin roles
- [x] Incident response plan with customer notification SLA
- [x] Vulnerability scanning in CI
- [ ] First penetration test completed
- [ ] Quarterly access review completed
- [ ] Security training delivered to all staff
- [ ] Risk register populated
- [ ] Cyber insurance active
