"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type ARTEvent = {
  id: string;
  type: "pi_planning" | "system_demo" | "inspect_adapt";
  label: string;
  date: Date;
  piName: string;
  status: "past" | "current" | "future";
};

export type PIHealthSummary = {
  piName: string;
  piId: string;
  totalObjectives: number;
  achievedObjectives: number;
  stretchObjectives: number;
  predictability: number;
};

export type ARTHealthIndicators = {
  activeRisks: number;
  unresolvedRisks: number;
  piHealth: PIHealthSummary[];
  latestFlowPredictability: number;
};

export type ARTObservabilityData = {
  events: ARTEvent[];
  health: ARTHealthIndicators;
};

export async function getARTObservability(
  artId: string
): Promise<ARTObservabilityData> {
  const ctx = await requireTenantSession(await headers());
  const tenantId = ctx.tenantId;
  const now = new Date();

  const piPlans = await database.pIPlan.findMany({
    where: { artId, tenantId },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      piObjectives: {
        select: {
          id: true,
          status: true,
          isStretch: true,
        },
      },
      risks: {
        select: { id: true, status: true },
      },
    },
  });

  // Derive events from PI plans
  const events: ARTEvent[] = [];

  for (const pi of piPlans) {
    if (!pi.startDate) {
      continue;
    }

    // Capture as non-null constants before closure to satisfy TypeScript narrowing
    const piStart: Date = pi.startDate;
    const piEnd: Date | null = pi.endDate;

    const getEventStatus = (date: Date): "past" | "current" | "future" => {
      if (piEnd && now >= piStart && now <= piEnd) {
        return "current";
      }
      if (date < now) {
        return "past";
      }
      return "future";
    };

    events.push({
      id: `${pi.id}-planning`,
      type: "pi_planning",
      label: `PI Planning – ${pi.name}`,
      date: piStart,
      piName: pi.name,
      status: getEventStatus(piStart),
    });

    if (piEnd) {
      const demoDate = new Date(piEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
      events.push({
        id: `${pi.id}-demo`,
        type: "system_demo",
        label: `System Demo – ${pi.name}`,
        date: demoDate,
        piName: pi.name,
        status: getEventStatus(demoDate),
      });

      events.push({
        id: `${pi.id}-ia`,
        type: "inspect_adapt",
        label: `Inspect & Adapt – ${pi.name}`,
        date: piEnd,
        piName: pi.name,
        status: getEventStatus(piEnd),
      });
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build PI health summaries (most recent PI first)
  const piHealth: PIHealthSummary[] = [...piPlans].reverse().map((pi) => {
    const committed = pi.piObjectives.filter((o) => !o.isStretch);
    const achieved = committed.filter((o) => o.status === "ACHIEVED");
    const stretch = pi.piObjectives.filter((o) => o.isStretch);
    const predictability =
      committed.length > 0
        ? Math.round((achieved.length / committed.length) * 100)
        : 0;

    return {
      piId: pi.id,
      piName: pi.name,
      totalObjectives: pi.piObjectives.length,
      achievedObjectives: achieved.length,
      stretchObjectives: stretch.length,
      predictability,
    };
  });

  // Aggregate risks across all PI plans for this ART
  // Risk.status values: IDENTIFIED / OWNED / ACCEPTED / MITIGATED / RESOLVED
  const allRisks = piPlans.flatMap((pi) => pi.risks);
  const activeRisks = allRisks.filter(
    (r) => r.status !== "RESOLVED" && r.status !== "MITIGATED"
  ).length;
  const unresolvedRisks = allRisks.filter(
    (r) => r.status === "OWNED" || r.status === "ACCEPTED"
  ).length;

  const lastPI = piHealth[0];

  return {
    events,
    health: {
      activeRisks,
      unresolvedRisks,
      piHealth,
      latestFlowPredictability: lastPI?.predictability ?? 0,
    },
  };
}
