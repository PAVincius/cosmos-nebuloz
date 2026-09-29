import "server-only";

import type { GateReopenedEvent } from "@/lib/scaffold/gate-events";
import { nextState } from "@/lib/scaffold/gate-machine";
import type { ScaffoldContext } from "@/lib/scaffold/guards";
import { type Db, logScaffoldAudit } from "./_shared";

// O que reabrir um entregável aprovado faz com a fase dele (SC-PO-03):
//
//   • fase OPEN: nada, ela já está aberta;
//   • GATE_READY ou BLOCKED: volta para OPEN. O gate estava pronto porque tudo
//     estava aprovado, e já não está. Não conta reabertura: nada foi decidido;
//   • CLOSED ou OBSERVING: a fase é REABERTA, como em `reopenPhase`: OPEN,
//     `reopenCount` + 1, janela zerada, e a trilha volta para ela. O resultado
//     de gate anterior não é tocado (SG-07).
//
// Não escreve CLOSED nem OBSERVING (só `gates.ts` escreve, e o teste de
// arquitetura vigia); só tira a fase deles.

export type PhaseRef = {
  id: string;
  phase: string;
  state: string;
};

export async function reopenPhaseForDeliverable(
  db: Db,
  ctx: ScaffoldContext,
  {
    phase,
    trackId,
    trackCode,
    deliverableCode,
  }: {
    phase: PhaseRef;
    trackId: string;
    trackCode: string;
    deliverableCode: string;
  }
): Promise<GateReopenedEvent | null> {
  if (phase.state === "GATE_READY" || phase.state === "BLOCKED") {
    // Lança se a máquina de fase não admitir a regressão.
    nextState(phase.state, "STEPS_REGRESSED");
    await db.scaffoldPhaseInstance.update({
      where: { id: phase.id },
      data: { state: "OPEN" },
    });
    return null;
  }
  if (phase.state !== "CLOSED" && phase.state !== "OBSERVING") {
    return null;
  }

  nextState(phase.state, "REOPEN");
  await db.scaffoldPhaseInstance.update({
    where: { id: phase.id },
    data: {
      state: "OPEN",
      reopenedAt: new Date(),
      reopenCount: { increment: 1 },
      closedAt: null,
      observationEndsAt: null,
    },
  });
  // A trilha volta para a fase reaberta, como em `reopenPhase`.
  await db.scaffoldTrack.update({
    where: { id: trackId },
    data: { currentPhase: phase.phase as never },
  });
  await logScaffoldAudit(db, ctx, {
    action: "scaffold.deliverable.reopen-phase",
    entityType: "scaffold.phase",
    entityId: phase.id,
    target: `${trackCode} · ${phase.phase}`,
    note: `Fase reaberta porque o entregável ${deliverableCode} aprovado foi reaberto.`,
    diff: [["Estado", phase.state, "OPEN"]],
  });
  // Só a fase que estava FECHADA é notícia para o resto do produto. Quem chama
  // emite depois de a transação fechar.
  return {
    tenantId: ctx.tenantId,
    trackId,
    phaseInstanceId: phase.id,
    phase: phase.phase,
    actorId: ctx.userId,
  };
}
