// Métricas de produto do Scaffold (SC-PM-04), em leitura simples. Puro.
//
// Quatro números, cada um com a definição escrita ao lado na tela:
//
//   1. resumo: entregáveis já iniciados que têm resumo, sobre os iniciados. Os
//      não iniciados ficam fora: ainda não há o que resumir;
//   2. tempo em revisão: média, em horas, entre enviar para revisão e a decisão
//      (aprovar ou pedir ajuste). Envio sem decisão ainda está em revisão e não
//      conta; cada ciclo de um entregável conta uma vez;
//   3. taxa de ajuste: pedidos de ajuste sobre as decisões de revisão;
//   4. trilhas pelo catálogo: as criadas sem lacuna do Meridian, sobre o total.
//
// Sem denominador não há percentual: `null`, nunca zero (zero seria dado).

export type ReviewEvent = {
  deliverableId: string;
  action: "SUBMIT" | "APPROVE" | "REQUEST_ADJUSTMENT";
  at: Date;
};

export type MetricsInput = {
  startedDeliverables: number;
  deliverablesWithSummary: number;
  events: readonly ReviewEvent[];
  tracksTotal: number;
  tracksFromCatalog: number;
};

export type ProductMetrics = {
  summaryCoverage: {
    withSummary: number;
    started: number;
    percent: number | null;
  };
  reviewTime: { reviews: number; averageHours: number | null };
  adjustmentRate: {
    adjustments: number;
    decisions: number;
    percent: number | null;
  };
  catalogStarts: {
    fromCatalog: number;
    total: number;
    percent: number | null;
  };
};

const HOUR_MS = 3_600_000;

const percent = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 100);

function reviewDurations(events: readonly ReviewEvent[]): number[] {
  const byDeliverable = new Map<string, ReviewEvent[]>();
  for (const e of events) {
    byDeliverable.set(e.deliverableId, [
      ...(byDeliverable.get(e.deliverableId) ?? []),
      e,
    ]);
  }
  const out: number[] = [];
  for (const list of byDeliverable.values()) {
    const ordered = [...list].sort((a, b) => a.at.getTime() - b.at.getTime());
    let submittedAt: Date | null = null;
    for (const e of ordered) {
      if (e.action === "SUBMIT") {
        submittedAt = e.at;
      } else if (submittedAt) {
        out.push(e.at.getTime() - submittedAt.getTime());
        submittedAt = null;
      }
    }
  }
  return out;
}

export function computeProductMetrics(input: MetricsInput): ProductMetrics {
  const durations = reviewDurations(input.events);
  const averageHours =
    durations.length === 0
      ? null
      : Math.round(
          (durations.reduce((a, b) => a + b, 0) / durations.length / HOUR_MS) *
            10
        ) / 10;

  const adjustments = input.events.filter(
    (e) => e.action === "REQUEST_ADJUSTMENT"
  ).length;
  const decisions = input.events.filter((e) => e.action !== "SUBMIT").length;

  return {
    summaryCoverage: {
      withSummary: input.deliverablesWithSummary,
      started: input.startedDeliverables,
      percent: percent(
        input.deliverablesWithSummary,
        input.startedDeliverables
      ),
    },
    reviewTime: { reviews: durations.length, averageHours },
    adjustmentRate: {
      adjustments,
      decisions,
      percent: percent(adjustments, decisions),
    },
    catalogStarts: {
      fromCatalog: input.tracksFromCatalog,
      total: input.tracksTotal,
      percent: percent(input.tracksFromCatalog, input.tracksTotal),
    },
  };
}
