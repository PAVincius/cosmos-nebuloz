import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

type RlsCheckRow = { relname: string; relrowsecurity: boolean };

const CRITICAL_TABLES = [
  "AuditLog",
  "DataSubjectRequest",
  "User",
  "Tenant",
  "PIPlan",
  "Epic",
  "Story",
  "Risk",
  "MeetingTranscript",
  "MeetingInsight",
];

// ─── Monthly tenant isolation audit (AC-007) ─────────────────────────────────

export const monthlyIsolationAudit = inngest.createFunction(
  {
    id: "monthly-isolation-audit",
    name: "Monthly Tenant Isolation Audit",
    triggers: [{ cron: "0 0 1 * *" }],
    retries: 2,
  },
  async ({ step }) => {
    const tablesWithoutRls = await step.run("check-rls-policies", async () => {
      const rows = await database.$queryRaw<RlsCheckRow[]>`
          SELECT relname, relrowsecurity
          FROM pg_class
          WHERE relnamespace = 'public'::regnamespace
            AND relkind = 'r'
            AND relname = ANY(${CRITICAL_TABLES})
            AND relrowsecurity = false
        `;
      return rows.map((r) => r.relname);
    });

    await step.run("write-audit-report", async () => {
      const passed = tablesWithoutRls.length === 0;

      database.auditLog
        .create({
          data: {
            tenantId: "system",
            actorType: "system",
            action: "compliance.isolation_audit.monthly",
            metadata: {
              passed,
              checkedAt: new Date().toISOString(),
              criticalTablesChecked: CRITICAL_TABLES.length,
              tablesWithoutRls,
            },
          },
        })
        .catch((err) => {
          log.error("[isolation-audit] audit log write failed", err);
        });

      if (!passed) {
        log.error("[isolation-audit] RLS missing on critical tables", {
          tablesWithoutRls,
        });
      }

      return { passed, tablesWithoutRls };
    });
  }
);
