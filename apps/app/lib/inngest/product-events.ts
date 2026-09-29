import { z } from "zod";

// X-04 — eventos entre produtos (correcoes.pdf §05).
//
// Contrato compartilhado entre quem emite (Scaffold, Signal, Charter) e quem
// consome (hoje o Cosmos, para o gate fechado). Um lugar só: emissor e consumidor
// importam daqui os mesmos schemas, e uma mudança de formato quebra os dois no
// typecheck em vez de no primeiro evento em produção.
//
// Nomes seguem a convenção que o repositório já usa ("ai-law/watch.requested",
// "integration/linear.webhook"): domínio/coisa.ação. O plano falava em
// "scaffold.gate.closed"; aqui é "scaffold/gate.closed".
//
// Regras do contrato:
//   • Todo evento leva `tenantId`. O consumidor abre `withTenantDb` com ele; sem
//     tenant não há como respeitar a RLS.
//   • Só ids e fatos, nunca o objeto inteiro do outro produto: cada produto é
//     dono da sua entidade (mapa de fronteiras). Quem consome relê o que precisa.
//   • O `id` do evento sai do FATO (resultado de gate, baseline, relatório...),
//     nunca do relógio. O Inngest descarta id repetido por 24h, o que torna
//     reenvio (fila de fallback, retry da action) inofensivo. É a primeira
//     camada; a idempotência de verdade do consumidor é a chave única no banco.

const Iso = z.iso.datetime();
const Phase = z.enum(["ASSESS", "PILOT", "SCALE", "EMBED"]);

export const PRODUCT_EVENTS = {
  scaffoldGateClosed: "scaffold/gate.closed",
  scaffoldGateReopened: "scaffold/gate.reopened",
  signalBaselineFrozen: "signal/baseline.frozen",
  signalVerdict: "signal/verdict",
  signalTargetReviewRequested: "signal/target-review.requested",
  charterControlAccepted: "charter/control.accepted",
  charterControlExpired: "charter/control.expired",
} as const;

export type ProductEventKey = keyof typeof PRODUCT_EVENTS;

/** Gate de fase fechado (por critérios ou por override). `openedPhase` é a fase
 *  que abriu em seguida; nulo na EMBED, que não avança (abre a janela de
 *  observação). */
const scaffoldGateClosed = z.object({
  tenantId: z.string().min(1),
  trackId: z.string().min(1),
  trackCode: z.string().min(1),
  processName: z.string().min(1),
  closedPhase: Phase,
  openedPhase: Phase.nullable(),
  outcome: z.enum(["PASSED", "OVERRIDDEN"]),
  gateResultId: z.string().min(1),
  at: Iso,
});

/** Gate reaberto. O consumidor decide o que fazer; o Cosmos NÃO apaga épico nem
 *  feature (seção e.1 do Norte). */
const scaffoldGateReopened = z.object({
  tenantId: z.string().min(1),
  trackId: z.string().min(1),
  trackCode: z.string().min(1),
  phase: Phase,
  phaseInstanceId: z.string().min(1),
  reopenCount: z.number().int().nonnegative(),
  at: Iso,
});

/** Baseline assinado (congelado) no Signal. `scaffoldTrackId` liga ao Scaffold
 *  quando a iniciativa nasceu de uma trilha. */
const signalBaselineFrozen = z.object({
  tenantId: z.string().min(1),
  initiativeId: z.string().min(1),
  initiativeCode: z.string().min(1),
  baselineId: z.string().min(1),
  version: z.number().int().positive(),
  scaffoldTrackId: z.string().min(1).nullable(),
  at: Iso,
});

/** Veredito de uma iniciativa no fechamento de um relatório. */
const signalVerdict = z.object({
  tenantId: z.string().min(1),
  initiativeCode: z.string().min(1),
  verdict: z.enum(["PROVEN", "VANITY", "PROMISE", "STOP"]),
  reportId: z.string().min(1),
  reportCode: z.string().min(1),
  at: Iso,
});

/** Pedido de revisão de meta de métrica congelada. O texto do pedido fica no
 *  histórico do Signal (`eventId`); o Scaffold, dono do baseline e do caso de
 *  negócio, relê de lá em vez de receber a prosa por evento. */
const signalTargetReviewRequested = z.object({
  tenantId: z.string().min(1),
  initiativeId: z.string().min(1),
  initiativeCode: z.string().min(1),
  scaffoldTrackId: z.string().min(1).nullable(),
  planMetricId: z.string().min(1),
  metricName: z.string().min(1),
  eventId: z.string().min(1),
  at: Iso,
});

const charterControlBase = z.object({
  tenantId: z.string().min(1),
  useCaseId: z.string().min(1),
  caseControlId: z.string().min(1),
  controlCode: z.string().min(1),
  at: Iso,
});

/** Controle do caso aceito. `expiresAt` é o fim da validade pela cadência. */
const charterControlAccepted = charterControlBase.extend({
  expiresAt: Iso.nullable(),
});

/** Controle aceito que venceu (job de cadência). */
const charterControlExpired = charterControlBase;

export const PRODUCT_EVENT_SCHEMAS = {
  scaffoldGateClosed,
  scaffoldGateReopened,
  signalBaselineFrozen,
  signalVerdict,
  signalTargetReviewRequested,
  charterControlAccepted,
  charterControlExpired,
} as const;

export type ProductEventData<K extends ProductEventKey> = z.infer<
  (typeof PRODUCT_EVENT_SCHEMAS)[K]
>;

export type ProductEvent<K extends ProductEventKey> = {
  name: (typeof PRODUCT_EVENTS)[K];
  id: string;
  data: ProductEventData<K>;
};

/** Chave do fato de cada evento, para o id de idempotência. */
const FACT_KEY: {
  [K in ProductEventKey]: (data: ProductEventData<K>) => string;
} = {
  scaffoldGateClosed: (d) => d.gateResultId,
  // O ciclo entra no id: sem ele, a segunda reabertura da mesma fase seria
  // descartada como duplicata da primeira.
  scaffoldGateReopened: (d) => `${d.phaseInstanceId}:${d.reopenCount}`,
  signalBaselineFrozen: (d) => d.baselineId,
  signalVerdict: (d) => `${d.reportId}:${d.initiativeCode}`,
  signalTargetReviewRequested: (d) => d.eventId,
  charterControlAccepted: (d) => `${d.caseControlId}:${d.at}`,
  charterControlExpired: (d) => `${d.caseControlId}:${d.at}`,
};

/** Valida o dado e monta o evento pronto para `inngest.send`. Lança se o dado
 *  não bate com o contrato. */
export function buildProductEvent<K extends ProductEventKey>(
  key: K,
  data: ProductEventData<K>
): ProductEvent<K> {
  const parsed = PRODUCT_EVENT_SCHEMAS[key].parse(data) as ProductEventData<K>;
  const name = PRODUCT_EVENTS[key];
  const fact = (FACT_KEY[key] as (d: ProductEventData<K>) => string)(parsed);
  return { name, id: `${name}:${fact}`, data: parsed };
}
