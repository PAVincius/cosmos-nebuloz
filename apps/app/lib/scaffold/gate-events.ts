import "server-only";

import { emitProductEvent } from "@/lib/inngest/emit-product-event";

// Ponto de emissão dos eventos de gate do Scaffold para o resto do produto
// (X-04: `scaffold/gate.closed`, `scaffold/gate.reopened`).
//
// Quem reabre fase chama `emitGateReopened` DEPOIS de a transação fechar, nunca
// dentro dela. O corpo envia o evento pelo contrato compartilhado
// (`lib/inngest/product-events.ts`), o mesmo do `reopenPhase`. `emitProductEvent`
// nunca lança: Inngest fora do ar vai para a fila de fallback.

export type GateReopenedEvent = {
  tenantId: string;
  trackId: string;
  /** Código legível da trilha, "TR-104". */
  trackCode: string;
  phaseInstanceId: string;
  phase: string;
  /** Ciclo de reabertura já contado, o que torna a 2ª reabertura um evento novo. */
  reopenCount: number;
  /** ISO 8601 do instante da reabertura. */
  at: string;
  /** Quem reabriu: o ator da sessão. Fica na trilha de auditoria, não no evento. */
  actorId: string;
};

export async function emitGateReopened(
  event: GateReopenedEvent
): Promise<void> {
  await emitProductEvent("scaffoldGateReopened", {
    tenantId: event.tenantId,
    trackId: event.trackId,
    trackCode: event.trackCode,
    phase: event.phase as "ASSESS" | "PILOT" | "SCALE" | "EMBED",
    phaseInstanceId: event.phaseInstanceId,
    reopenCount: event.reopenCount,
    at: event.at,
  });
}
