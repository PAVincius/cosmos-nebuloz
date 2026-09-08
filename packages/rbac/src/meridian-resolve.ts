import "server-only";
import { database, type MeridianRole } from "@repo/database";

// Resolução do papel de diagnóstico do Meridian.
//
// Ortogonal ao papel SAFe e ao papel de governança do Charter: a mesma pessoa
// pode ser DEV no Cosmos, AUDITOR no Charter e CONSULTANT aqui.
//
// Ausência de MeridianMembership retorna null — sem acesso ao Meridian, mesmo
// com o módulo contratado e mesmo sendo ADMIN do tenant. Default deny nos dois
// eixos.

const CACHE_TTL_SECONDS = 300;

function cacheKey(tenantId: string, userId: string): string {
  return `meridian-role:${tenantId}:${userId}`;
}

async function fetchRole(
  userId: string,
  tenantId: string
): Promise<MeridianRole | null> {
  const membership = await database.meridianMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function getMeridianRole(
  userId: string,
  tenantId: string
): Promise<MeridianRole | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return fetchRole(userId, tenantId);
  }
  const { redis } = await import("@repo/rate-limit");
  const key = cacheKey(tenantId, userId);
  // "none" distingue "sem papel, já consultado" de "cache vazio" — sem isso,
  // todo request de quem não tem acesso volta ao banco.
  const cached = await redis.get<string>(key);
  if (cached) {
    return cached === "none" ? null : (cached as MeridianRole);
  }
  const role = await fetchRole(userId, tenantId);
  await redis.set(key, role ?? "none", { ex: CACHE_TTL_SECONDS });
  return role;
}

export async function invalidateMeridianRoleCache(
  tenantId: string,
  userId: string
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.del(cacheKey(tenantId, userId));
}
