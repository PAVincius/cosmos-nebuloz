import { getLangfuse } from "./langfuse";

type CopilotTraceCtx = {
  tenantId: string;
  userId: string;
  mode: string;
  surface: string;
  provider: string;
  sessionId: string;
};

export function createCopilotTrace(ctx: CopilotTraceCtx) {
  const lf = getLangfuse();
  if (!lf) {
    return null;
  }

  return lf.trace({
    name: "safe-copilot",
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    tags: ["copilot", ctx.mode, ctx.surface, ctx.provider],
    metadata: {
      tenantId: ctx.tenantId,
      mode: ctx.mode,
      surface: ctx.surface,
      provider: ctx.provider,
    },
  });
}
