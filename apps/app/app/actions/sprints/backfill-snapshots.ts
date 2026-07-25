"use server";

// Idempotent backfill for FlowMetricSnapshot / TeamCapacitySnapshot —
// closes the history gap for sprints that closed before closeSprint's
// snapshot-origination hook existed (see snapshot-origination.ts). Reuses
// the exact same idempotent writers, so this is safe to run repeatedly:
// any sprint that already has a snapshot is skipped.
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { type Result, safeAction } from "../_base";
import {
  originateCapacitySnapshot,
  originateFlowSnapshot,
} from "./snapshot-origination";

export type BackfillPeriodSnapshotsResult = {
  sprintsProcessed: number;
  flowSnapshotsCreated: number;
  capacitySnapshotsCreated: number;
};

export async function backfillPeriodSnapshots(): Promise<
  Result<BackfillPeriodSnapshotsResult>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const closedSprints = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, status: "CLOSED" },
      select: { id: true, teamId: true, velocity: true },
    });

    let flowSnapshotsCreated = 0;
    let capacitySnapshotsCreated = 0;

    for (const sprint of closedSprints) {
      try {
        const flowResult = await originateFlowSnapshot(database, {
          tenantId: ctx.tenantId,
          teamId: sprint.teamId,
          sprintId: sprint.id,
        });
        if (flowResult.created) {
          flowSnapshotsCreated++;
        }
      } catch (error) {
        log.error("[backfillPeriodSnapshots] flow snapshot failed", {
          sprintId: sprint.id,
          error,
        });
      }

      try {
        const capacityResult = await originateCapacitySnapshot(database, {
          tenantId: ctx.tenantId,
          teamId: sprint.teamId,
          sprintId: sprint.id,
          velocity: sprint.velocity ?? 0,
        });
        if (capacityResult.created) {
          capacitySnapshotsCreated++;
        }
      } catch (error) {
        log.error("[backfillPeriodSnapshots] capacity snapshot failed", {
          sprintId: sprint.id,
          error,
        });
      }
    }

    return {
      sprintsProcessed: closedSprints.length,
      flowSnapshotsCreated,
      capacitySnapshotsCreated,
    };
  });
}
