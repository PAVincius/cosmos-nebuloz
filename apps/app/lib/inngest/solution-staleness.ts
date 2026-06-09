import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  isFeatureStale,
  STALE_THRESHOLD_DAYS,
} from "../solution-train/staleness";
import { inngest } from "./client";

export const checkSolutionStaleness = inngest.createFunction(
  {
    id: "solution-staleness-check",
    triggers: [{ cron: "0 2 * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_THRESHOLD_DAYS);

    const staleFeatures = await step.run("find-stale", () =>
      database.feature.findMany({
        where: {
          capabilityId: { not: null },
          updatedAt: { lt: cutoff },
        },
        select: {
          id: true,
          tenantId: true,
          title: true,
          updatedAt: true,
        },
      })
    );

    log.error("[solution-staleness] stale features found", {
      count: staleFeatures.length,
    });

    for (const f of staleFeatures) {
      await step.run(`notify-stale-${f.id}`, async () => {
        const asOf = new Date();
        if (!isFeatureStale(f.updatedAt, asOf)) {
          return;
        }

        database.auditLog
          .create({
            data: {
              tenantId: f.tenantId,
              action: "solution.feature.stale",
              actorType: "system",
              metadata: { featureId: f.id, featureTitle: f.title },
            },
          })
          .catch((err) => {
            log.error("[solution-staleness] audit log failed", err);
          });
      });
    }

    return { processed: staleFeatures.length };
  }
);
