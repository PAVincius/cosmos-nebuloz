import { database } from "@repo/database";

const COPILOT_LIMITS: Record<string, number> = {
  ORBIT: 20,
  GALAXY: 50,
  NEBULA: 100,
  UNIVERSE: Number.POSITIVE_INFINITY,
};

type CopilotUsageMeta = {
  currentPiId: string | null;
  copilotUsedThisPi: number;
  copilotUsedTotal: number;
  copilotInteractionsUsed: number;
};

export type CopilotQuotaStatus = {
  allowed: boolean;
  plan: string;
  limit: number;
  usedThisPi: number;
  usedTotal: number;
  remainingUses: number;
  reason?: string;
};

function readUsage(metadata: unknown): CopilotUsageMeta {
  const raw = (metadata as Record<string, unknown> | null)?.aiUsage;
  const usage = (raw ?? {}) as Partial<CopilotUsageMeta>;
  return {
    currentPiId: usage.currentPiId ?? null,
    copilotUsedThisPi: usage.copilotUsedThisPi ?? 0,
    copilotUsedTotal: usage.copilotUsedTotal ?? 0,
    copilotInteractionsUsed:
      usage.copilotInteractionsUsed ?? usage.copilotUsedTotal ?? 0,
  };
}

async function getCurrentPiId(tenantId: string): Promise<string | null> {
  const latestPi = await database.pIPlan.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return latestPi?.id ?? null;
}

export async function checkCopilotQuota(
  tenantId: string
): Promise<CopilotQuotaStatus> {
  const tenant = await database.tenant.findFirst({
    where: { id: tenantId },
    select: { plan: true, metadata: true },
  });
  if (!tenant) {
    throw new Error("Tenant não encontrado");
  }

  const plan = tenant.plan as string;
  const limit = COPILOT_LIMITS[plan] ?? 0;
  const usage = readUsage(tenant.metadata);
  const currentPiId = await getCurrentPiId(tenantId);
  const piChanged = !!currentPiId && currentPiId !== usage.currentPiId;
  const usedThisPi = piChanged ? 0 : usage.copilotUsedThisPi;

  if (limit === Number.POSITIVE_INFINITY) {
    return {
      allowed: true,
      plan,
      limit: -1,
      usedThisPi,
      usedTotal: usage.copilotUsedTotal,
      remainingUses: -1,
    };
  }

  const allowed = usedThisPi < limit;
  const remainingUses = Math.max(0, limit - usedThisPi);

  return {
    allowed,
    plan,
    limit,
    usedThisPi,
    usedTotal: usage.copilotUsedTotal,
    remainingUses,
    reason: allowed
      ? undefined
      : `Limite de ${limit} interações do Copilot por PI atingido no plano ${plan}.`,
  };
}

export async function incrementCopilotUsage(tenantId: string): Promise<void> {
  const tenant = await database.tenant.findFirst({
    where: { id: tenantId },
    select: { metadata: true },
  });

  const currentPiId = await getCurrentPiId(tenantId);
  const currentMeta = (tenant?.metadata as Record<string, unknown>) ?? {};
  const usage = readUsage(currentMeta);
  const piChanged = !!currentPiId && currentPiId !== usage.currentPiId;

  const nextUsedThisPi = piChanged ? 1 : usage.copilotUsedThisPi + 1;
  const nextUsedTotal = usage.copilotUsedTotal + 1;

  await database.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        ...currentMeta,
        aiUsage: {
          currentPiId: currentPiId ?? usage.currentPiId,
          copilotUsedThisPi: nextUsedThisPi,
          copilotUsedTotal: nextUsedTotal,
          copilotInteractionsUsed: nextUsedTotal,
        } satisfies CopilotUsageMeta,
      },
    },
  });
}
