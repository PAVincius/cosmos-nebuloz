"use server";

import { type SignalRole, withTenantDb } from "@repo/database";
import { hasSignalPermission, ownsOrOutranksInitiative } from "@repo/rbac";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import {
  countsInVerdict,
  PLAN_ROLE_META,
  PLAN_ROLE_ORDER,
  PLAN_STATE_META,
  type PlanRole,
  type PlanState,
  planActionDenial,
} from "@/lib/signal/plan";
import { nnStr } from "../../actions/_base";
import { type SignalResult, signalAction } from "./_shared";

// Leituras do plano de medição e dos modelos — SG-DEV-04.
//
// O "Agora" e o baseline são LEITURAS, não colunas: a fórmula continua fora do
// banco (convenção do módulo). O baseline só vira coluna quando congela, e
// então é o número do contrato — o que o gate do Scaffold firmou.

const WORK_FORM_ORDER = [
  "CONVERSATIONAL",
  "ANALYSIS",
  "DOC_REVIEW",
  "TRIAGE",
  "REPORTING",
] as const;

type Direction = "UP" | "DOWN";

export type MeasureModelCard = {
  workForm: string;
  name: string;
  versionLabel: string;
  counterfactual: string;
  sampleWindowWeeks: number;
  sources: string[];
  traps: string[];
  note: string | null;
  metrics: {
    role: PlanRole;
    roleLabel: string;
    name: string;
    formula: string;
    direction: Direction;
  }[];
  /** Iniciativas deste tenant que usam o modelo. */
  inUse: { code: string; name: string }[];
};

export type PlanMetricRow = {
  id: string;
  role: PlanRole;
  roleLabel: string;
  name: string;
  formula: string;
  direction: Direction;
  state: PlanState;
  stateLabel: string;
  stateTone: string;
  /** Rótulo da fonte mapeada, com a saúde da conexão. */
  source: { label: string; health: string; healthy: boolean } | null;
  baseline: number | null;
  current: number | null;
  target: number | null;
  ownerId: string | null;
  ownerName: string | null;
  version: number;
  /** Proposta fica fora do veredito e do ROI até ser aprovada. */
  inVerdict: boolean;
  fromModel: boolean;
};

export type InitiativePlan = {
  initiativeCode: string;
  initiativeName: string;
  metrics: PlanMetricRow[];
  model: {
    name: string;
    versionLabel: string;
    counterfactual: string;
    sampleWindowWeeks: number;
    traps: string[];
  } | null;
  baselineOrigin: {
    scaffoldTrackId: string | null;
    baselineVersion: number | null;
    signedAt: Date | null;
  };
  /** Motivo da negativa para os controles de decisão; nulo = pode agir. */
  decisionDenial: string | null;
  canMapSource: boolean;
  /** Motivo de mapear fonte estar desabilitado; nulo = pode. */
  mapDenial: string | null;
  /** Forma de trabalho da iniciativa (de onde vem o modelo); nula = sem classificar. */
  workForm: string | null;
  /** Quem pode ser responsável: membros do tenant com papel no Signal. */
  owners: { id: string; name: string }[];
  /** Mapeamentos que podem alimentar uma métrica desta iniciativa. */
  mappings: { id: string; label: string; healthy: boolean }[];
};

export type PlanMetricHistory = {
  metric: PlanMetricRow & { fromModelName: string | null };
  /** Últimas leituras da fonte mapeada (as "observações" do modal). */
  observations: {
    code: string;
    value: string;
    unit: string | null;
    observedAt: Date;
    flag: string | null;
  }[];
  events: {
    id: string;
    action: string;
    actor: string;
    fromState: PlanState | null;
    toState: PlanState | null;
    version: number;
    changes: [string, string, string][];
    comment: string | null;
    at: Date;
  }[];
};

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export async function listMeasureModels(): Promise<
  SignalResult<MeasureModelCard[]>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const [models, initiatives] = await Promise.all([
        db.signalMeasureModel.findMany({
          include: {
            versions: {
              orderBy: { publishedAt: "desc" },
              take: 1,
              include: { metrics: { orderBy: { seq: "asc" } } },
            },
          },
        }),
        db.signalInitiative.findMany({
          where: {
            tenantId: ctx.tenantId,
            measureModelVersionId: { not: null },
          },
          select: {
            code: true,
            name: true,
            measureModelVersion: { select: { modelId: true } },
          },
          orderBy: { code: "asc" },
        }),
      ]);

      return models
        .filter((m) => m.versions.length > 0)
        .sort(
          (a, b) =>
            WORK_FORM_ORDER.indexOf(a.workForm) -
            WORK_FORM_ORDER.indexOf(b.workForm)
        )
        .map((m) => {
          const v = m.versions[0];
          return {
            workForm: m.workForm,
            name: m.name,
            versionLabel: v.label,
            counterfactual: v.counterfactual,
            sampleWindowWeeks: v.sampleWindowWeeks,
            sources: v.sources,
            traps: v.traps,
            note: v.note,
            metrics: [...v.metrics]
              .sort(
                (a, b) =>
                  PLAN_ROLE_ORDER.indexOf(a.role) -
                  PLAN_ROLE_ORDER.indexOf(b.role)
              )
              .map((x) => ({
                role: x.role,
                roleLabel: PLAN_ROLE_META[x.role].label,
                name: x.name,
                formula: x.formula,
                direction: x.direction,
              })),
            inUse: initiatives
              .filter((i) => i.measureModelVersion?.modelId === m.id)
              .map((i) => ({ code: i.code, name: i.name })),
          };
        });
    });
  });
}

function toRow(
  m: {
    id: string;
    role: PlanRole;
    name: string;
    formula: string;
    direction: Direction;
    state: PlanState;
    baselineValue: unknown;
    targetValue: unknown;
    ownerId: string | null;
    version: number;
    modelMetricId: string | null;
    mapping: {
      metricLabel: string;
      connection: { name: string; health: string };
    } | null;
  },
  current: number | null,
  owners: Map<string, string>
): PlanMetricRow {
  return {
    id: m.id,
    role: m.role,
    roleLabel: PLAN_ROLE_META[m.role].label,
    name: m.name,
    formula: m.formula,
    direction: m.direction,
    state: m.state,
    stateLabel: PLAN_STATE_META[m.state].label,
    stateTone: PLAN_STATE_META[m.state].tone,
    source: m.mapping
      ? {
          label: `${m.mapping.metricLabel} · ${m.mapping.connection.name}`,
          health: m.mapping.connection.health,
          healthy: m.mapping.connection.health === "HEALTHY",
        }
      : null,
    baseline: num(m.baselineValue),
    current,
    target: num(m.targetValue),
    ownerId: m.ownerId,
    ownerName: m.ownerId ? (owners.get(m.ownerId) ?? null) : null,
    version: m.version,
    inVerdict: countsInVerdict(m.state),
    fromModel: m.modelMetricId !== null,
  };
}

async function ownerNames(
  db: Tx,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name ?? u.email ?? "—"]));
}

type ObservationRow = { mappingId: string | null; numericValue: unknown };

type Tx = Parameters<Parameters<typeof withTenantDb>[1]>[0];

/** Leituras da fonte de cada métrica, da mais recente para a mais antiga. */
function readObservations(
  db: Tx,
  tenantId: string,
  initiativeId: string,
  mappingIds: string[]
): Promise<ObservationRow[]> {
  if (mappingIds.length === 0) {
    return Promise.resolve([]);
  }
  return db.signalMetricObservation.findMany({
    where: { tenantId, initiativeId, mappingId: { in: mappingIds } },
    orderBy: { observedAt: "desc" },
    select: { mappingId: true, numericValue: true },
  });
}

/** Observação mais recente por mapeamento (a lista já vem ordenada). */
function latestByMapping(rows: ObservationRow[]): Map<string, number | null> {
  const latest = new Map<string, number | null>();
  for (const o of rows) {
    if (o.mappingId && !latest.has(o.mappingId)) {
      latest.set(o.mappingId, num(o.numericValue));
    }
  }
  return latest;
}

/** Motivo de os controles de decisão estarem desabilitados; nulo = pode agir. */
function decisionDenial(
  ctx: { signalRole: SignalRole; userId: string },
  initiativeOwnerId: string
): string | null {
  return (
    planActionDenial(ctx.signalRole, "approve") ??
    (ownsOrOutranksInitiative(ctx.signalRole, ctx.userId, initiativeOwnerId)
      ? null
      : "A iniciativa é de outra pessoa. Seu papel alcança só as próprias.")
  );
}

/** Mapear fonte: precisa de `mapping.write` E de um papel que move o plano
 *  (ADMIN tem a permissão, mas não decide — SG-PO-03). */
function mapSourceDenial(role: SignalRole): string | null {
  return hasSignalPermission(role, "signal.mapping.write")
    ? planActionDenial(role, "edit")
    : "Mapear a fonte é do Analista.";
}

export async function getInitiativePlan(raw: {
  code: string;
}): Promise<SignalResult<InitiativePlan>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const { code } = z.object({ code: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await db.signalInitiative.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code } },
        include: {
          measureModelVersion: true,
          planMetrics: {
            include: {
              mapping: {
                select: {
                  metricLabel: true,
                  connection: { select: { name: true, health: true } },
                },
              },
            },
          },
        },
      });
      if (!initiative) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${code} não encontrada nesta organização.`
        );
      }

      const mappingIds = initiative.planMetrics
        .map((m) => m.sourceMappingId)
        .filter((x): x is string => Boolean(x));

      const [observations, baseline, owners, mappings, members] =
        await Promise.all([
          readObservations(db, ctx.tenantId, initiative.id, mappingIds),
          db.signalBaseline.findFirst({
            where: {
              tenantId: ctx.tenantId,
              initiativeId: initiative.id,
              signedAt: { not: null },
            },
            orderBy: { version: "desc" },
            select: { version: true, signedAt: true },
          }),
          ownerNames(
            db,
            initiative.planMetrics.map((m) => m.ownerId)
          ),
          db.signalMetricMapping.findMany({
            where: {
              tenantId: ctx.tenantId,
              OR: [{ initiativeId: null }, { initiativeId: initiative.id }],
            },
            orderBy: [{ code: "asc" }, { version: "desc" }],
            distinct: ["code"],
            select: {
              id: true,
              code: true,
              metricLabel: true,
              connection: { select: { health: true, name: true } },
            },
          }),
          db.signalMember.findMany({
            where: { tenantId: ctx.tenantId },
            select: { user: { select: { id: true, name: true, email: true } } },
          }),
        ]);

      const latest = latestByMapping(observations);
      const metrics = initiative.planMetrics
        .map((m) =>
          toRow(
            m,
            m.sourceMappingId ? (latest.get(m.sourceMappingId) ?? null) : null,
            owners
          )
        )
        .sort(
          (a, b) =>
            PLAN_ROLE_ORDER.indexOf(a.role) - PLAN_ROLE_ORDER.indexOf(b.role)
        );

      const version = initiative.measureModelVersion;
      const model = version
        ? await db.signalMeasureModel.findUnique({
            where: { id: version.modelId },
            select: { name: true },
          })
        : null;
      const denial = decisionDenial(ctx, initiative.ownerId);
      const mapDenial = mapSourceDenial(ctx.signalRole);

      return {
        initiativeCode: initiative.code,
        initiativeName: initiative.name,
        metrics,
        model:
          version && model
            ? {
                name: model.name,
                versionLabel: version.label,
                counterfactual: version.counterfactual,
                sampleWindowWeeks: version.sampleWindowWeeks,
                traps: version.traps,
              }
            : null,
        baselineOrigin: {
          scaffoldTrackId: initiative.scaffoldTrackId ?? null,
          baselineVersion: baseline?.version ?? null,
          signedAt: baseline?.signedAt ?? null,
        },
        decisionDenial: denial,
        owners: members
          .map((m) => ({
            id: m.user.id,
            name: m.user.name ?? m.user.email ?? "—",
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        canMapSource: mapDenial === null,
        mapDenial,
        workForm: initiative.workForm ?? null,
        mappings: mappings.map((x) => ({
          id: x.id,
          label: `${x.code} · ${x.metricLabel} · ${x.connection.name}`,
          healthy: x.connection.health === "HEALTHY",
        })),
      };
    });
  });
}

export async function getPlanMetric(raw: {
  id: string;
}): Promise<SignalResult<PlanMetricHistory>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const { id } = z.object({ id: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const m = await db.signalPlanMetric.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: {
          mapping: {
            select: {
              metricLabel: true,
              connection: { select: { name: true, health: true } },
            },
          },
          modelMetric: {
            select: {
              version: { select: { model: { select: { name: true } } } },
            },
          },
          events: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!m) {
        throw new SignalRuleError(
          "plan.not-found",
          "Métrica não encontrada nesta organização."
        );
      }

      const [actors, observations] = await Promise.all([
        ownerNames(db, [m.ownerId, ...m.events.map((e) => e.actorId)]),
        m.sourceMappingId
          ? db.signalMetricObservation.findMany({
              where: {
                tenantId: ctx.tenantId,
                initiativeId: m.initiativeId,
                mappingId: m.sourceMappingId,
              },
              orderBy: { observedAt: "desc" },
              take: 5,
              select: {
                code: true,
                value: true,
                unit: true,
                observedAt: true,
                flag: true,
              },
            })
          : Promise.resolve([]),
      ]);

      return {
        metric: {
          ...toRow(m, null, actors),
          fromModelName: m.modelMetric?.version.model.name ?? null,
        },
        observations,
        events: m.events.map((e) => ({
          id: e.id,
          action: e.action,
          actor: e.actorId ? (actors.get(e.actorId) ?? "—") : "Sistema",
          fromState: e.fromState,
          toState: e.toState,
          version: e.version,
          changes: (e.changes as [string, string, string][] | null) ?? [],
          comment: e.comment,
          at: e.createdAt,
        })),
      };
    });
  });
}
