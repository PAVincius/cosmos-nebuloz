# Data Classification and Retention Policy

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** CTO
**Review cycle:** Annual

---

## 1. Purpose

Define how Cosmos classifies, handles, and retains data to protect customer information and meet regulatory obligations (LGPD, GDPR).

## 2. Data Classification Levels

### Level 1 — Public
**Definition:** Information intended for public consumption.
**Examples:** Marketing content, public documentation, product changelog.
**Controls:** No special handling required.

### Level 2 — Internal
**Definition:** Internal business information not for public release.
**Examples:** Internal architecture docs, team communications, non-sensitive business metrics.
**Controls:** Accessible to employees only. Not shared externally without approval.

### Level 3 — Confidential
**Definition:** Sensitive business or customer information that could cause harm if disclosed.
**Examples:** Customer tenant configuration, API keys, integration credentials, business contracts, employee personal data, financial data.
**Controls:**
- Encrypted at rest and in transit
- Access restricted by role (least privilege)
- Audit logged on access
- Not stored in personal devices or unapproved cloud services

### Level 4 — Restricted (Personal Data)
**Definition:** Personal data as defined by LGPD/GDPR — any information that identifies or can identify a natural person.
**Examples:** Customer user names, email addresses, IP addresses, usage behavior, any PII collected via the platform.
**Controls:**
- All controls from Level 3
- Processed only under lawful basis (contract, consent, legitimate interest)
- Data minimization — collect only what is necessary
- Subject rights honored (access, rectification, erasure, portability)
- DPA (Data Processing Agreement) with all sub-processors
- Breach notification within 72 hours (LGPD/GDPR)

## 3. Data Inventory

| Data Category | Classification | Storage | Retention |
|---------------|---------------|---------|-----------|
| Tenant configuration | Confidential | PostgreSQL (encrypted) | Duration of contract + 30 days |
| User accounts (email, name) | Restricted | PostgreSQL (encrypted) | Duration of account + 30 days post-deletion |
| User activity / audit logs | Restricted | PostgreSQL + BetterStack | 12 months |
| PI Planning data (epics, features, stories) | Confidential | PostgreSQL (encrypted) | Duration of contract + 30 days |
| Integration credentials (Jira, ADO tokens) | Restricted | Encrypted secrets | Duration of integration |
| Payment information | Restricted | Stripe (not stored by Cosmos) | Not stored — Stripe PCI scope |
| Application logs | Internal | BetterStack | 30 days |
| Audit logs | Confidential | PostgreSQL + cold storage | 12 months |
| Backup snapshots | Confidential | Encrypted cloud storage | 30 days |
| Analytics / product metrics | Internal | PostHog | 24 months |

## 4. Encryption Standards

### In Transit
- TLS 1.2 minimum, TLS 1.3 preferred
- HSTS enforced (Strict-Transport-Security: max-age=31536000; includeSubDomains)
- Certificate rotation automated (provider-managed)

### At Rest
- Database: AES-256 (Supabase/PostgreSQL provider encryption)
- Object storage: AES-256 (provider-managed)
- Secrets: Stored in environment variables; production secrets in Vercel/Railway encrypted secret store
- Backups: Encrypted before storage

### Credentials and Tokens
- Passwords hashed with bcrypt (cost factor ≥ 12) via Better Auth
- API tokens are hashed before storage (never stored in plaintext)
- Integration tokens encrypted at field level

## 5. Data Retention

### Retention Periods

| Category | Retention Period | Basis |
|----------|-----------------|-------|
| Customer data (active contract) | Duration of contract | Contract |
| Customer data (post-cancellation) | 30 days | Data minimization |
| Audit logs | 12 months | Security / regulatory |
| Application logs | 30 days | Operations |
| Backup snapshots | 30 days | Recovery |
| Legal hold data | Until hold released | Legal requirement |
| Employee data | Duration of employment + 5 years | Labor law |

### Deletion Process

On customer account deletion or contract end:
1. Day 0: Tenant marked inactive (no new access)
2. Day 30: Automated deletion job removes all tenant data from active database
3. Day 30: Backups containing tenant data aged out within backup retention window (30 days)
4. Audit logs retained for 12 months (no personal data except user IDs)
5. Deletion confirmation email sent to tenant owner

### Right to Erasure (LGPD Art. 18 / GDPR Art. 17)

Upon verified request:
- Process within 15 business days
- Delete personal data from active systems immediately
- Remove from backups at next backup cycle
- Confirm deletion in writing
- Exceptions: legal hold, legitimate interest basis documented

## 6. Data Subject Rights (LGPD/GDPR)

| Right | How to Request | Response Time |
|-------|---------------|--------------|
| Access (what data do you hold) | Email privacy@nebuloz.com | 15 business days |
| Rectification (correct data) | In-app settings or email | 15 business days |
| Erasure (right to be forgotten) | Email privacy@nebuloz.com | 15 business days |
| Portability (export data) | In-app export or email | 15 business days |
| Restriction of processing | Email privacy@nebuloz.com | 15 business days |
| Objection to processing | Email privacy@nebuloz.com | 15 business days |

## 7. Sub-Processors

All sub-processors handling Level 3/4 data have signed Data Processing Agreements (DPAs):

| Sub-Processor | Purpose | Location | DPA |
|--------------|---------|---------|-----|
| Supabase / Railway | Primary database | US (+ EU option) | ✅ |
| Vercel | Application hosting | US + Edge | ✅ |
| Upstash | Rate limiting cache | US + EU | ✅ |
| BetterStack | Logging + monitoring | EU | ✅ |
| Stripe | Payment processing | US | ✅ |
| PostHog | Product analytics | EU (self-hostable) | ✅ |
| Resend | Transactional email | US | ✅ |

---

*Approved by: CTO, Nebuloz*
*Date: 2026-05-19*
