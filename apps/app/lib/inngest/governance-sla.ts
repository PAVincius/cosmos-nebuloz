import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

export const checkGovernanceSLA = inngest.createFunction(
  {
    id: "governance-sla-check",
    triggers: [{ cron: "*/30 * * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const breachedSteps = await step.run("find-breached", () =>
      database.approvalStepInstance.findMany({
        where: {
          estado: "pending",
          slaDeadline: { lt: new Date() },
          slaStatus: { not: "BREACHED" },
        },
        select: {
          id: true,
          tenantId: true,
          approvalRequestId: true,
          backupApproverId: true,
          approvalRequest: {
            select: { governedEpicId: true },
          },
        },
      })
    );

    log.error("[governance-sla] checking for SLA breaches", {
      count: breachedSteps.length,
    });

    for (const s of breachedSteps) {
      await step.run(`escalate-${s.id}`, async () => {
        await database.$transaction([
          database.approvalStepInstance.update({
            where: { id: s.id },
            data: { slaStatus: "BREACHED" },
          }),
          database.governanceEscalation.create({
            data: {
              tenantId: s.tenantId,
              approvalStepId: s.id,
              epicId: s.approvalRequest.governedEpicId,
              backupNotified: !!s.backupApproverId,
              backupNotifiedAt: s.backupApproverId ? new Date() : null,
            },
          }),
        ]);

        database.auditLog
          .create({
            data: {
              tenantId: s.tenantId,
              action: "governance.sla.breached",
              actorType: "system",
              metadata: {
                approvalStepId: s.id,
                epicId: s.approvalRequest.governedEpicId,
              },
            },
          })
          .catch((err) => {
            log.error("[governance-sla] audit log failed", err);
          });
      });
    }

    return { processed: breachedSteps.length };
  }
);
