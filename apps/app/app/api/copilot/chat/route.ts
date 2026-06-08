import { createCopilotTrace } from "@repo/ai/lib/copilot-trace";
import { flushLangfuse, resolveModelName } from "@repo/ai/lib/langfuse";
import { getActiveProvider, getAIModel } from "@repo/ai/lib/router";
import { requireTenantSession } from "@repo/auth/server";
import { log } from "@repo/observability/log";
import { stepCountIs, streamText } from "ai";
import { headers } from "next/headers";
import { z } from "zod";
import { saveCopilotMessages } from "@/app/actions/safe-copilot";
import { buildCopilotContext } from "@/app/actions/safe-copilot/context";
import { getModeMessages } from "@/app/actions/safe-copilot/prompts";
import {
  checkCopilotQuota,
  incrementCopilotUsage,
} from "@/app/actions/safe-copilot/quota";
import { detectPrimaryRole } from "@/app/actions/safe-copilot/roles/detect-role";
import { buildRoleSystemPrompt } from "@/app/actions/safe-copilot/roles/role-prompts";
import { buildCopilotTools } from "@/app/actions/safe-copilot/tools";

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.string(), content: z.string().max(10_000) }))
    .min(1),
  mode: z.string().optional(),
  surface: z.string().optional(),
  contextRef: z.record(z.string(), z.string()).optional(),
  sessionId: z.string().optional(),
});

async function checkIpRateLimit(ip: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(30, "1 m"),
    prefix: "copilot",
  });
  const { success } = await limiter.limit(ip);
  return success;
}

export async function POST(req: Request) {
  try {
    const headerStore = await headers();
    const ctx = await requireTenantSession(headerStore);

    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    if (!(await checkIpRateLimit(ip))) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const raw = await req.json();
    const parseResult = BodySchema.safeParse(raw);
    if (!parseResult.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }
    const body = parseResult.data;

    const mode = body.mode ?? "global";
    const surface = body.surface ?? "global";
    const contextRef = body.contextRef ?? {};
    const sessionId = body.sessionId;

    const quota = await checkCopilotQuota(ctx.tenantId);
    if (!quota.allowed) {
      return Response.json({ error: quota.reason }, { status: 429 });
    }

    const provider = getActiveProvider();
    if (provider === "none") {
      return Response.json(
        {
          error:
            "Nenhum provider de IA configurado. Configure ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou OPENAI_API_KEY.",
        },
        { status: 503 }
      );
    }

    const model = getAIModel(provider);

    const [copilotContext] = await Promise.all([
      buildCopilotContext(ctx.tenantId, mode, surface, contextRef),
    ]);

    const traceSessionId = sessionId ?? `${ctx.tenantId}-${Date.now()}`;
    const trace = createCopilotTrace({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      mode,
      surface,
      provider,
      sessionId: traceSessionId,
    });

    const contextSpan = trace?.span({
      name: "context-collector",
      input: { mode, surface, contextRef },
    });
    contextSpan?.end({
      output: {
        hasPI: !!copilotContext.piWorkspace,
        hasFlow: !!copilotContext.flowMetrics,
        hasBudget: !!copilotContext.leanBudget,
        hasPortfolio: !!copilotContext.portfolio,
      },
    });

    const rolePrompt = buildRoleSystemPrompt(detectPrimaryRole([ctx.role]));
    const modeMessages = getModeMessages(
      mode,
      copilotContext,
      // biome-ignore lint/suspicious/noExplicitAny: AI SDK v5 CoreMessage type compat
      body.messages as any,
      rolePrompt
    );

    const modelName = resolveModelName(provider);
    const gen = trace?.generation({
      name: `mode-${mode}`,
      model: modelName,
      input: modeMessages,
      metadata: { mode, surface, provider, tenantId: ctx.tenantId },
    });

    const result = streamText({
      model,
      // biome-ignore lint/suspicious/noExplicitAny: AI SDK v5 CoreMessage type compat
      messages: modeMessages as any,
      tools: buildCopilotTools(ctx.tenantId),
      stopWhen: stepCountIs(5),
      ...(provider === "anthropic" && {
        providerOptions: {
          anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
        },
      }),
      onFinish: ({ usage, text }) => {
        const totalTokens =
          (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

        gen?.end({
          output: text,
          usage: {
            input: usage.inputTokens,
            output: usage.outputTokens,
            total: totalTokens,
            unit: "TOKENS",
          },
        });

        trace?.score({ name: "copilot_tokens", value: totalTokens });
        trace?.score({ name: "copilot_mode", value: 1, comment: mode });
        trace?.update({ metadata: { mode, surface, totalTokens } });

        incrementCopilotUsage(ctx.tenantId).catch(() => null);

        if (sessionId) {
          saveCopilotMessages(sessionId, body.messages, text).catch(() => null);
        }

        flushLangfuse().catch(() => null);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    log.error("[copilot/chat]", error);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
