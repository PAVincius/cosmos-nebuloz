# Access Control Policy

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** Engineering Lead
**Review cycle:** Annual + quarterly access reviews

---

## 1. Purpose

Define how access to Cosmos systems and customer data is granted, maintained, reviewed, and revoked, enforcing least privilege and preventing unauthorized access.

## 2. Scope

All access to:
- Cosmos production systems (application, database, infrastructure)
- Cloud providers (Vercel, Supabase/Railway, Upstash)
- CI/CD systems (GitHub)
- Monitoring systems (BetterStack)
- Third-party SaaS tools with access to customer data

## 3. RBAC Model

### 3.1 Platform Roles (within a Tenant)

| Role | Description | Capabilities |
|------|-------------|-------------|
| `ADMIN` | Tenant administrator | User management, all features, integrations, billing |
| `STE` | Solution Train Engineer | Cross-ART planning, portfolio, all PI Planning |
| `RTE` | Release Train Engineer | Full PI Planning, ART management, program board |
| `PO` | Product Owner | Feature management, PI objectives, backlog |
| `SM` | Scrum Master | Team ceremonies, retrospectives, team board |
| `DEV` | Developer | Read/write own team's features and tasks |
| `MEMBER` | Team member | Read/write within assigned team scope |

### 3.2 Internal Roles (Cosmos staff)

| Role | Description | Systems |
|------|-------------|---------|
| `super-admin` | Cosmos engineering | All systems, all tenants (audited) |
| `support` | Customer support | Read tenant data with customer consent only |
| `billing-admin` | Finance | Billing system only |

### 3.3 Privilege Escalation

No production system access is permitted without:
1. Explicit role assignment in the IAM system
2. MFA verified session
3. Audit log entry created

Super-admin actions on customer tenant data require a support ticket reference.

## 4. Access Lifecycle

### 4.1 Provisioning (New Access)

**For employees:**
1. Manager submits access request with justification
2. Engineering Lead approves within 2 business days
3. Access granted with minimum necessary permissions
4. User completes security onboarding before access is activated

**For customers:**
1. Tenant owner creates accounts via platform UI
2. Role assigned by tenant owner or admin
3. Audit log entry created automatically

### 4.2 Access Changes

- Role changes require same approval process as new access
- Temporary elevated access expires automatically (max 24 hours)
- All changes are audit-logged

### 4.3 Deprovisioning (Revoking Access)

| Trigger | Timeline | Process |
|---------|----------|---------|
| Employee resignation | Day of last day | All access revoked before last day ends |
| Employee termination | Immediate | IT/Engineering revokes all access on notification |
| Contract end | Day of end | Access revoked on contract end date |
| Role change | Day of change | Old access revoked, new access granted |
| Customer churn | Immediate | Tenant deactivated, data retained per policy |

Deprovisioning checklist:
- [ ] Revoke application account
- [ ] Revoke cloud provider access (Vercel, Supabase, Upstash)
- [ ] Revoke GitHub access
- [ ] Revoke BetterStack access
- [ ] Invalidate all active sessions
- [ ] Rotate shared credentials the person had access to

### 4.4 Quarterly Access Reviews

Every quarter, Engineering Lead:
1. Exports list of all active users and roles
2. Reviews each account for continued business justification
3. Removes or downgrades unnecessary access
4. Documents review in `docs/compliance/soc2/access-reviews/YYYY-QN.md`

## 5. Authentication Requirements

### 5.1 MFA Policy

| Role | MFA Required | Type |
|------|-------------|------|
| Internal super-admin | **Mandatory** | TOTP + hardware key recommended |
| `ADMIN`, `STE` | **Mandatory** | TOTP (enforced by middleware) |
| `RTE`, `PO`, `SM` | Strongly recommended | TOTP |
| `DEV`, `MEMBER` | Optional | TOTP |

MFA bypass is not permitted. Lost MFA device → identity verification by Engineering Lead before reset.

### 5.2 Session Policy

- **Idle timeout:** 24 hours
- **Absolute timeout:** 7 days (re-authentication required)
- **Concurrent sessions:** Allowed (shown in account settings)
- **Session revocation:** Available to user and admins at any time

### 5.3 Password Policy

- Minimum 12 characters
- Complexity: uppercase, lowercase, number, symbol
- No reuse of last 12 passwords
- Breach detection: passwords checked against HaveIBeenPwned at creation
- Immediate reset required on suspected compromise

## 6. Privileged Access Management

Production database direct access:
- Allowed only to `super-admin` role
- Requires VPN or bastion access (not exposed publicly)
- All queries logged in audit trail
- Access reviewed monthly

Infrastructure console access (Vercel, Supabase dashboards):
- Restricted to CTO and Engineering Lead
- SSO enforced where available
- API keys rotated every 90 days

## 7. Service Accounts and API Keys

- Service accounts use dedicated credentials (not personal)
- API keys are environment-specific (no production key in dev)
- Keys stored in environment variables only (never in code or git)
- Keys rotated every 90 days or immediately on suspected exposure
- Key inventory maintained in secret manager

---

*Approved by: CTO, Nebuloz*
*Date: 2026-05-19*
