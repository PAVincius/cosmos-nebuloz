"use server";

// Pillar 3: Executive Confidence Index — server actions.
// Sources remaining scope, historical throughput, and sprint cadence per Epic,
// then delegates the verdict to the pure release-forecast module.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import {
  type EpicConfidence,
  epicConfidence,
  type Rag,
} from "@/lib/analytics/release-forecast";
import { cuid, type Result, safeAction } from "../_base";

const HISTORY_SPRINTS = 6;
const DEFAULT_CADENCE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

async function computeCadenceDays(teamIds: string[]): Promise<number> {
  if (teamIds.length === 0) {
    return DEFAULT_CADENCE_DAYS;
  }
  const sprints = await database.sprint.findMany({
    where: { teamId: { in: teamIds } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: "desc" },
    take: 6,
  });
  if (sprints.length === 0) {
    return DEFAULT_CADENCE_DAYS;
  }
  const lengths = sprints.map(
    (s) => (s.endDate.getTime() - s.startDate.getTime()) / MS_PER_DAY
  );
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return Math.max(1, Math.round(avg));
}

export async function computeEpicConfidence(
  tenantId: string,
  epicId: string
): Promise<EpicConfidence> {
  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId },
    select: { id: true, dueDate: true },
  });
  if (!epic) {
    throw new Error("EPIC_NOT_FOUND");
  }

  const features = await database.feature.findMany({
    where: { epicId, statusId: { not: "DONE" } },
    select: { assignedTeamId: true },
  });
  const remainingItems = features.length;
  const teamIds = [
    ...new Set(
      features
        .map((f) => f.assignedTeamId)
        .filter((t): t is string => Boolean(t))
    ),
  ];

  const snapshots = teamIds.length
    ? await database.flowMetricSnapshot.findMany({
        where: {
          tenantId,
          scope: "team",
          scopeId: { in: teamIds },
          period: "sprint",
        },
        select: { periodRef: true, flowVelocityTotal: true, recordedAt: true },
        orderBy: { recordedAt: "desc" },
        take: HISTORY_SPRINTS * Math.max(teamIds.length, 1),
      })
    : [];

  // Sum velocity per sprint (periodRef); snapshots are newest-first, so the
  // Map preserves newest-first insertion order.
  const bySprint = new Map<string, number>();
  for (const s of snapshots) {
    bySprint.set(
      s.periodRef,
      (bySprint.get(s.periodRef) ?? 0) + s.flowVelocityTotal
    );
  }
  const historicalThroughput = [...bySprint.values()].slice(0, HISTORY_SPRINTS);

  const cadenceDays = await computeCadenceDays(teamIds);

  return epicConfidence({
    historicalThroughput,
    remainingItems,
    dueDate: epic.dueDate,
    cadenceDays,
    anchor: new Date(),
  });
}

const EpicConfidenceSchema = z.object({ id: cuid });

export async function getEpicConfidence(
  raw?: unknown
): Promise<Result<EpicConfidence>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const { id } = EpicConfidenceSchema.parse(raw);
    return computeEpicConfidence(tenantId, id);
  });
}

export type PortfolioConfidence = {
  green: number;
  amber: number;
  red: number;
  gray: number;
  atRisk: {
    epicId: string;
    title: string;
    rag: Rag;
    p85Date: Date | null;
    dueDate: Date | null;
  }[];
};

export async function getPortfolioConfidence(): Promise<
  Result<PortfolioConfidence>
> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());

    const epics = await database.epic.findMany({
      where: { tenantId, epicType: "EPIC", lifecycleStatus: "IMPLEMENTING" },
      select: { id: true, title: true, dueDate: true },
    });

    const counts = { green: 0, amber: 0, red: 0, gray: 0 };
    const atRisk: PortfolioConfidence["atRisk"] = [];

    // ponytail: per-epic queries (N+1). IMPLEMENTING epics are few (tens at most);
    // batch the feature/throughput queries only if that cardinality grows large.
    for (const e of epics) {
      const c = await computeEpicConfidence(tenantId, e.id);
      if (c.rag === "GREEN") {
        counts.green += 1;
      } else if (c.rag === "AMBER") {
        counts.amber += 1;
      } else if (c.rag === "RED") {
        counts.red += 1;
      } else {
        counts.gray += 1;
      }
      if (c.rag === "AMBER" || c.rag === "RED") {
        atRisk.push({
          epicId: e.id,
          title: e.title,
          rag: c.rag,
          p85Date: c.p85Date,
          dueDate: e.dueDate,
        });
      }
    }

    // RED before AMBER
    atRisk.sort(
      (a, b) => (a.rag === "RED" ? 0 : 1) - (b.rag === "RED" ? 0 : 1)
    );

    return { ...counts, atRisk };
  });
}

export type { Rag };
