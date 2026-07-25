import "server-only";
import { database } from "@repo/database";
import type { SaFeRole } from "./matrix";

const CACHE_TTL_SECONDS = 300; // 5 min

function cacheKey(orgId: string, userId: string, artId?: string): string {
  return `perm:${orgId}:${userId}:${artId ?? "org"}`;
}

export async function getEffectiveRole(
  userId: string,
  tenantId: string,
  artId?: string
): Promise<SaFeRole> {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const { redis } = await import("@repo/rate-limit");
    const key = cacheKey(tenantId, userId, artId);
    const cached = await redis.get<string>(key);
    if (cached) {
      return cached as SaFeRole;
    }
    const role = await resolveFromDb(userId, tenantId, artId);
    await redis.set(key, role, { ex: CACHE_TTL_SECONDS });
    return role;
  }

  return resolveFromDb(userId, tenantId, artId);
}

async function resolveFromDb(
  userId: string,
  tenantId: string,
  artId?: string
): Promise<SaFeRole> {
  if (artId) {
    const artMembership = await database.artMembership.findFirst({
      where: { userId, artId, tenantId },
      select: { role: true },
    });
    if (artMembership) {
      return artMembership.role as SaFeRole;
    }
  }

  const orgMembership = await database.tenantMember.findFirst({
    where: { userId, tenantId },
    select: { role: true },
  });

  return (orgMembership?.role ?? "MEMBER") as SaFeRole;
}

export async function invalidatePermissionCache(
  tenantId: string,
  userId: string,
  artId?: string
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.del(cacheKey(tenantId, userId, artId));
}
