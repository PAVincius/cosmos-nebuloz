import "server-only";

import Langfuse from "langfuse";
import { keys } from "../keys";
import { capturaDeConteudoLigada, mascararConteudo } from "./mascara";

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  const k = keys();
  if (!(k.LANGFUSE_SECRET_KEY && k.LANGFUSE_PUBLIC_KEY)) {
    return null;
  }

  if (!_client) {
    _client = new Langfuse({
      secretKey: k.LANGFUSE_SECRET_KEY,
      publicKey: k.LANGFUSE_PUBLIC_KEY,
      baseUrl: k.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      flushAt: 1, // flush imediatamente em server actions
      flushInterval: 0, // não aguardar intervalo
      // A máscara vive aqui, no cliente, e não em cada `trace.generation(...)`:
      // é o único ponto por onde todo trace passa. Presa a um call site, ela
      // protegeria o copiloto e deixaria o próximo trace que alguém escrever
      // saindo em claro — que é como um controle assim costuma envelhecer.
      ...(capturaDeConteudoLigada() ? {} : { mask: mascararConteudo }),
    });
  }
  return _client;
}

// ─── Model name resolver ──────────────────────────────────────────────────────

export function resolveModelName(provider: string): string {
  switch (provider) {
    case "anthropic":
      return "claude-haiku-4-5-20251001";
    case "google":
      return "gemini-2.0-flash";
    case "openai":
      return "gpt-4o-mini";
    default:
      return "unknown";
  }
}

// ─── Trace factory ────────────────────────────────────────────────────────────

export type RebalanceTraceContext = {
  tenantId: string;
  userId: string;
  role: string;
  provider: string;
  totalFeatures: number;
  totalEpics: number;
};

export function createRebalanceTrace(ctx: RebalanceTraceContext) {
  const lf = getLangfuse();
  if (!lf) {
    return null;
  }

  return lf.trace({
    name: "wsjf-rebalancing",
    userId: ctx.userId,
    sessionId: `${ctx.tenantId}-${Date.now()}`,
    tags: ["wsjf", "rebalancing", ctx.provider, ctx.role],
    metadata: {
      tenantId: ctx.tenantId,
      role: ctx.role,
      provider: ctx.provider,
      model: resolveModelName(ctx.provider),
      totalFeatures: ctx.totalFeatures,
      totalEpics: ctx.totalEpics,
    },
  });
}

// ─── Flush helper ─────────────────────────────────────────────────────────────

export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuse();
  if (lf) {
    await lf.flushAsync();
  }
}
