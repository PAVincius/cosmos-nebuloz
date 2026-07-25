"use server";

import { createHash } from "node:crypto";
import { getActiveProvider, getAIModel } from "@repo/ai/lib/models";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { streamText } from "ai";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const JSON_BLOCK_RE = /\{[\s\S]*\}/;

const INVEST_LIMITS: Record<string, number> = {
  ORBIT: 200,
  GALAXY: 2000,
  NEBULA: 2000,
  UNIVERSE: Number.POSITIVE_INFINITY,
};

const INVEST_WEIGHTS = {
  I: 0.1,
  N: 0.15,
  V: 0.3,
  E: 0.2,
  S: 0.15,
  T: 0.1,
};

const SYSTEM_PROMPT = `You are a SAFe 6.0 expert evaluating epics against the INVEST criteria.
Analyze the epic and for each criterion return a score 0-100, one-sentence feedback, and one-sentence improvement suggestion.
INVEST criteria weights: Independent(10%) Negotiable(15%) Valuable(30%) Estimable(20%) Small(15%) Testable(10%).
Respond ONLY with valid JSON in exactly this format:
{"I":{"score":0,"feedback":"","suggestion":""},"N":{"score":0,"feedback":"","suggestion":""},"V":{"score":0,"feedback":"","suggestion":""},"E":{"score":0,"feedback":"","suggestion":""},"S":{"score":0,"feedback":"","suggestion":""},"T":{"score":0,"feedback":"","suggestion":""},"composite":0}
Compute composite as the weighted sum. All scores must be integers 0-100.`;

function buildPrompt(epic: {
  title: string;
  descriptionMd: string | null;
  hypothesis: string | null;
  businessOutcomes: unknown;
  mvp: string | null;
  nfrs: string | null;
}): string {
  return `Epic Title: ${epic.title}

Description:
${epic.descriptionMd ?? "(none)"}

Hypothesis: ${epic.hypothesis ?? "(none)"}

Business Outcomes: ${JSON.stringify(epic.businessOutcomes ?? [])}

MVP: ${epic.mvp ?? "(none)"}

NFRs: ${epic.nfrs ?? "(none)"}

Analyze against INVEST and return JSON.`;
}

function computeContentHash(fields: {
  description: string | null;
  hypothesis: string | null;
  businessOutcomes: unknown;
}): string {
  const content = [
    fields.description ?? "",
    fields.hypothesis ?? "",
    JSON.stringify(fields.businessOutcomes ?? []),
  ].join(":");
  return createHash("sha256").update(content).digest("hex");
}

function parseInvestScores(text: string): {
  I: { score: number; feedback: string; suggestion: string };
  N: { score: number; feedback: string; suggestion: string };
  V: { score: number; feedback: string; suggestion: string };
  E: { score: number; feedback: string; suggestion: string };
  S: { score: number; feedback: string; suggestion: string };
  T: { score: number; feedback: string; suggestion: string };
  composite: number;
} | null {
  try {
    const match = text.match(JSON_BLOCK_RE);
    if (!match) {
      return null;
    }
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const keys = ["I", "N", "V", "E", "S", "T"] as const;
    for (const k of keys) {
      const c = parsed[k] as Record<string, unknown> | undefined;
      if (!c || typeof c.score !== "number") {
        return null;
      }
    }
    const breakdown = parsed as {
      I: { score: number; feedback: string; suggestion: string };
      N: { score: number; feedback: string; suggestion: string };
      V: { score: number; feedback: string; suggestion: string };
      E: { score: number; feedback: string; suggestion: string };
      S: { score: number; feedback: string; suggestion: string };
      T: { score: number; feedback: string; suggestion: string };
      composite: number;
    };
    const computed =
      breakdown.I.score * INVEST_WEIGHTS.I +
      breakdown.N.score * INVEST_WEIGHTS.N +
      breakdown.V.score * INVEST_WEIGHTS.V +
      breakdown.E.score * INVEST_WEIGHTS.E +
      breakdown.S.score * INVEST_WEIGHTS.S +
      breakdown.T.score * INVEST_WEIGHTS.T;
    breakdown.composite = Math.round(computed);
    return breakdown;
  } catch {
    return null;
  }
}

const BodySchema = z.object({
  forceRefresh: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ epicId: string }> }
) {
  const headerStore = await headers();
  const ctx = await requireTenantSession(headerStore);
  const { epicId } = await params;

  const body = await request.json().catch(() => ({}));
  const { forceRefresh } = BodySchema.parse(body);

  const epic = await database.epic.findFirst({
    where: { id: epicId, tenantId: ctx.tenantId },
    select: {
      title: true,
      descriptionMd: true,
      hypothesis: true,
      businessOutcomes: true,
      mvp: true,
      nfrs: true,
      investHash: true,
    },
  });

  if (!epic) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const descLen = epic.descriptionMd?.trim().length ?? 0;
  if (descLen < 100) {
    return NextResponse.json(
      {
        code: "INSUFFICIENT_CONTENT",
        field: "description",
        minLength: 100,
        actual: descLen,
      },
      { status: 422 }
    );
  }

  const tenant = await database.tenant.findFirst({
    where: { id: ctx.tenantId },
    select: { plan: true, metadata: true },
  });

  const plan = (tenant?.plan ?? "ORBIT") as string;
  const monthlyLimit = INVEST_LIMITS[plan] ?? 200;

  if (
    monthlyLimit < Number.POSITIVE_INFINITY &&
    process.env.UPSTASH_REDIS_REST_URL
  ) {
    const { redis } = await import("@repo/rate-limit");
    const periodKey = new Date().toISOString().slice(0, 7);
    const usageKey = `invest:usage:${ctx.tenantId}:${periodKey}`;
    const currentUsage = (await redis.get<number>(usageKey)) ?? 0;

    if (currentUsage >= monthlyLimit) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      return NextResponse.json(
        {
          code: "AI_QUOTA_EXCEEDED",
          retryAfter: nextMonth.toISOString(),
          upgradeUrl: "/settings/billing",
        },
        { status: 429 }
      );
    }
  }

  const contentHash = computeContentHash({
    description: epic.descriptionMd,
    hypothesis: epic.hypothesis,
    businessOutcomes: epic.businessOutcomes,
  });

  if (
    !forceRefresh &&
    epic.investHash === contentHash &&
    process.env.UPSTASH_REDIS_REST_URL
  ) {
    const { redis } = await import("@repo/rate-limit");
    const cacheKey = `invest:cache:${ctx.tenantId}:${epicId}:${contentHash}`;
    const cached = await redis.get<{ result: unknown; cachedAt: string }>(
      cacheKey
    );
    if (cached) {
      return NextResponse.json({
        cached: true,
        cachedAt: cached.cachedAt,
        result: cached.result,
      });
    }
  }

  const provider = getActiveProvider();
  if (provider === "none") {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED" }, { status: 503 });
  }
  const model = getAIModel(provider);

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(epic),
    maxOutputTokens: 800,
    onFinish: async ({ text }) => {
      const scores = parseInvestScores(text);
      if (!scores) {
        return;
      }
      await database.epic.updateMany({
        where: { id: epicId, tenantId: ctx.tenantId },
        data: {
          investScore: scores.composite,
          investBreakdown:
            scores as unknown as import("@repo/database").Prisma.InputJsonValue,
          investHash: contentHash,
          investScoreOverridden: false,
          investScoreOutdated: false,
        },
      });

      if (process.env.UPSTASH_REDIS_REST_URL) {
        const { redis } = await import("@repo/rate-limit");
        const cacheKey = `invest:cache:${ctx.tenantId}:${epicId}:${contentHash}`;
        await redis.set(
          cacheKey,
          { result: scores, cachedAt: new Date().toISOString() },
          { ex: 86_400 }
        );
        const periodKey = new Date().toISOString().slice(0, 7);
        const usageKey = `invest:usage:${ctx.tenantId}:${periodKey}`;
        await redis.incr(usageKey);
        await redis.expire(usageKey, 60 * 60 * 24 * 35);
      }
    },
  });

  return result.toTextStreamResponse();
}
