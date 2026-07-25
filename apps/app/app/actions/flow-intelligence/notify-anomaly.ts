import { database } from "@repo/database";
import { log } from "@repo/observability/log";

export async function notifyAnomaly(args: {
  tenantId: string;
  anomalyId: string;
  severity: string;
  rule: string;
  narrative: string;
}): Promise<void> {
  // Find ADMIN members of the tenant to receive the notification.
  // TenantMember.role uses the MemberRole enum — ADMIN is the highest privilege.
  const admins = await database.tenantMember.findMany({
    where: {
      tenantId: args.tenantId,
      role: "ADMIN",
    },
    select: { userId: true },
  });

  if (admins.length === 0) {
    log.error(
      `[notify-anomaly] No ADMIN members found for tenant ${args.tenantId} — skipping notifications.`,
      { severity: args.severity, rule: args.rule, anomalyId: args.anomalyId }
    );
    return;
  }

  const title = `[${args.severity}] Flow Anomaly: ${args.rule}`;
  const body = args.narrative.slice(0, 500);

  await database.notification.createMany({
    data: admins.map(({ userId }) => ({
      tenantId: args.tenantId,
      userId,
      type: "risk",
      title,
      body,
      metadata: {
        anomalyId: args.anomalyId,
        rule: args.rule,
        severity: args.severity,
      },
    })),
    skipDuplicates: true,
  });
}
