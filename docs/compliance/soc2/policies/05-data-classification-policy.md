# Data Classification and Retention Policy

**Version:** 1.1
**Effective date:** 2026-05-19 · **Revised:** 2026-09-02
**Owner:** CTO
**Review cycle:** Annual

> **Revision 1.1.** Four statements in v1.0 described a system that does not
> exist: the sub-processor list named vendors not in the stack and omitted every
> AI provider; every DPA was marked signed without evidence; audit logs were
> said to hold "no personal data except user IDs" while storing IP and
> user-agent; and a "Day 30 automated deletion job" was described that was never
> built. Each is corrected below to describe what actually runs. Findings and
> evidence: `docs/compliance/lgpd-ropa-e-lacunas.md` §2.

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
- Database: AES-256 (Neon/PostgreSQL provider encryption)
- Object storage: AES-256 (provider-managed)
- Secrets: Stored in environment variables; production secrets in Vercel's encrypted secret store. Integration credentials (`MeetingIntegration.config`, `Integration` tokens) are additionally encrypted at the application layer with `ENCRYPTION_KEY`
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
1. Day 0: Tenant modules set to `CANCELED` via the back-office (`setModuleStatus`), which closes access without deleting data
2. By Day 30: **Manual** deletion of tenant data by platform staff, executed against the production database and recorded in the platform audit trail. **There is no automated tenant-deletion job.** v1.0 described one; it was never built. Until it exists, this step is a human procedure with a named owner, and the 30-day commitment is met by calendar, not by scheduler.
3. Day 30: Backups containing tenant data aged out within backup retention window (30 days)
4. Audit logs retained for 12 months. **They contain personal data**: `AuditLog` stores IP address and user-agent alongside user IDs, and `AccessLog` stores email, IP and user-agent for every login attempt, including refused ones. Retention rests on legitimate interest (security and accountability) and on the audit-log immutability decision (ADR-0009). Erasure requests anonymize the identifiers in `AccessLog` while preserving the event; `AuditLog` is not modified by erasure, by design.
5. Deletion confirmation email sent to tenant owner

### Right to Erasure (LGPD Art. 18 / GDPR Art. 17)

Upon verified request:
- Process within 15 business days
- Anonymize personal data in active systems (the platform anonymizes rather than hard-deletes, using a stable hash as the replacement so referential integrity survives). Implemented in `processErasureRequest`, triggered from the user's settings, tracked in `DataSubjectRequest`, and audited on completion. Coverage: user profile, standup entries, copilot messages, meeting participants and transcript-derived content, access logs (identifiers only), and Meridian respondent records.
- Remove from backups at next backup cycle
- Confirm deletion in writing
- Exceptions: legal hold, legitimate interest basis documented — concretely, `AuditLog` (immutable, ADR-0009) and the event/timestamp columns of `AccessLog`
- **Known gap:** the in-app request requires an authenticated session. Data subjects who never had an account — Meridian respondents invited by link, meeting participants — can only request via `privacy@nebuloz.ai`, and resolution depends on the processor/controller determination pending in the DPA.

## 6. Data Subject Rights (LGPD/GDPR)

| Right | How to Request | Response Time |
|-------|---------------|--------------|
| Access (what data do you hold) | Email privacy@nebuloz.ai | 15 business days |
| Rectification (correct data) | In-app settings or email | 15 business days |
| Erasure (right to be forgotten) | Email privacy@nebuloz.ai | 15 business days |
| Portability (export data) | In-app export or email | 15 business days |
| Restriction of processing | Email privacy@nebuloz.ai | 15 business days |
| Objection to processing | Email privacy@nebuloz.ai | 15 business days |

## 7. Sub-Processors

Sub-processors are listed from the platform's actual dependencies, not from a template. **The DPA column reflects verified contract status, not intent.** v1.0 marked every row as signed; none of those marks had evidence behind them. A DPA is a contractual fact and is recorded here only once confirmed. Full inventory with what each vendor processes: `docs/runbooks/charter-nebuloz.md` §5.

### AI sub-processors — receive customer content

| Sub-Processor | Purpose | Location | DPA |
|--------------|---------|---------|-----|
| Anthropic | LLM — default route for AI features (policy drafting, copilot, epic analysis, cost narratives) | US | To confirm |
| OpenAI | LLM — secondary route | US | To confirm |
| Google | LLM — tertiary route | US | To confirm |
| Langfuse | LLM observability. Prompt/response content is masked unless `LANGFUSE_CAPTURE_CONTENT` is explicitly enabled; must never be enabled where customer data is present | To confirm | To confirm |
| Fireflies | Meeting transcription. Transcript-derived content is processed only after consent is `GRANTED` (default deny) | To confirm | To confirm |

### Infrastructure sub-processors

| Sub-Processor | Purpose | Location | DPA |
|--------------|---------|---------|-----|
| Neon | Primary database (PostgreSQL) | To confirm | To confirm |
| Vercel | Application hosting and execution | US + Edge | To confirm |
| Upstash | Rate limiting and module cache | US + EU | To confirm |
| Sentry | Error monitoring — stack traces may carry incidental personal data | To confirm | To confirm |
| Liveblocks | Real-time collaboration — document content in transit | To confirm | To confirm |
| Resend | Transactional email | US | To confirm |
| Arcjet | Edge security | To confirm | To confirm |
| Inngest | Background job execution — orchestrates the Fireflies pipeline and inherits its exposure | To confirm | To confirm |
| BetterStack | Logging (configured; verify active use) | EU | To confirm |
| PostHog | Product analytics (verify what is sent per event) | EU | To confirm |

Removed from v1.0: **Supabase / Railway** (not in the stack — the database is Neon and hosting is Vercel) and **Stripe** (dependency present, active use unconfirmed; re-add once payments are live).

---

*Approved by: CTO, Nebuloz*
*Date: 2026-05-19*
