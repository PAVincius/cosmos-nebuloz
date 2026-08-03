// Constantes de saúde de entrega de webhook. Ficam fora de webhooks.ts porque
// aquele arquivo é `"use server"` e só pode exportar função async — mesmo motivo
// de capacity.constants.ts. A tela lê daqui para rotular o mesmo limiar que a
// action aplica.

/** Estados de WebhookDeliveryStatus que contam como falha de entrega. */
export const FAILING_DELIVERY_STATUSES: ReadonlySet<string> = new Set([
  "FAILED",
  "FAILED_PERMANENTLY",
]);

/** Quantas entregas recentes são lidas para avaliar a saúde do endpoint. */
export const DELIVERY_HEALTH_WINDOW = 5;

/**
 * Falhas consecutivas a partir das quais o endpoint é considerado degradado.
 * FR-020 AC-006: "5xx em 3 tentativas consecutivas" → health DEGRADED.
 */
export const DEGRADED_AFTER_CONSECUTIVE_FAILURES = 3;

/** Tipo do evento sintético do disparo de teste (story-037 AC-004). */
export const TEST_EVENT_TYPE = "ping";
