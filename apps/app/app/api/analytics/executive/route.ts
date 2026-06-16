// Story-029 AC-006: GET /api/analytics/executive
// Auth: Bearer ApiKey with `analytics:read` scope
// PII gate: `?include_member_pii=true` requires `analytics:pii` scope

import { createHash } from "node:crypto";
import { database } from "@repo/database";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildExecutiveDashboardData,
  EXECUTIVE_CACHE_TTL,
  type ExecutiveDashboardPayload,
  executiveCacheKey,
} from "@/lib/analytics/executive-dashboard";

const ANALYTICS_SCOPE = "analytics:read";
const PII_SCOPE = "analytics:pii";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Bearer token ───────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return unauthorized("Missing Bearer token");
  }
  const rawKey = authHeader.slice(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  // ── 2. ApiKey lookup ──────────────────────────────────────────────────────
  const apiKey = await database.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      tenantId: true,
      scope: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!apiKey || apiKey.revokedAt) {
    return unauthorized("Invalid API key");
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return unauthorized("API key expired");
  }
  if (!apiKey.scope.includes(ANALYTICS_SCOPE)) {
    return forbidden(`Scope '${ANALYTICS_SCOPE}' required`);
  }

  const { tenantId } = apiKey;
  const includePii =
    req.nextUrl.searchParams.get("include_member_pii") === "true" &&
    apiKey.scope.includes(PII_SCOPE);

  // ── 3. artIds filter ──────────────────────────────────────────────────────
  const artIds = req.nextUrl.searchParams.getAll("art_id");
  const artIdsFilter = artIds.length > 0 ? artIds : undefined;

  // ── 4. Redis cache ────────────────────────────────────────────────────────
  const { redis } = await import("@repo/rate-limit");
  const cacheKey = executiveCacheKey(tenantId, artIdsFilter);
  const cached = await redis.get<ExecutiveDashboardPayload>(cacheKey);

  let data: ExecutiveDashboardPayload;
  let cacheHit = false;

  if (cached) {
    data = { ...cached, fromCache: true };
    cacheHit = true;
  } else {
    data = await buildExecutiveDashboardData(tenantId, artIdsFilter);
    await redis.set(cacheKey, data, { ex: EXECUTIVE_CACHE_TTL });
  }

  // PII strip reserved for future member-level data
  const payload = includePii ? data : data;

  // ── 5. Audit + usage log ──────────────────────────────────────────────────
  database.auditLog
    .create({
      data: {
        tenantId,
        actorId: apiKey.id,
        actorType: "api_key",
        action: "analytics.executive.api.accessed",
        metadata: { artIds: artIdsFilter ?? "all", includePii, cacheHit },
      },
    })
    .catch(() => {});

  database.apiKeyUsageLog
    .create({
      data: {
        apiKeyId: apiKey.id,
        tenantId,
        endpoint: "/api/analytics/executive",
        method: "GET",
        statusCode: 200,
      },
    })
    .catch(() => {});

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": `private, max-age=${EXECUTIVE_CACHE_TTL}`,
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}
