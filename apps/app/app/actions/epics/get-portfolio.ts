"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { aggregateEpicRow, type InvestBreakdown } from "@/lib/portfolio-aggregate";
import { portfolioEpicsCacheTag } from "./portfolio-cache";
import { PORTFOLIO_EPICS_PAGE_SIZE } from "./portfolio-constants";

export type PortfolioEpic =
  import("@/lib/portfolio-aggregate").AggregatedPortfolioEpic;

export type PortfolioEpicsPage = {
  items: PortfolioEpic[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

type EpicWithRelations = Awaited<
  ReturnType<typeof database.epic.findMany>
>[number] & {
  features: {
    bv: number;
    tc: number;
    rr: number;
    js: number;
    wsjfScore: number;
    startedAt: Date | null;
    completedAt: Date | null;
    piPlan: { name: string } | null;
  }[];
  _count: { features: number };
  strategicTheme: { id: string; title: string; color: string } | null;
  governedEpic: { governanceStatus: string } | null;
  investScore: number | null;
  investBreakdown: InvestBreakdown | null;
  descriptionMd: string | null;
};

async function loadOkrCountMap(tenantId: string): Promise<Map<string, number>> {
  const okrCounts = await database.oKR.groupBy({
    by: ["epicId"],
    where: { tenantId, epicId: { not: null } },
    _count: { _all: true },
  });
  return new Map(okrCounts.map((r) => [r.epicId as string, r._count._all]));
}

function mapEpicRow(
  e: EpicWithRelations,
  okrCountMap: Map<string, number>
): PortfolioEpic {
  return aggregateEpicRow({
    id: e.id,
    title: e.title,
    statusId: e.statusId,
    order: e.order,
    features: e.features.map((f) => ({
      ...f,
      piName: f.piPlan?.name ?? null,
    })),
    featureCount: e._count.features,
    strategicThemeId: e.strategicTheme?.id ?? null,
    themeTitle: e.strategicTheme?.title ?? null,
    themeColor: e.strategicTheme?.color ?? null,
    linkedOKRCount: okrCountMap.get(e.id) ?? 0,
    governanceStatus: e.governedEpic?.governanceStatus ?? null,
    investScore: e.investScore ?? null,
    investBreakdown: e.investBreakdown ?? null,
    descriptionMd: e.descriptionMd ?? null,
  });
}

const epicInclude = {
  features: {
    select: {
      bv: true,
      tc: true,
      rr: true,
      js: true,
      wsjfScore: true,
      startedAt: true,
      completedAt: true,
      piPlan: { select: { name: true } },
    },
  },
  _count: { select: { features: true } },
  strategicTheme: { select: { id: true, title: true, color: true } },
  governedEpic: { select: { governanceStatus: true } },
} as const;

async function loadPortfolioEpics(tenantId: string): Promise<PortfolioEpic[]> {
  const [epics, okrCountMap] = await Promise.all([
    database.epic.findMany({
      where: { tenantId },
      include: epicInclude,
      orderBy: [{ statusId: "asc" }, { order: "asc" }],
    }),
    loadOkrCountMap(tenantId),
  ]);

  return epics.map((e) => mapEpicRow(e as EpicWithRelations, okrCountMap));
}

async function loadPortfolioEpicsPage(
  tenantId: string,
  statusId: string,
  page: number,
  limit: number
): Promise<PortfolioEpicsPage> {
  const skip = (page - 1) * limit;
  const where = { tenantId, statusId };

  const [epics, total, okrCountMap] = await Promise.all([
    database.epic.findMany({
      where,
      include: epicInclude,
      orderBy: [{ order: "asc" }],
      skip,
      take: limit,
    }),
    database.epic.count({ where }),
    loadOkrCountMap(tenantId),
  ]);

  const items = epics.map((e) =>
    mapEpicRow(e as EpicWithRelations, okrCountMap)
  );

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
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

/** Pagina épicos por coluna Kanban (statusId) — max 20 por página inicial. */
export const getPortfolioEpicsPage = async (
  statusId: string,
  page = 1,
  limit = PORTFOLIO_EPICS_PAGE_SIZE
): Promise<PortfolioEpicsPage> => {
  const ctx = await requireTenantSession(await headers());
  const { tenantId } = ctx;
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 50);

  return unstable_cache(
    async () => loadPortfolioEpicsPage(tenantId, statusId, safePage, safeLimit),
    [
      "portfolio-epics-page",
      tenantId,
      statusId,
      String(safePage),
      String(safeLimit),
    ],
    {
      revalidate: 45,
      tags: [portfolioEpicsCacheTag(tenantId)],
    }
  )();
};

/** Carrega primeira página de cada coluna Kanban em paralelo. */
export const getPortfolioEpicsInitialPages = async (
  statusIds: string[],
  limit = PORTFOLIO_EPICS_PAGE_SIZE
): Promise<Record<string, PortfolioEpicsPage>> => {
  const pages = await Promise.all(
    statusIds.map(async (statusId) => {
      const page = await getPortfolioEpicsPage(statusId, 1, limit);
      return [statusId, page] as const;
    })
  );
  return Object.fromEntries(pages);
};
