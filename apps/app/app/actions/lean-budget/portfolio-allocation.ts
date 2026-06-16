"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

export type ThemeAllocation = {
  themeId: string | null;
  themeName: string;
  themeColor: string;
  budgetCount: number;
  totalAmount: number;
  totalSpent: number;
  percentUsed: number;
  percentOfPortfolio: number;
  guardrails: { capex: number; opex: number } | null;
  capexStatus: "ok" | "warn" | "over";
  opexStatus: "ok" | "warn" | "over";
};

export type PortfolioAllocation = {
  period: string;
  portfolioTotal: number;
  portfolioSpent: number;
  themes: ThemeAllocation[];
};

function guardrailStatus(spent: number, limit: number): "ok" | "warn" | "over" {
  if (limit <= 0) {
    return "ok";
  }
  const pct = (spent / limit) * 100;
  if (pct > 100) {
    return "over";
  }
  if (pct > 80) {
    return "warn";
  }
  return "ok";
}

export async function getPortfolioAllocation(
  period: string
): Promise<PortfolioAllocation> {
  const ctx = await requireTenantSession(await headers());

  const budgets = await database.leanBudget.findMany({
    where: { tenantId: ctx.tenantId, period },
    include: {
      strategicTheme: { select: { id: true, title: true, color: true } },
    },
    orderBy: { amount: "desc" },
  });

  const portfolioTotal = budgets.reduce((s, b) => s + b.amount, 0);
  const portfolioSpent = budgets.reduce((s, b) => s + Number(b.spent ?? 0), 0);

  const grouped = new Map<string | null, typeof budgets>();
  for (const b of budgets) {
    const key = b.themeId ?? null;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(b);
  }

  const themes: ThemeAllocation[] = Array.from(grouped.entries()).map(
    ([themeId, items]) => {
      const first = items[0];
      const totalAmount = items.reduce((s, b) => s + b.amount, 0);
      const totalSpent = items.reduce((s, b) => s + Number(b.spent ?? 0), 0);
      const percentUsed =
        totalAmount > 0
          ? Math.round((totalSpent / totalAmount) * 100 * 10) / 10
          : 0;
      const percentOfPortfolio =
        portfolioTotal > 0
          ? Math.round((totalAmount / portfolioTotal) * 100 * 10) / 10
          : 0;

      const guardrailsRaw = items
        .map((b) => b.guardrails as { capex?: number; opex?: number } | null)
        .filter(Boolean);

      const capexLimit = guardrailsRaw.reduce((s, g) => s + (g?.capex ?? 0), 0);
      const opexLimit = guardrailsRaw.reduce((s, g) => s + (g?.opex ?? 0), 0);
      const guardrails =
        capexLimit > 0 || opexLimit > 0
          ? { capex: capexLimit, opex: opexLimit }
          : null;

      const capexSpent = totalSpent * 0.5;
      const opexSpent = totalSpent * 0.5;

      return {
        themeId,
        themeName: first?.strategicTheme?.title ?? "Sem Tema",
        themeColor: first?.strategicTheme?.color ?? "#94a3b8",
        budgetCount: items.length,
        totalAmount,
        totalSpent,
        percentUsed,
        percentOfPortfolio,
        guardrails,
        capexStatus: guardrails
          ? guardrailStatus(capexSpent, capexLimit)
          : "ok",
        opexStatus: guardrails ? guardrailStatus(opexSpent, opexLimit) : "ok",
      };
    }
  );

  themes.sort((a, b) => {
    if (a.themeId === null) {
      return 1;
    }
    if (b.themeId === null) {
      return -1;
    }
    return b.totalAmount - a.totalAmount;
  });

  return { period, portfolioTotal, portfolioSpent, themes };
}

export async function getAvailablePeriods(): Promise<string[]> {
  const ctx = await requireTenantSession(await headers());

  const rows = await database.leanBudget.findMany({
    where: { tenantId: ctx.tenantId },
    select: { period: true },
    distinct: ["period"],
    orderBy: { period: "desc" },
  });

  return rows.map((r) => r.period);
}
