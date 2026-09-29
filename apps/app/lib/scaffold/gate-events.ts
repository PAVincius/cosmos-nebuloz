import "server-only";

// Ponto de emissão dos eventos de gate do Scaffold para o resto do produto
// (X-04: `scaffold/gate.closed`, `scaffold/gate.reopened`).
//
// O emissor (Inngest) vive na frente das costuras e ainda não está neste branch.
// Este arquivo fixa o contrato do payload e o lugar da chamada: quem reabre fase
// chama `emitGateReopened` DEPOIS de a transação fechar, nunca dentro dela. Na
// integração, o corpo passa a enviar o evento; até lá não faz nada.

export type GateReopenedEvent = {
  tenantId: string;
  trackId: string;
  phaseInstanceId: string;
  phase: string;
  /** Quem reabriu: o ator da sessão. */
  actorId: string;
};

export async function emitGateReopened(
  _event: GateReopenedEvent
): Promise<void> {
  // TODO(X-04): inngest.send({ name: "scaffold/gate.reopened", data: _event })
  // quando o emissor do Alicerce entrar neste branch.
}
