import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

type RlsCheckRow = { relname: string };

// The tenant that owns system-generated audit rows (this audit's own report,
// governance/webhook system actions, etc). Must exist before this function's
// first run — see docs/runbooks/app-db-role.md pre-flip checklist.
const SYSTEM_TENANT_ID = "system";

// Tables tenant-scoped through a foreign key rather than an own tenantId
// column — e.g. RiskOKR is scoped via Risk.tenantId, not RiskOKR.tenantId —
// so their "tenant_isolation" policy is a subquery (EXISTS (SELECT 1 FROM
// <parent> WHERE parent.id = child.xId AND parent.tenantId =
// current_tenant_id())) instead of a direct column comparison. The
// tenantId-column query below can't find these by construction, so they're
// enumerated by hand. Found by reviewing pg_policies for every table with
// zero rows in the column-based query but relrowsecurity = true (2026-07-28
// Task 6 review). If a new table gets an indirect (non-tenantId-column)
// tenant_isolation policy, it must be added here or this audit will report
// clean while that table is unguarded.
const INDIRECTLY_SCOPED_TABLES = [
  "BillingSyncCursor",
  "RiskOKR",
  "ThemeART",
  "TaskAssignee",
  "RetroVote",
  "SyncLog",
];

// ─── Monthly tenant isolation audit (AC-007) ─────────────────────────────────
//
// Live-catalog check: queries pg_class/pg_attribute/pg_policies directly, not
// the Prisma schema files, so it reflects what is actually deployed in this
// database — including drift the migration history can't be trusted to
// reproduce (see docs/runbooks/app-db-role.md pre-flip checklist, item 3).
// Static, source-scanning checks (no "use server" export takes a tenantId; no
// multi-tenant @@unique key omits tenantId) live in CI instead
// (apps/app/__tests__/security/use-server-tenant-args.test.ts and
// apps/app/__tests__/security/tenant-unique-keys.test.ts) — a cron running in
// production has no guarantee its deployed bundle still contains the
// TypeScript/Prisma source those checks scan, so running them here would be
// unable to catch anything CI didn't already catch, and could silently no-op.

export const monthlyIsolationAudit = inngest.createFunction(
  {
    id: "monthly-isolation-audit",
    name: "Monthly Tenant Isolation Audit",
    triggers: [{ cron: "0 0 1 * *" }],
    retries: 2,
  },
  async ({ step }) => {
    const tablesMissingRls = await step.run("check-rls-policies", async () => {
      const rows = await database.$queryRaw<RlsCheckRow[]>`
          WITH candidates AS (
            SELECT DISTINCT c.relname
            FROM pg_class c
            JOIN pg_attribute a ON a.attrelid = c.oid
            WHERE c.relnamespace = 'public'::regnamespace
              AND c.relkind = 'r'
              AND a.attname = 'tenantId'
              AND a.attnum > 0
              AND NOT a.attisdropped
            UNION
            SELECT unnest(${INDIRECTLY_SCOPED_TABLES}::text[])
          )
          SELECT c.relname
          FROM pg_class c
          JOIN candidates cd ON cd.relname = c.relname
          WHERE c.relnamespace = 'public'::regnamespace
            AND c.relkind = 'r'
            AND (
              c.relrowsecurity = false
              OR c.relforcerowsecurity = false
              OR NOT EXISTS (
                SELECT 1 FROM pg_policies p
                WHERE p.schemaname = 'public' AND p.tablename = c.relname
              )
            )
          ORDER BY c.relname
        `;
      return rows.map((r) => r.relname);
    });

    const passed = tablesMissingRls.length === 0;

    if (!passed) {
      log.error(
        "[isolation-audit] RLS missing, not FORCEd, or has no policy on tenant tables",
        {
          tablesMissingRls,
        }
      );
    }

    // Write the result. This is the check's own output, not something a
    // future run can retry into existence, so a write failure must fail the
    // Inngest run loudly (same convention as lib/inngest/webhook-delivery.ts)
    // rather than being swallowed — a monthly audit that can't prove it ran
    // is worse than no audit at all.
    await step.run("write-audit-report", async () => {
      await database.auditLog.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          actorType: "system",
          action: "compliance.isolation_audit.monthly",
          metadata: {
            passed,
            checkedAt: new Date().toISOString(),
            tablesMissingRls,
          },
        },
      });
    });

    if (!passed) {
      throw new Error(
        `[isolation-audit] tenant isolation regression: RLS missing, not FORCEd, or unpolicied on ${tablesMissingRls.join(", ")}`
      );
    }

    return { passed, tablesMissingRls };
  }
);
