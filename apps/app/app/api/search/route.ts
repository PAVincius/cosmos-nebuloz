import { createHash } from "node:crypto";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const CACHE_TTL_SECONDS = 30;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const ALLOWED_TYPES = new Set([
  "epic",
  "feature",
  "risk",
  "sprint",
  "user",
  "art",
]);

type SearchResult = {
  id: string;
  type: string;
  title: string;
  tenantId: string;
};

function parsePrefixFilter(q: string): {
  query: string;
  typeFilter: string | null;
} {
  const colonIdx = q.indexOf(":");
  if (colonIdx > 0) {
    const prefix = q.slice(0, colonIdx).toLowerCase();
    if (ALLOWED_TYPES.has(prefix)) {
      return { query: q.slice(colonIdx + 1).trim(), typeFilter: prefix };
    }
  }
  return { query: q, typeFilter: null };
}

async function searchEpics(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const rows = await database.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT id, title
    FROM "Epic"
    WHERE "tenantId" = ${tenantId}
      AND "searchVector" @@ plainto_tsquery('english', ${query})
    ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${query})) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    type: "epic",
    title: r.title,
    tenantId,
  }));
}

async function searchFeatures(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const rows = await database.$queryRaw<Array<{ id: string; title: string }>>`
    SELECT id, title
    FROM "Feature"
    WHERE "tenantId" = ${tenantId}
      AND "searchVector" @@ plainto_tsquery('english', ${query})
    ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${query})) DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    type: "feature",
    title: r.title,
    tenantId,
  }));
}

async function getCachedOrSearch(
  cacheKey: string,
  fetcher: () => Promise<SearchResult[]>
): Promise<SearchResult[]> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return fetcher();
  }
  try {
    const { redis } = await import("@repo/rate-limit");
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchResult[];
    }
    const results = await fetcher();
    await redis.set(cacheKey, JSON.stringify(results), {
      ex: CACHE_TTL_SECONDS,
    });
    return results;
  } catch (err) {
    log.error("[search] cache error", err);
    return fetcher();
  }
}

// GET /api/search?q=<query>&type=<epic|feature|...>&limit=10
export async function GET(req: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireTenantSession(await headers());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const rawQ = searchParams.get("q")?.trim() ?? "";
  if (!rawQ) {
    return NextResponse.json({ results: [] });
  }

  const limit = Math.min(
    Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT)),
    MAX_LIMIT
  );

  const { query, typeFilter } = parsePrefixFilter(rawQ);

  const cacheKey = `search:${ctx.tenantId}:${typeFilter ?? "all"}:${createHash("sha256").update(query).digest("hex").slice(0, 16)}`;

  const results = await getCachedOrSearch(cacheKey, async () => {
    const fetchers: Promise<SearchResult[]>[] = [];

    if (!typeFilter || typeFilter === "epic") {
      fetchers.push(searchEpics(ctx.tenantId, query, limit));
    }
    if (!typeFilter || typeFilter === "feature") {
      fetchers.push(searchFeatures(ctx.tenantId, query, limit));
    }

    const all = await Promise.all(fetchers);
    return all.flat().slice(0, limit);
  });

  return NextResponse.json({ results });
}
