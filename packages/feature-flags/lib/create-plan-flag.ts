import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { cache } from "react";
import { flag } from "flags/next";

type SubscriptionPlan = "ORBIT" | "GALAXY" | "NEBULA" | "UNIVERSE";

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  ORBIT: 0,
  GALAXY: 1,
  NEBULA: 2,
  UNIVERSE: 3,
};

// Deduplicates DB reads across all flags evaluated in the same request
const getTenantPlan = cache(async (tenantId: string) =>
  database.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } })
);

export const createPlanFlag = (key: string, minPlan: SubscriptionPlan) =>
  flag({
    key,
    defaultValue: false,
    async decide() {
      try {
        const ctx = await requireTenantSession(await headers());
        const tenant = await getTenantPlan(ctx.tenantId);

        if (!tenant) return false;

        const rank = PLAN_RANK[tenant.plan as SubscriptionPlan] ?? 0;
        return rank >= PLAN_RANK[minPlan];
      } catch {
        return false;
      }
    },
  });
