import "server-only";
import { PostHog } from "posthog-node";
import { keys } from "./keys";

/**
 * Cliente do PostHog, construído na primeira utilização.
 *
 * Antes era `export const analytics = new PostHog(...)` — construção no escopo
 * do módulo. Isso significa que **importar** o módulo já exige a chave, e o
 * `next build` importa: ao coletar dados de página de `/webhooks/payments` ele
 * executa o módulo e o PostHog lançava "You must pass your PostHog project's
 * api key", derrubando o build inteiro do `apps/api`.
 *
 * Cliente de rede não pertence ao tempo de import. Quem usa o `analytics` está
 * numa requisição, e é lá que a chave existe.
 *
 * O Proxy mantém a forma de antes (`analytics.capture(...)`, `analytics.
 * shutdown()`), então nenhum dos três call sites muda.
 */
let instancia: PostHog | null = null;

function cliente(): PostHog {
  if (!instancia) {
    const k = keys();
    instancia = new PostHog(k.NEXT_PUBLIC_POSTHOG_KEY, {
      host: k.NEXT_PUBLIC_POSTHOG_HOST,

      // Don't batch events and flush immediately - we're running in a
      // serverless environment
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return instancia;
}

export const analytics = new Proxy({} as PostHog, {
  get(_alvo, prop, receptor) {
    const valor = Reflect.get(cliente(), prop, receptor);
    return typeof valor === "function" ? valor.bind(cliente()) : valor;
  },
});
