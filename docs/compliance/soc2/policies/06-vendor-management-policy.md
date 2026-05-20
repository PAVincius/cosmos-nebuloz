# Vendor Management Policy

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** CTO
**Review cycle:** Annual

---

## 1. Purpose

Ensure third-party vendors and sub-processors that access or process Cosmos or customer data meet security standards equivalent to Cosmos's own controls.

## 2. Scope

Any vendor that:
- Processes customer personal data (Level 3/4 per Data Classification Policy)
- Has network access to Cosmos production systems
- Provides security-critical services (auth, payments, infrastructure)

## 3. Vendor Risk Tiers

| Tier | Definition | Due Diligence |
|------|-----------|--------------|
| **Tier 1 — Critical** | Processes customer data or provides core infrastructure | Full assessment: SOC2 report, DPA, security questionnaire, annual review |
| **Tier 2 — Significant** | Has access to internal data or systems | DPA + security questionnaire + annual review |
| **Tier 3 — Standard** | Limited access, no customer data | Standard terms of service review |

## 4. Vendor Assessment Process

### 4.1 New Vendor Onboarding

Before engaging a Tier 1 or Tier 2 vendor:
1. Request SOC2 Type II report (or equivalent: ISO 27001, CSA STAR)
2. Require signed Data Processing Agreement (DPA) if personal data is processed
3. Complete security questionnaire (encryption, access controls, incident notification)
4. Engineering Lead reviews and approves
5. CTO approves for Tier 1 vendors

### 4.2 Ongoing Vendor Review

Annually:
- Confirm vendor's SOC2 report is current (not expired)
- Review any security incidents disclosed by vendor
- Re-assess tier if vendor's scope changes
- Verify DPA is still adequate for current data flows

### 4.3 Vendor Offboarding

When terminating a vendor relationship:
1. Revoke all API keys and access credentials immediately
2. Request data deletion confirmation in writing
3. Verify deletion within 30 days
4. Document offboarding in vendor registry

## 5. Critical Vendor Registry

| Vendor | Tier | Purpose | Compliance | DPA | Review Date |
|--------|------|---------|-----------|-----|------------|
| Supabase | 1 | Primary database | SOC2 Type II | ✅ | 2027-05 |
| Vercel | 1 | App hosting + CDN | SOC2 Type II | ✅ | 2027-05 |
| Railway | 1 | Backend hosting | SOC2 Type I | ✅ | 2027-05 |
| Stripe | 1 | Payments | SOC2 + PCI DSS | ✅ | 2027-05 |
| BetterStack | 1 | Logging + monitoring | SOC2 Type II | ✅ | 2027-05 |
| Upstash | 1 | Rate limiting / Redis | SOC2 Type II | ✅ | 2027-05 |
| Resend | 1 | Transactional email | SOC2 Type II | ✅ | 2027-05 |
| PostHog | 2 | Analytics | SOC2 Type II | ✅ | 2027-05 |
| Arcjet | 1 | WAF + bot protection | SOC2 Type II | ✅ | 2027-05 |
| GitHub | 2 | Source control + CI | SOC2 Type II | ✅ | 2027-05 |
| OpenAI / Anthropic | 1 | AI services | SOC2 Type II | ✅ | 2027-05 |

## 6. Contractual Requirements

All Tier 1/2 vendor contracts must include:
- Data Processing Agreement with LGPD/GDPR-compliant terms
- Security incident notification within 72 hours of discovery
- Right to audit (or accept third-party audit reports)
- Data deletion upon contract termination
- Sub-processor change notification

## 7. Open Source Dependencies

- Third-party libraries are treated as Tier 3 vendors
- Dependency vulnerability scanning on every CI run (`pnpm audit`)
- Critical/High CVEs block deployment
- Dependencies reviewed for license compatibility quarterly

---

*Approved by: CTO, Nebuloz*
*Date: 2026-05-19*
