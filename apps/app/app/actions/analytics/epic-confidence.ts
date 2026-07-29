"use server";

// Pillar 3: Executive Confidence Index — server actions.
// Sources remaining scope, historical throughput, and sprint cadence per Epic,
// then delegates the verdict to the pure release-forecast module.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { z } from "zod";
import type { EpicConfidence, Rag } from "@/lib/analytics/release-forecast";
import { cuid, type Result, safeAction } from "../_base";
import { computeEpicConfidence } from "./compute-epic-confidence";

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
