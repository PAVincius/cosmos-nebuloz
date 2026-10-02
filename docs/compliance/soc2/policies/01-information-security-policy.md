# Information Security Policy

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** CTO
**Review cycle:** Annual

---

## 1. Purpose

This policy establishes the information security program for Cosmos (Nebuloz). It defines roles, responsibilities, principles, and controls to protect the confidentiality, integrity, and availability of customer data and platform systems.

## 2. Scope

Applies to:
- All Cosmos platform systems (production, staging, development)
- All employees, contractors, and vendors with access to Cosmos systems
- All customer data processed by the platform

## 3. Security Roles and Responsibilities

| Role | Responsibility |
|------|--------------|
| **CEO** | Accountable for security program; approves security budget |
| **CTO** | Owns this policy; oversees technical controls; chairs incident response |
| **Engineering Lead** | Implements technical controls; conducts code reviews; manages access |
| **All Engineers** | Follow secure coding standards; report incidents immediately; complete annual training |
| **All Employees** | Protect credentials; report suspicious activity; follow acceptable use |

## 4. Security Principles

### 4.1 Least Privilege
Users receive the minimum access required for their role. Access is granted explicitly — deny by default.

### 4.2 Defense in Depth
Multiple layers of controls (WAF, authentication, RLS, audit logging) so no single failure exposes data.

### 4.3 Secure by Default
New features ship with security controls active. Security is not an optional add-on.

### 4.4 Zero Trust
All requests are authenticated and authorized regardless of network origin.

## 5. Internal Security Communication

- Security incidents → immediately to **security@nebuloz.ai** and CTO via direct message
- Policy changes → announced via team channel with 30-day notice before effective date
- Security advisories → reviewed weekly in engineering standup
- Penetration test results → shared with Engineering within 5 days of receipt

## 6. Risk Management

### 6.1 Risk Assessment Process
1. Identify assets and threats annually (or after significant changes)
2. Assess likelihood and impact (Low / Medium / High / Critical)
3. Define mitigations for High and Critical risks
4. Document in risk register
5. Review quarterly

### 6.2 Risk Acceptance
Risks accepted without mitigation require CTO written approval and documentation in the risk register.

## 7. Acceptable Use

- Cosmos systems are for business purposes only
- Credentials must not be shared
- MFA is mandatory for all accounts with admin or production access
- Work must not be performed on unsecured or personal devices without approved MDM
- Sensitive data must not be stored in personal cloud storage (Google Drive personal, Dropbox, etc.)

## 8. Password and Credential Policy

- Minimum 12 characters, complexity required
- No password reuse for last 12 cycles
- Credentials rotated immediately upon suspected compromise
- Service account credentials rotated every 90 days
- All secrets stored in environment variables or approved secret managers only (never in code)

## 9. Security Training

- Annual security awareness training mandatory for all personnel
- Secure coding training mandatory for all engineers (annual)
- New hire security onboarding within first 30 days
- Training completion tracked and reported to CTO

## 10. Compliance and Audit

- This policy reviewed annually by CTO
- Technical controls audited against this policy quarterly
- External SOC2 audit annually (target: SOC2 Type I Q3 2026, Type II 2027)
- Audit logs retained for 12 months minimum

## 11. Violations

Policy violations are subject to disciplinary action up to and including termination. Criminal violations are reported to appropriate authorities.

---

*Approved by: CEO, Nebuloz*
*Date: 2026-05-19*
