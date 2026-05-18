"use server";

import { unstable_cache } from "next/cache";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { aggregateEpicRow } from "@/lib/portfolio-aggregate";
import { portfolioEpicsCacheTag } from "./portfolio-cache";

export type PortfolioEpic = import("@/lib/portfolio-aggregate").AggregatedPortfolioEpic;

async function loadPortfolioEpics(tenantId: string): Promise<PortfolioEpic[]> {
  const epics = await database.epic.findMany({
    where: { tenantId },
    include: {
      features: { select: { bv: true, tc: true, rr: true, js: true, wsjfScore: true } },
      _count:   { select: { features: true } },
      strategicTheme: { select: { id: true, title: true, color: true } },
    },
    orderBy: [{ statusId: "asc" }, { order: "asc" }],
  });

  return epics.map((e) =>
    aggregateEpicRow({
      id: e.id,
      title: e.title,
      statusId: e.statusId,
      order: e.order,
      features: e.features,
      featureCount: e._count.features,
      strategicThemeId: e.strategicTheme?.id ?? null,
      themeTitle:       e.strategicTheme?.title ?? null,
      themeColor:       e.strategicTheme?.color ?? null,
    })
  );
}

/** Lista épicos do portfólio com cache por tenant (reduz carga na DB em rotas que partilham dados). */
export const getPortfolioEpics = async (): Promise<PortfolioEpic[]> => {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;

  return unstable_cache(
    async () => loadPortfolioEpics(tenantId),
    ["portfolio-epics", tenantId],
    {
      revalidate: 45,
      tags: [portfolioEpicsCacheTag(tenantId)],
    }
  )();
};
