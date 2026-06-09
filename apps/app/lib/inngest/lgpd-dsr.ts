import { createHash } from "node:crypto";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "./client";

// ─── Erasure request (LGPD Art. 18 — right to erasure) ───────────────────────

type ErasureEventData = {
  subjectId: string;
  tenantId: string;
  requestId: string;
};

export const processErasureRequest = inngest.createFunction(
  {
    id: "lgpd-erasure",
    triggers: [{ event: "lgpd/erasure.requested" }],
    retries: 3,
  },
  async ({ event, step }) => {
    const { subjectId, tenantId, requestId } = event.data as ErasureEventData;
    const hash = createHash("sha256").update(subjectId).digest("hex");
    const replacement = `{subject_anonymized_${hash}}`;

    await step.run("mark-in-progress", () =>
      database.dataSubjectRequest.update({
        where: { id: requestId },
        data: { status: "IN_PROGRESS" },
      })
    );

    await step.run("anonymize-user-profile", () =>
      database.user.update({
        where: { id: subjectId },
        data: {
          name: replacement,
          email: `${hash}@erased.cosmos`,
        },
      })
    );

    await step.run("anonymize-standup-entries", () =>
      database.standupEntry.updateMany({
        where: { userId: subjectId, tenantId },
        data: {
          yesterday: replacement,
          today: replacement,
          blockers: replacement,
        },
      })
    );

    await step.run("anonymize-copilot-messages", () =>
      database.copilotMessage.updateMany({
        where: { session: { userId: subjectId, tenantId } },
        data: { content: "[Erased: LGPD Art.18 request]" },
      })
    );

    await step.run("complete-request", async () => {
      await database.dataSubjectRequest.update({
        where: { id: requestId },
        data: { status: "COMPLETED", processedAt: new Date() },
      });

      database.auditLog
        .create({
          data: {
            tenantId,
            action: "compliance.lgpd_erasure.completed",
            actorId: null,
            actorType: "system",
            metadata: { requestId, subjectId: hash },
          },
        })
        .catch((err) => {
          log.error("[lgpd-erasure] audit log failed", err);
        });
    });
  }
);

// ─── Portability export (LGPD Art. 18.IV — right to data portability) ────────

export type PortabilityPayload = {
  schemaVersion: string;
  exportedAt: string;
  subject: {
    id: string;
    name: string | null;
    email: string;
    createdAt: Date;
  } | null;
  standupEntries: Array<{
    id: string;
    date: Date;
    yesterday: string | null;
    today: string | null;
    blockers: string | null;
  }>;
  copilotSessions: Array<{
    id: string;
    mode: string;
    createdAt: Date;
    messageCount: number;
  }>;
};

export async function buildPortabilityExport(
  subjectId: string,
  tenantId: string,
  exportedAt: string
): Promise<PortabilityPayload> {
  const [profile, standupEntries, copilotSessions] = await Promise.all([
    database.user.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    database.standupEntry.findMany({
      where: { userId: subjectId, tenantId },
      select: {
        id: true,
        date: true,
        yesterday: true,
        today: true,
        blockers: true,
      },
      orderBy: { date: "asc" },
    }),
    database.copilotSession.findMany({
      where: { userId: subjectId, tenantId },
      select: { id: true, mode: true, createdAt: true, messageCount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    schemaVersion: "1.0",
    exportedAt,
    subject: profile,
    standupEntries,
    copilotSessions,
  };
}
