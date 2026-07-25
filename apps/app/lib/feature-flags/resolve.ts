// Story-036: DB-based feature flag resolution (org override > user override > global default)
import { database } from "@repo/database";

type ResolveOptions = {
  flagKey: string;
  tenantId: string;
  userId?: string;
};

export async function resolveFlag(opts: ResolveOptions): Promise<boolean> {
  const { flagKey, tenantId, userId } = opts;
  const now = new Date();
  const notExpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };

  if (userId) {
    const userOverride = await database.featureFlagOverride.findFirst({
      where: { tenantId, userId, flagKey, ...notExpired },
      select: { value: true },
    });
    if (userOverride !== null) {
      return userOverride.value;
    }
  }

  const orgOverride = await database.featureFlagOverride.findFirst({
    where: { tenantId, userId: null, flagKey, ...notExpired },
    select: { value: true },
  });
  if (orgOverride !== null) {
    return orgOverride.value;
  }

  const flag = await database.featureFlag.findUnique({
    where: { key: flagKey },
    select: { defaultValue: true },
  });
  return flag?.defaultValue ?? false;
}
