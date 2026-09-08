"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adoptionPct } from "@/lib/signal/adoption";
import {
  ALERT_META,
  ALERT_RANK,
  type AlertFinding,
  type AlertKind,
  type AlertThresholds,
  evaluateAlertRules,
} from "@/lib/signal/alerts";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import { computeRoi } from "@/lib/signal/roi";
import { nnStr, optStr } from "../../actions/_base";
import {
  type Db,
  FIELD_LABELS,
  logSignalAudit,
  logSignalSystemAudit,
  nextCode,
  type SignalResult,
  signalAction,
} from "./_shared";

// Alertas — US5.
//
// `evaluateAlerts` é a única coisa aqui que precisa de cuidado: ela roda de
// novo a cada avaliação, então tem de ser IDEMPOTENTE. Um alerta aberto que
// continua valendo é deixado em paz — reabri-lo apagaria quem já o reconheceu
// e quando; um que deixou de valer é resolvido pelo sistema, com nota dizendo
// que foi o sistema. Nenhuma das duas coisas é decisão de pessoa.

const StateSchema = z.object({
  code: nnStr,
  state: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]),
  note: optStr,
});

export type AlertRow = {
  code: string;
  kind: AlertKind;
  kindLabel: string;
  tone: "red" | "amber";
  icon: string;
  question: string;
  state: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  initiativeCode: string;
  initiativeName: string;
  what: string;
  nextStep: string;
  owner: string | null;
  raisedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  note: string | null;
};

const DEFAULT_THRESHOLDS: AlertThresholds = {
  adoptionBar: 60,
  lowAdoptionPct: 40,
  lowAdoptionWeeks: 8,
  weakRoi: 1.0,
};

/** As três regras leem os limiares do tenant, nunca constantes de código. */
async function thresholdsOf(
  db: Db,
  tenantId: string
): Promise<AlertThresholds> {
  const s = await db.signalSettings.findUnique({ where: { tenantId } });
  if (!s) {
    return DEFAULT_THRESHOLDS;
  }
  return {
    adoptionBar: s.adoptionBar,
    lowAdoptionPct: s.lowAdoptionPct,
    lowAdoptionWeeks: s.lowAdoptionWeeks,
    weakRoi: Number(s.weakRoi),
  };
}

export async function listAlerts(
  raw: { state?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" } = {}
): Promise<SignalResult<AlertRow[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const input = z
      .object({
        state: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional(),
      })
      .parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalAlert.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(input.state ? { state: input.state } : {}),
        },
        include: {
          initiative: { select: { code: true, name: true } },
          owner: { select: { name: true, email: true } },
          resolvedBy: { select: { name: true, email: true } },
        },
        orderBy: { raisedAt: "desc" },
      });

      return rows
        .map((a) => ({
          code: a.code,
          kind: a.kind,
          kindLabel: ALERT_META[a.kind].label,
          tone: ALERT_META[a.kind].tone,
          icon: ALERT_META[a.kind].icon,
          question: ALERT_META[a.kind].question,
          state: a.state,
          initiativeCode: a.initiative.code,
          initiativeName: a.initiative.name,
          what: a.what,
          nextStep: a.nextStep,
          owner: a.owner?.name ?? a.owner?.email ?? null,
          raisedAt: a.raisedAt,
          resolvedAt: a.resolvedAt,
          resolvedBy: a.resolvedBy?.name ?? a.resolvedBy?.email ?? null,
          note: a.note,
        }))
        .sort((x, y) => {
          const byRank = ALERT_RANK[x.kind] - ALERT_RANK[y.kind];
          return byRank === 0
            ? y.raisedAt.getTime() - x.raisedAt.getTime()
            : byRank;
        });
    });
  });
}

/** Entrada das regras para uma iniciativa, montada a partir do que está no banco. */
function ruleInputOf(initiative: {
  name: string;
  adoption: {
    periodStart: Date;
    periodEnd: Date;
    activeUsers: number;
    licensedUsers: number;
  }[];
  roiFormulas: { entries: { kind: string; total: unknown }[] }[];
  mappings: {
    connection: {
      code: string;
      name: string;
      health: "HEALTHY" | "STALE" | "DOWN";
    };
  }[];
}) {
  const entries = (initiative.roiFormulas[0]?.entries ?? []).map((e) => ({
    kind: e.kind as "COST" | "RETURN",
    label: "",
    total: Number(e.total),
    sourceLabel: "",
  }));
  const roi = computeRoi(entries);
  // `computeRoi` devolve múltiplo 0 para iniciativa sem nenhuma entrada — é
  // "rascunho", não "não rende". Ler isso como retorno medido faria a regra
  // WEAK acusar de fracasso quem ainda nem lançou a primeira linha da conta.
  const multiple = entries.length === 0 ? null : roi.multiple;

  // A mesma fonte alimenta várias métricas: contar duas vezes faria o alerta
  // dizer "as fontes Zendesk, Zendesk pararam".
  const sources = [
    ...new Map(
      initiative.mappings.map((m) => [m.connection.code, m.connection])
    ).values(),
  ];

  return {
    initiativeName: initiative.name,
    adoption: initiative.adoption.map((s) => ({
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      pct: adoptionPct({
        activeUsers: s.activeUsers,
        licensedUsers: s.licensedUsers,
      }),
    })),
    multiple,
    sources,
  };
}

/** Abre o que passou a valer. Um alerta aberto do mesmo tipo já cobre o caso. */
async function openMissing({
  db,
  tenantId,
  initiative,
  findings,
  openKinds,
}: {
  db: Db;
  tenantId: string;
  initiative: { id: string; code: string };
  findings: AlertFinding[];
  openKinds: Set<AlertKind>;
}): Promise<number> {
  let opened = 0;
  for (const f of findings) {
    if (openKinds.has(f.kind)) {
      continue;
    }
    const code = await nextCode({ db, tenantId, kind: "alert" });
    const created = await db.signalAlert.create({
      data: {
        tenantId,
        code,
        kind: f.kind,
        state: "OPEN",
        initiativeId: initiative.id,
        what: f.what,
        nextStep: f.nextStep,
      },
    });
    await logSignalSystemAudit(db, {
      tenantId,
      action: "Alerta disparado",
      entityType: "signal.alert",
      entityId: created.id,
      target: `${code} · ${initiative.code}`,
      note: f.what,
    });
    opened += 1;
  }
  return opened;
}

/**
 * Resolve o que deixou de valer.
 *
 * Fecha como ato do SISTEMA, com nota dizendo por quê. Um alerta que some
 * sozinho da fila sem explicação faz o time desconfiar da fila inteira — e a
 * pergunta seguinte é sempre "sumiu porque resolveram ou porque quebrou?".
 */
async function resolveStale({
  db,
  tenantId,
  initiativeCode,
  open,
  stillValid,
}: {
  db: Db;
  tenantId: string;
  initiativeCode: string;
  open: { id: string; code: string; kind: AlertKind }[];
  stillValid: Set<AlertKind>;
}): Promise<number> {
  let resolved = 0;
  for (const a of open) {
    if (stillValid.has(a.kind)) {
      continue;
    }
    await db.signalAlert.update({
      where: { id: a.id },
      data: {
        state: "RESOLVED",
        resolvedAt: new Date(),
        note: "A condição que abriu este alerta deixou de valer.",
      },
    });
    await logSignalSystemAudit(db, {
      tenantId,
      action: "Alerta resolvido pelo sistema",
      entityType: "signal.alert",
      entityId: a.id,
      target: `${a.code} · ${initiativeCode}`,
      note: "A condição que abriu este alerta deixou de valer.",
    });
    resolved += 1;
  }
  return resolved;
}

/**
 * Roda as três regras contra as iniciativas ativas.
 *
 * Idempotente: rodar duas vezes seguidas não abre nada na segunda.
 */
export async function evaluateAlerts(): Promise<
  SignalResult<{ opened: number; resolved: number }>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.alert.write");

    const counts = await withTenantDb(ctx.tenantId, async (db) => {
      const thresholds = await thresholdsOf(db, ctx.tenantId);
      const initiatives = await db.signalInitiative.findMany({
        where: { tenantId: ctx.tenantId, status: "ACTIVE" },
        select: {
          id: true,
          code: true,
          name: true,
          adoption: {
            orderBy: { periodStart: "desc" },
            select: {
              periodStart: true,
              periodEnd: true,
              activeUsers: true,
              licensedUsers: true,
            },
          },
          roiFormulas: {
            where: { state: "ACTIVE" },
            select: { entries: { select: { kind: true, total: true } } },
          },
          mappings: {
            select: {
              connection: {
                select: { code: true, name: true, health: true },
              },
            },
          },
          alerts: {
            where: { state: { in: ["OPEN", "ACKNOWLEDGED"] } },
            select: { id: true, code: true, kind: true },
          },
        },
      });

      let opened = 0;
      let resolved = 0;

      for (const initiative of initiatives) {
        const findings = evaluateAlertRules(
          ruleInputOf(initiative),
          thresholds
        );
        const stillValid = new Set(findings.map((f) => f.kind));
        const openKinds = new Set(initiative.alerts.map((a) => a.kind));

        opened += await openMissing({
          db,
          tenantId: ctx.tenantId,
          initiative,
          findings,
          openKinds,
        });
        resolved += await resolveStale({
          db,
          tenantId: ctx.tenantId,
          initiativeCode: initiative.code,
          open: initiative.alerts,
          stillValid,
        });
      }

      return { opened, resolved };
    });

    revalidatePath("/signal/alerts");
    revalidatePath("/signal/overview");
    return counts;
  });
}

export async function setAlertState(
  raw: z.input<typeof StateSchema>
): Promise<SignalResult<{ state: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.alert.write");
    const input = StateSchema.parse(raw);

    if (input.state === "RESOLVED" && !input.note?.trim()) {
      // Resolver sem dizer o que foi feito apaga a única coisa que o próximo
      // ciclo vai querer saber: se o problema foi tratado ou só arquivado.
      throw new SignalRuleError(
        "alert.resolve.note",
        "Diga o que foi feito — quem abrir o histórico precisa saber se o problema foi tratado ou arquivado."
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      const before = await db.signalAlert.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
        include: { initiative: { select: { code: true } } },
      });
      if (!before) {
        throw new SignalRuleError(
          "alert.not-found",
          `Alerta ${input.code} não encontrado nesta organização.`
        );
      }

      const resolving = input.state === "RESOLVED";
      await db.signalAlert.update({
        where: { id: before.id },
        data: {
          state: input.state,
          note: input.note ?? before.note,
          resolvedAt: resolving ? new Date() : null,
          resolvedById: resolving ? ctx.userId : null,
        },
      });

      await logSignalAudit(db, ctx, {
        action: resolving ? "Alerta resolvido" : "Alerta reconhecido",
        entityType: "signal.alert",
        entityId: before.id,
        target: `${before.code} · ${before.initiative.code}`,
        note: input.note,
        diff: [[FIELD_LABELS.state, before.state, input.state]],
      });
    });

    revalidatePath("/signal/alerts");
    return { state: input.state };
  });
}
