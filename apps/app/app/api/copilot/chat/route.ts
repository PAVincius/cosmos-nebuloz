import { createCopilotTrace } from "@repo/ai/lib/copilot-trace";
import { flushLangfuse, resolveModelName } from "@repo/ai/lib/langfuse";
import { getActiveProvider, getAIModel } from "@repo/ai/lib/router";
import { requireTenantSession } from "@repo/auth/server";
import { stepCountIs, streamText } from "ai";
import { headers } from "next/headers";
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

export async function POST(req: Request) {
  try {
    const ctx = await requireTenantSession(await headers());

    const body = (await req.json()) as {
      messages: { role: string; content: string }[];
      mode?: string;
      surface?: string;
      contextRef?: Record<string, string>;
      sessionId?: string;
    };

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
    const msg = error instanceof Error ? error.message : "Erro interno";
    return Response.json({ error: msg }, { status: 500 });
  }
}
