import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { crossedThresholds } from "./threshold-logic";

/** Fires deduped notifications for all newly crossed KR thresholds. */
export async function checkKRThresholds(opts: {
  tenantId: string;
  krId: string;
  krTitle: string;
  prevValue: number;
  newValue: number;
  target: number;
}): Promise<void> {
  const { tenantId, krId, krTitle, prevValue, newValue, target } = opts;
  const thresholds = crossedThresholds(prevValue, newValue, target);
  if (thresholds.length === 0) {
    return;
  }

  const recipients = await database.tenantMember.findMany({
    where: { tenantId, role: { in: ["RTE", "STE", "ADMIN"] } },
    select: { userId: true },
  });

  if (recipients.length === 0) {
    return;
  }

  for (const threshold of thresholds) {
    await fireThresholdNotification({
      tenantId,
      krId,
      krTitle,
      threshold,
      recipientIds: recipients.map((r) => r.userId),
    });
  }
}

async function fireThresholdNotification(opts: {
  tenantId: string;
  krId: string;
  krTitle: string;
  threshold: number;
  recipientIds: string[];
}): Promise<void> {
  const { tenantId, krId, krTitle, threshold, recipientIds } = opts;
  const dedupBody = `${krId}:${threshold}`;

  // Permanent dedup: one notification per KR per threshold, ever
  const already = await database.notification.findFirst({
    where: { tenantId, type: "kr_threshold", body: dedupBody },
    select: { id: true },
  });
  if (already) {
    return;
  }

  await database.notification
    .createMany({
      data: recipientIds.map((userId) => ({
        tenantId,
        userId,
        type: "kr_threshold",
        title: `OKR Key Result '${krTitle}' reached ${threshold}%`,
        body: dedupBody,
        metadata: { krId, threshold },
      })),
    })
    .catch((err) => {
      log.error("[kr-threshold] notification create failed", err);
    });
}
