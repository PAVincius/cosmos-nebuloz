import { withTenantDb } from "@repo/database";
import { resolveBaselineValue } from "@/lib/signal/plan-freeze";
import { inngest } from "./client";
import {
  PRODUCT_EVENT_SCHEMAS,
  PRODUCT_EVENTS,
  type ProductEventData,
} from "./product-events";

// X-04 / SG-PO-03 do Norte — "→ Congelada: Sistema, no evento de baseline
// congelado". Quando o baseline da iniciativa é assinado, as métricas do plano
// passam a FROZEN: a meta e o baseline deixam de ser editáveis (trigger no banco)
// e mudar meta vira pedido de revisão ao Scaffold.
//
// Congela NO_SOURCE, MEASURING e PAUSED. PROPOSED fica de fora: proposta está
// fora do veredito e do ROI até o OWNER aprovar (SG-PO-05), então não assumiu
// baseline nenhum.
//
// `baselineValue` é copiado da dimensão do baseline assinado apontada por
// `SignalPlanMetric.baselineDimensionKey`. Sem dimensão, ou dimensão sem valor
// numérico, a métrica congela mesmo assim com o valor nulo, e o evento diz isso:
// esconder o buraco seria pior do que mostrá-lo.
//
// Idempotente: o UPDATE só age em quem ainda não está FROZEN
// (`state: { not: "FROZEN" }`), e só quem foi de fato atualizado gera evento.
// Reprocessar o mesmo evento, ou duas entregas em corrida, não sobem versão nem
// duplicam histórico.

type BaselineFrozen = ProductEventData<"signalBaselineFrozen">;

export type BaselineFreezeResult =
  | { skipped: "baseline-not-signed" }
  | { frozen: number; alreadyFrozen: number };

const FREEZABLE = ["NO_SOURCE", "MEASURING", "PAUSED"] as const;
const NO_VALUE_NOTE =
  "Congelada sem valor de baseline: a métrica não tem dimensão correspondente no baseline assinado ou a dimensão não tem valor numérico.";

export async function applyBaselineFrozen(
  data: BaselineFrozen
): Promise<BaselineFreezeResult> {
  return await withTenantDb(data.tenantId, async (db) => {
    const baseline = await db.signalBaseline.findFirst({
      where: {
        id: data.baselineId,
        tenantId: data.tenantId,
        initiativeId: data.initiativeId,
        signedAt: { not: null },
      },
      select: {
        id: true,
        dimensions: { select: { key: true, numericValue: true } },
      },
    });
    if (!baseline) {
      return { skipped: "baseline-not-signed" as const };
    }

    const metrics = await db.signalPlanMetric.findMany({
      where: {
        tenantId: data.tenantId,
        initiativeId: data.initiativeId,
        state: { in: [...FREEZABLE] },
      },
      select: {
        id: true,
        state: true,
        version: true,
        baselineDimensionKey: true,
        baselineValue: true,
      },
    });

    const events: {
      tenantId: string;
      planMetricId: string;
      action: "FREEZE";
      actorId: null;
      fromState: (typeof FREEZABLE)[number];
      toState: "FROZEN";
      version: number;
      changes: [string, string | null, string | null][];
      comment: string | null;
    }[] = [];
    let alreadyFrozen = 0;

    for (const metric of metrics) {
      // valor assinado ?? valor que a métrica já tinha: congelar nunca apaga um
      // baseline existente.
      const value = resolveBaselineValue(
        baseline.dimensions,
        metric.baselineDimensionKey,
        metric.baselineValue
      );
      const previous =
        metric.baselineValue === null ? null : String(metric.baselineValue);

      const updated = await db.signalPlanMetric.updateMany({
        where: {
          id: metric.id,
          tenantId: data.tenantId,
          state: { not: "FROZEN" },
        },
        data: {
          state: "FROZEN",
          baselineValue: value,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        alreadyFrozen += 1;
        continue;
      }

      events.push({
        tenantId: data.tenantId,
        planMetricId: metric.id,
        action: "FREEZE",
        actorId: null,
        fromState: metric.state as (typeof FREEZABLE)[number],
        toState: "FROZEN",
        version: metric.version + 1,
        changes: [
          ["state", metric.state, "FROZEN"],
          ...(value === previous
            ? []
            : [
                ["baselineValue", previous, value] as [
                  string,
                  string | null,
                  string | null,
                ],
              ]),
        ],
        comment: value === null ? NO_VALUE_NOTE : null,
      });
    }

    if (events.length > 0) {
      await db.signalPlanMetricEvent.createMany({ data: events });
    }
    return { frozen: events.length, alreadyFrozen };
  });
}

export const freezePlanOnBaseline = inngest.createFunction(
  {
    id: "signal-baseline-freeze-plan",
    triggers: [{ event: PRODUCT_EVENTS.signalBaselineFrozen }],
    // Um congelamento por iniciativa por vez.
    concurrency: [{ key: "event.data.initiativeId", limit: 1 }],
    retries: 3,
  },
  async ({ event, step }) => {
    const data = PRODUCT_EVENT_SCHEMAS.signalBaselineFrozen.parse(event.data);
    return await step.run("congelar-plano", () => applyBaselineFrozen(data));
  }
);
