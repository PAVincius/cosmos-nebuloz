# Business Continuity Plan

**Version:** 1.0
**Effective date:** 2026-05-19
**Owner:** CTO
**Review cycle:** Annual + after any P0 incident

---

## 1. Purpose

Ensure Cosmos can maintain or rapidly restore critical services in the event of a major disruption, meeting customer SLA commitments and minimizing data loss.

## 2. Recovery Objectives

| Objective | Target | Measurement |
|-----------|--------|------------|
| **RTO** (Recovery Time Objective) | 2 hours | Time from incident declaration to service restored |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum data loss window |
| **Availability SLA** | 99.9% | Monthly uptime (allows ~44 min downtime/month) |

## 3. Critical Services and Dependencies

| Service | Criticality | Provider | Failover |
|---------|------------|---------|---------|
| Application (web) | Critical | Vercel | Multi-region CDN, automatic failover |
| API backend | Critical | Railway | Auto-restart on crash |
| Database | Critical | Supabase/PostgreSQL | Managed HA, point-in-time recovery |
| Authentication | Critical | Better Auth on Railway | Stateless JWT — survives restarts |
| Rate limiting | High | Upstash Redis | Degraded mode (fail open) if Upstash unavailable |
| Email delivery | Medium | Resend | Retry queue, fallback suppressed |
| Logging | Low | BetterStack | Non-blocking, service continues without it |

## 4. Backup Strategy

### Database Backups
- **Continuous WAL archiving** — Supabase provides point-in-time recovery
- **Daily snapshots** — retained for 30 days
- **Geographic redundancy** — backups stored in separate region from primary

### Application Code
- Source of truth: GitHub (replicated by GitHub infrastructure)
- Deployment artifacts: Vercel (retained per their SLA)

### Configuration and Secrets
- Infrastructure configuration: managed via environment variables in Vercel/Railway
- Secrets: documented in encrypted password manager (1Password)
- Runbooks: stored in GitHub (this repository)

### Backup Testing
- Database restore tested quarterly (last Friday of each quarter)
- Test procedure: restore to isolated staging environment, verify data integrity
- Results documented in `docs/compliance/soc2/backup-tests/YYYY-QN.md`

## 5. Disaster Scenarios and Response

### Scenario 1: Application Outage (Vercel/Railway failure)

**Detection:** BetterStack uptime alert → PagerDuty (within 1 min)
**Response:**
1. Engineering Lead acknowledges alert
2. Check provider status page (vercel.com/status, railway.app/status)
3. If provider incident: monitor and communicate to customers via status page
4. If configuration issue: roll back last deployment (Vercel dashboard, <30 sec)
5. If code issue: deploy hotfix via emergency change process
**RTO target:** 30 minutes for code issues, dependent on provider for infrastructure

### Scenario 2: Database Corruption or Failure

**Detection:** Application error rates spike + database connection failures
**Response:**
1. Engineering Lead declares incident, escalates to CTO
2. Assess scope: corrupted table vs. full database failure
3. Partial corruption: restore affected tables from point-in-time recovery
4. Full failure: initiate Supabase point-in-time recovery to last clean state
5. Verify data integrity before restoring application traffic
6. Notify customers of data loss if RPO exceeded
**RTO target:** 2 hours. **RPO target:** 1 hour (last backup point).

### Scenario 3: Security Breach (P0)

See [Incident Response Plan](02-incident-response-plan.md) §4.
Additional BCP steps:
1. Isolate compromised systems (take offline if necessary)
2. Restore from pre-breach backup if data integrity is compromised
3. Full security review before bringing systems back online

### Scenario 4: Key Person Unavailability (CTO/Engineering Lead)

**Single-person dependencies eliminated by:**
- Runbooks documented for all critical operations (this repository)
- All production access shared among ≥2 engineers
- Infrastructure access: CTO + Engineering Lead (both can independently operate)
- Passwords and credentials in shared 1Password vault with emergency access

**If CTO is unavailable:**
- Engineering Lead assumes incident command
- CEO has emergency infrastructure access documented in 1Password

### Scenario 5: Cloud Provider Region Failure

**Vercel:** Multi-region by default, no action required.
**Supabase/Railway:** Single region primary.
- Supabase has automated failover to read replica within region
- Cross-region recovery: restore from backup to alternative provider (estimated 4 hours)
- This scenario accepted as low probability; cross-region active-active is roadmap item.

## 6. Communication During Outage

| Audience | Channel | Frequency |
|---------|---------|-----------|
| Customers | status.nebuloz.com (BetterStack status page) | Every 30 min during active incident |
| Customers | Email notification | At incident declaration + resolution |
| Team | #incident- Slack channel | Real-time |
| CEO | Direct message | Immediately for P0/P1 |

Status page URL: **status.nebuloz.com**

## 7. Plan Testing

| Test | Frequency | Owner |
|------|-----------|-------|
| Database restore drill | Quarterly | Engineering Lead |
| Tabletop incident exercise | Annual | CTO |
| Failover test (staging) | Annual | Engineering Lead |
| Communication plan review | Annual | CEO |

Test results documented in `docs/compliance/soc2/bcp-tests/`.

---

*Approved by: CEO, Nebuloz*
*Date: 2026-05-19*
