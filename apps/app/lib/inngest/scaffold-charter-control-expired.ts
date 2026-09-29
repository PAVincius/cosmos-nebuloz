import { withTenantDb } from "@repo/database";
import { nextState } from "@/lib/scaffold/gate-machine";
import { inngest } from "./client";
import {
  PRODUCT_EVENT_SCHEMAS,
  PRODUCT_EVENTS,
  type ProductEventData,
} from "./product-events";

// CH-PM-03 — o Scaffold reage a `charter/control.expired`.
//
// O gate da SCALE JÁ lê os controles do caso ligado no fechamento (G-CHARTER,
// `assertCharterControlsClear`): fechar com controle vencido é impossível mesmo
// sem este consumidor. Ele existe para ANTECIPAR o aviso, não para decidir:
//
//   • SCALE em GATE_READY  -> BLOCKED (transição CRITERIA_UNMET da máquina de
//     fase), com auditoria do motivo. A tela deixa de oferecer o fechamento;
//   • SCALE em OPEN/REOPENED (passos pendentes) -> só auditoria de aviso. OPEN ->
//     BLOCKED não existe na máquina de fase e este consumidor a respeita: o gate
//     lê os controles quando os passos fecharem;
//   • SCALE já FECHADA (CLOSED/OBSERVING) -> só auditoria de aviso. Reabrir é ato
//     humano com comentário (SG-07); o sistema nunca reabre sozinho.
//
// Vínculo controle -> trilha: caso de uso -> ProcessRegistry -> trilha. Tudo
// dentro do `withTenantDb` do tenant do evento.
//
// Não há consumidor de `charter/control.accepted`: o gate lê o estado no
// fechamento, e uma fila sem uso seria custo sem efeito.

type ControlExpired = ProductEventData<"charterControlExpired">;

export type ControlExpiredResult = { blocked: number; warned: number };

const WARN_STATES = ["OPEN", "REOPENED"];
const CLOSED_STATES = ["CLOSED", "OBSERVING"];

export async function applyCharterControlExpired(
  data: ControlExpired
): Promise<ControlExpiredResult> {
  return await withTenantDb(data.tenantId, async (db) => {
    const links = await db.processRegistry.findMany({
      where: {
        tenantId: data.tenantId,
        charterUseCaseId: data.useCaseId,
        scaffoldTrackId: { not: null },
      },
      select: { scaffoldTrackId: true },
    });

    let blocked = 0;
    let warned = 0;

    for (const link of links) {
      const phase = await db.scaffoldPhaseInstance.findFirst({
        where: {
          trackId: link.scaffoldTrackId as string,
          phase: "SCALE",
          track: { tenantId: data.tenantId },
        },
        select: { id: true, state: true, track: { select: { code: true } } },
      });
      if (!phase) {
        continue;
      }

      const audit = (
        action: string,
        diff: [string, string, string][] | null,
        note: string
      ) =>
        db.auditLog.create({
          data: {
            tenantId: data.tenantId,
            userId: null,
            actorId: null,
            actorType: "system",
            action,
            entityType: "scaffold.phase",
            entityId: phase.id,
            diff,
            metadata: {
              origin: PRODUCT_EVENTS.charterControlExpired,
              caseControlId: data.caseControlId,
              controlCode: data.controlCode,
              trackCode: phase.track.code,
              note,
            },
          },
        });

      if (phase.state === "GATE_READY") {
        const to = nextState("GATE_READY", "CRITERIA_UNMET");
        const updated = await db.scaffoldPhaseInstance.updateMany({
          where: { id: phase.id, state: "GATE_READY" },
          data: { state: to },
        });
        if (updated.count === 1) {
          blocked += 1;
          await audit(
            "scaffold.gate.blocked_by_charter_control",
            [["Estado", "GATE_READY", to]],
            `O controle ${data.controlCode} do Charter venceu; a Fase 3 de ${phase.track.code} não fecha até ele voltar a ter evidência aceita.`
          );
        }
      } else if (WARN_STATES.includes(phase.state)) {
        warned += 1;
        await audit(
          "scaffold.gate.charter_control_expired",
          null,
          `O controle ${data.controlCode} do Charter venceu com a Fase 3 de ${phase.track.code} em ${phase.state}. O gate vai recusar o fechamento até a renovação.`
        );
      } else if (CLOSED_STATES.includes(phase.state)) {
        warned += 1;
        await audit(
          "scaffold.gate.charter_control_expired_after_close",
          null,
          `O controle ${data.controlCode} do Charter venceu depois do fechamento da Fase 3 de ${phase.track.code}. A fase não reabre sozinha; reabrir é decisão humana com comentário.`
        );
      }
    }
    return { blocked, warned };
  });
}

export const reactToCharterControlExpired = inngest.createFunction(
  {
    id: "scaffold-charter-control-expired",
    triggers: [{ event: PRODUCT_EVENTS.charterControlExpired }],
    // Um caso de uso por vez: vários controles do mesmo caso vencem juntos no
    // job noturno e não devem correr a mesma fase.
    concurrency: [{ key: "event.data.useCaseId", limit: 1 }],
    retries: 3,
  },
  async ({ event, step }) => {
    const data = PRODUCT_EVENT_SCHEMAS.charterControlExpired.parse(event.data);
    return await step.run("reagir-controle-vencido", () =>
      applyCharterControlExpired(data)
    );
  }
);
