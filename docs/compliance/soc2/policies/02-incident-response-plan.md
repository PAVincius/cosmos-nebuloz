# Incident Response Plan

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** CTO
**Review cycle:** Annual + after every P0/P1 incident

---

## 1. Purpose

Define how Cosmos detects, responds to, and recovers from security incidents, minimizing impact on customers and meeting regulatory notification obligations.

## 2. Severity Classification

| Severity | Definition | Examples | Response SLA |
|----------|-----------|---------|-------------|
| **P0 — Critical** | Active breach, data exfiltration, or full service outage | Customer data exposed, ransomware, account takeover at scale | Contain within **1 hour** |
| **P1 — High** | Significant vulnerability or degraded security control | Critical CVE unpatched, WAF bypassed, admin account compromised | Mitigate within **4 hours** |
| **P2 — Medium** | Security anomaly or non-critical vulnerability | Brute force attempt, suspicious API activity, medium CVE | Resolve within **24 hours** |
| **P3 — Low** | Potential issue requiring investigation | Unusual access pattern, low-severity CVE | Resolve within **72 hours** |

## 3. Incident Response Team

| Role | Person | Backup |
|------|--------|--------|
| **Incident Commander** | CTO | Engineering Lead |
| **Technical Lead** | Engineering Lead | Senior Engineer |
| **Communications Lead** | CEO | CTO |
| **Legal/Compliance** | External counsel | CEO |

## 4. Response Phases

### Phase 1 — Detection
**Triggers:**
- Automated alert (BetterStack, Arcjet, audit log anomaly)
- User report → security@nebuloz.com
- Third-party report (responsible disclosure)

**Actions:**
- [ ] Log detection time and source
- [ ] Create incident channel: `#incident-YYYY-MM-DD-description`
- [ ] Page Incident Commander

### Phase 2 — Triage (< 30 min)
- [ ] Classify severity (P0–P3)
- [ ] Determine scope: which systems, data, and customers affected
- [ ] Notify Incident Response Team
- [ ] Begin timeline log (all actions timestamped)

### Phase 3 — Containment
**P0/P1:**
- [ ] Isolate affected systems (disable API keys, revoke sessions, block IPs)
- [ ] Preserve evidence before remediation (logs, snapshots)
- [ ] Enable enhanced logging if not already active
- [ ] Brief CEO

**P2/P3:**
- [ ] Restrict access to affected component
- [ ] Monitor for escalation

### Phase 4 — Eradication
- [ ] Identify and remove root cause
- [ ] Patch vulnerability or misconfiguration
- [ ] Rotate all potentially compromised credentials
- [ ] Verify no persistence mechanisms remain

### Phase 5 — Recovery
- [ ] Restore service from clean state
- [ ] Verify all security controls are active
- [ ] Monitor for 24 hours post-recovery
- [ ] Confirm no re-exploitation

### Phase 6 — Post-Mortem
- [ ] Conduct within **5 business days** of resolution
- [ ] Document: timeline, root cause, impact, actions taken, lessons learned
- [ ] Identify preventive measures
- [ ] Update runbooks and controls as needed
- [ ] Share summary with team (no blame, blameless post-mortem)

## 5. Evidence Preservation

For P0/P1 incidents, before any remediation:
- Export relevant audit logs to cold storage
- Take database snapshot
- Screenshot relevant dashboards
- Record all affected user/tenant IDs

Evidence retained for minimum **3 years** for potential legal/regulatory proceedings.

## 6. Customer Notification

| Scenario | Notification Required | Timeline | Channel |
|----------|----------------------|----------|---------|
| P0 — Customer data exposed | **Required** | Within **72 hours** of discovery (LGPD/GDPR) | Email + in-app |
| P1 — Security control failure | Required if customer impact | Within **5 business days** | Email |
| P2/P3 — No customer data impact | Not required | N/A | Status page update |

**Notification content must include:**
- What happened (factual, no speculation)
- What data was affected (be specific)
- What we have done
- What customers should do
- Contact for questions: security@nebuloz.com

**Do not:**
- Speculate on attribution
- Promise specific timelines before facts are known
- Communicate without legal review for P0

## 7. Regulatory Reporting

- **LGPD (Brazil):** Report to ANPD within 72 hours of confirmed breach affecting personal data
- **GDPR (EU):** Report to supervisory authority within 72 hours where applicable
- Legal counsel must be involved in all regulatory notifications

## 8. Runbooks

### Runbook: Suspected Account Compromise
1. Revoke all sessions for affected account via Better Auth admin
2. Reset credentials and force password change
3. Review audit log for actions taken during compromise window
4. Notify affected user
5. If admin account: escalate to P1

### Runbook: Data Exfiltration Detected
1. Immediately escalate to P0
2. Identify exfiltration vector (API, direct DB, file export)
3. Block vector (disable API key, revoke token, block IP range)
4. Scope affected data (tenant IDs, record counts, data categories)
5. Preserve evidence
6. Brief CEO within 30 minutes
7. Engage legal counsel

### Runbook: Critical Vulnerability Disclosed (CVE)
1. Assess if Cosmos uses affected library (`pnpm audit`, dependency check)
2. If affected: classify severity per CVSS score
3. CVSS ≥ 9.0 → P0 patch within 24 hours
4. CVSS 7.0–8.9 → P1 patch within 72 hours
5. CVSS < 7.0 → P2/P3 next release cycle

---

*Approved by: CEO, Nebuloz*
*Date: 2026-05-19*
