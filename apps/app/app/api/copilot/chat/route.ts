import { createCopilotTrace } from "@repo/ai/lib/copilot-trace";
import { flushLangfuse, resolveModelName } from "@repo/ai/lib/langfuse";
import { getActiveProvider, getAIModel } from "@repo/ai/lib/router";
import { requireTenantSession } from "@repo/auth/server";
import { log } from "@repo/observability/log";
import { stepCountIs, streamText } from "ai";
import { headers } from "next/headers";
import { saveCopilotMessages } from "@/app/actions/safe-copilot";
import { ChatRequestSchema } from "@/app/actions/safe-copilot/chat-request";
import { buildCopilotContext } from "@/app/actions/safe-copilot/context";
import { getModeMessages } from "@/app/actions/safe-copilot/prompts";
import {
  checkCopilotQuota,
  incrementCopilotUsage,
} from "@/app/actions/safe-copilot/quota";
import {
  avaliarLimite,
  limitarPorIp,
} from "@/app/actions/safe-copilot/rate-limit-gate";
import { detectPrimaryRole } from "@/app/actions/safe-copilot/roles/detect-role";
import { buildRoleSystemPrompt } from "@/app/actions/safe-copilot/roles/role-prompts";
import { buildCopilotTools } from "@/app/actions/safe-copilot/tools";

export async function POST(req: Request) {
  try {
    const headerStore = await headers();
    const ctx = await requireTenantSession(headerStore);

    const ip =
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    const limite = await avaliarLimite(ip, {
      producao: process.env.NODE_ENV === "production",
      limitar: limitarPorIp,
    });
    if (limite === "excedido") {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    if (limite === "indisponivel") {
      // 503 e não 429: o cliente não excedeu nada. Devolver 429 aqui mandaria
      // a pessoa esperar por um limite que não existe, e esconderia um erro de
      // configuração atrás de uma mensagem plausível.
      return Response.json(
        { error: "Serviço temporariamente indisponível." },
        { status: 503 }
      );
    }

    const raw = await req.json();
    const parseResult = ChatRequestSchema.safeParse(raw);
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
      messages: modeMessages as any,
      // O papel vai junto: sem ele, o guard de escrita das tools nega tudo por
      // padrão — e antes desta linha ele nunca era avaliado.
      tools: buildCopilotTools(ctx.tenantId, ctx.role),
      stopWhen: stepCountIs(5),
      ...(provider === "anthropic" && {
        providerOptions: {
          anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
        },
      }),
      onFinish: ({ usage, text, providerMetadata }) => {
        const totalTokens =
          (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

        // Cache: leituras chegam em `usage.cachedInputTokens`, escritas em
        // `providerMetadata.anthropic.cacheCreationInputTokens`. Sem os dois no
        // trace não há como saber se o `cacheControl` está de fato pegando —
        // quando ele falha (prefixo abaixo do mínimo do modelo, ou instável),
        // a Anthropic não devolve erro nenhum, só para de cachear.
        const cacheRead = usage.cachedInputTokens ?? 0;
        const cacheWrite = Number(
          (providerMetadata?.anthropic as Record<string, unknown> | undefined)
            ?.cacheCreationInputTokens ?? 0
        );

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
        trace?.score({ name: "copilot_cache_read_tokens", value: cacheRead });
        trace?.score({ name: "copilot_cache_write_tokens", value: cacheWrite });
        trace?.score({ name: "copilot_mode", value: 1, comment: mode });
        trace?.update({
          metadata: { mode, surface, totalTokens, cacheRead, cacheWrite },
        });

        incrementCopilotUsage(ctx.tenantId).catch(() => null);

        if (sessionId) {
          saveCopilotMessages(sessionId, body.messages, text).catch(() => null);
        }

        flushLangfuse().catch(() => null);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    log.error("[copilot/chat]", { error: String(error) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
