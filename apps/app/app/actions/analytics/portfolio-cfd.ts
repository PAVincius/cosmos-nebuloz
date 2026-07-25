"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { err, ok, type Result } from "../_base";

export type PortfolioCFDPoint = {
  date: string;
  FUNNEL: number;
  ANALYZING: number;
  PORTFOLIO_BACKLOG: number;
  IMPLEMENTING: number;
  DONE: number;
  REJECTED: number;
};

export type PortfolioDistribution = {
  status: string;
  count: number;
  label: string;
};

export type PortfolioCFDData = {
  distribution: PortfolioDistribution[];
  trend: { date: string; velocity: number; load: number }[];
};

const STATUS_LABELS: Record<string, string> = {
  FUNNEL: "Funil",
  ANALYZING: "Analisando",
  PORTFOLIO_BACKLOG: "Backlog",
  IMPLEMENTING: "Implementando",
  DONE: "Concluído",
  REJECTED: "Rejeitado",
};

export async function getPortfolioCFDData(
  artId?: string
): Promise<Result<PortfolioCFDData>> {
  try {
    const ctx = await requireTenantSession(await headers());

    // Current distribution by lifecycle status
    const epicGroups = await database.epic.groupBy({
      by: ["lifecycleStatus"],
      where: { tenantId: ctx.tenantId },
      _count: { id: true },
    });

    const distribution: PortfolioDistribution[] = epicGroups
      .map((g) => ({
        status: g.lifecycleStatus,
        count: g._count.id,
        label: STATUS_LABELS[g.lifecycleStatus] ?? g.lifecycleStatus,
      }))
      .sort((a, b) => {
        const order = [
          "FUNNEL",
          "ANALYZING",
          "PORTFOLIO_BACKLOG",
          "IMPLEMENTING",
          "DONE",
          "REJECTED",
        ];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });

    // FlowMetricSnapshot trend (last 12 months)
    const snapshots = await database.flowMetricSnapshot.findMany({
      where: {
        tenantId: ctx.tenantId,
        scope: artId ? "art" : { in: ["art", "value_stream"] },
        ...(artId ? { scopeId: artId } : {}),
        isArchived: false,
      },
      orderBy: { recordedAt: "asc" },
      take: 52, // ~1 year of weekly snapshots
      select: {
        recordedAt: true,
        flowVelocityTotal: true,
        flowLoadCurrent: true,
      },
    });

    const trend = snapshots.map((s) => ({
      date: s.recordedAt.toISOString().slice(0, 10),
      velocity: s.flowVelocityTotal,
      load: s.flowLoadCurrent,
    }));

    return ok({ distribution, trend });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao carregar CFD");
  }
}
