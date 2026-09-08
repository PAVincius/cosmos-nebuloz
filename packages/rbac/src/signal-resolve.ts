import "server-only";
import { database, type SignalRole } from "@repo/database";

// Resolução do papel de medição do Signal.
//
// Ortogonal ao papel SAFe, ao do Charter e ao do Meridian: a mesma pessoa pode
// ser DEV no Cosmos, AUDITOR no Charter, CONSULTANT no Meridian e VIEWER aqui.
//
// Ausência de SignalMember retorna null — sem acesso ao Signal, mesmo com o
// módulo contratado e mesmo sendo ADMIN do tenant. Default deny nos dois eixos.

const CACHE_TTL_SECONDS = 300;

function cacheKey(tenantId: string, userId: string): string {
  return `signal-role:${tenantId}:${userId}`;
}

async function fetchRole(
  userId: string,
  tenantId: string
): Promise<SignalRole | null> {
  const member = await database.signalMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function getSignalRole(
  userId: string,
  tenantId: string
): Promise<SignalRole | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return fetchRole(userId, tenantId);
  }
  const { redis } = await import("@repo/rate-limit");
  const key = cacheKey(tenantId, userId);
  // "none" distingue "sem papel, já consultado" de "cache vazio" — sem isso,
  // todo request de quem não tem acesso volta ao banco.
  const cached = await redis.get<string>(key);
  if (cached) {
    return cached === "none" ? null : (cached as SignalRole);
  }
  const role = await fetchRole(userId, tenantId);
  await redis.set(key, role ?? "none", { ex: CACHE_TTL_SECONDS });
  return role;
}

export async function invalidateSignalRoleCache(
  tenantId: string,
  userId: string
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.del(cacheKey(tenantId, userId));
}
