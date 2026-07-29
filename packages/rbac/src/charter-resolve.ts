import "server-only";
import { type CharterRole, database } from "@repo/database";

// Resolução do papel de governança do Charter.
//
// Ortogonal ao papel SAFe: getEffectiveRole() responde "o que essa pessoa faz na
// entrega"; isto responde "o que essa pessoa pode fazer na governança". A mesma
// pessoa pode ser DEV no Cosmos e AUDITOR no Charter.
//
// Ausência de CharterMembership retorna null — sem acesso ao Charter, mesmo com
// o módulo contratado e mesmo sendo ADMIN do tenant. Default deny nos dois eixos.

const CACHE_TTL_SECONDS = 300;

function cacheKey(tenantId: string, userId: string): string {
  return `charter-role:${tenantId}:${userId}`;
}

async function fetchRole(
  userId: string,
  tenantId: string
): Promise<CharterRole | null> {
  const membership = await database.charterMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function getCharterRole(
  userId: string,
  tenantId: string
): Promise<CharterRole | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return fetchRole(userId, tenantId);
  }
  const { redis } = await import("@repo/rate-limit");
  const key = cacheKey(tenantId, userId);
  // "none" distingue "sem papel, já consultado" de "cache vazio" — sem isso,
  // todo request de quem não tem acesso volta ao banco.
  const cached = await redis.get<string>(key);
  if (cached) {
    return cached === "none" ? null : (cached as CharterRole);
  }
  const role = await fetchRole(userId, tenantId);
  await redis.set(key, role ?? "none", { ex: CACHE_TTL_SECONDS });
  return role;
}

export async function invalidateCharterRoleCache(
  tenantId: string,
  userId: string
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.del(cacheKey(tenantId, userId));
}
