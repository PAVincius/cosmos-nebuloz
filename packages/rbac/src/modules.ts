import "server-only";
import { database, type ProductModule } from "@repo/database";

// Contratação modular — Cosmos / Charter / Signal.
//
// Isto NÃO é feature flag. Um módulo ausente significa "o cliente não contratou",
// não "ainda não liberamos". Por isso o gate lê TenantModule (com contractedAt /
// expiresAt) e não FeatureFlagOverride.
//
// Default deny: tenant sem linha não tem o módulo. A migration
// 20260728120000_charter_module semeia COSMOS para os tenants existentes.

/** Status que concedem acesso. SUSPENDED e CANCELED não concedem — inadimplência
 *  e cancelamento fecham a porta sem apagar dado. */
const GRANTING_STATUSES = ["ACTIVE", "TRIAL"] as const;

const CACHE_TTL_SECONDS = 300; // 5 min, mesmo TTL do cache de papel SAFe

function cacheKey(tenantId: string): string {
  return `modules:${tenantId}`;
}

async function fetchModules(tenantId: string): Promise<ProductModule[]> {
  const rows = await database.tenantModule.findMany({
    where: {
      tenantId,
      status: { in: [...GRANTING_STATUSES] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { module: true },
  });
  return rows.map((r) => r.module);
}

/** Módulos contratados e vigentes. Fonte do app-switcher e da nav. */
export async function listModules(tenantId: string): Promise<ProductModule[]> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return fetchModules(tenantId);
  }
  const { redis } = await import("@repo/rate-limit");
  const key = cacheKey(tenantId);
  const cached = await redis.get<ProductModule[]>(key);
  if (cached) {
    return cached;
  }
  const modules = await fetchModules(tenantId);
  await redis.set(key, modules, { ex: CACHE_TTL_SECONDS });
  return modules;
}

export async function hasModule(
  tenantId: string,
  productModule: ProductModule
): Promise<boolean> {
  const modules = await listModules(tenantId);
  return modules.includes(productModule);
}

/** Chamar após contratar, suspender ou cancelar um módulo — senão o tenant
 *  espera até 5 min para ver a mudança. */
export async function invalidateModuleCache(tenantId: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return;
  }
  const { redis } = await import("@repo/rate-limit");
  await redis.del(cacheKey(tenantId));
}
