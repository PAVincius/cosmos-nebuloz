"use server";

// value-realization.ts — EpicValueMetric: links a delivered epic to a
// business-value metric with planned vs. actual realization (design
// handoff screen-bundle-1.jsx:1283, ValueRealizationScreen). Genuinely new
// sub-domain — no backing model existed anywhere before this file (see
// docs/superpowers/plans/2026-07-23-PROGRAM-cosmos-remaining-work.md §2).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";
import { ValueMetricStatus } from "./value-realization.constants";

export type ValueRealizationView = {
  id: string;
  epicId: string;
  epicTitle: string;
  metricLabel: string;
  unit: string | null;
  plannedValue: number;
  actualValue: number | null;
  status: string;
  measuredAt: string | null;
};

export async function listValueRealizations(): Promise<
  Result<ValueRealizationView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.epicValueMetric.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        epicId: true,
        metricLabel: true,
        unit: true,
        plannedValue: true,
        actualValue: true,
        status: true,
        measuredAt: true,
      },
    });
    if (rows.length === 0) {
      return [];
    }

    const epicIds = [...new Set(rows.map((r) => r.epicId))];
    const epics = await database.epic.findMany({
      where: { id: { in: epicIds }, tenantId: ctx.tenantId },
      select: { id: true, title: true },
    });
    const epicTitleById = new Map(epics.map((e) => [e.id, e.title]));

    return rows.map((r) => ({
      id: r.id,
      epicId: r.epicId,
      epicTitle: epicTitleById.get(r.epicId) ?? r.epicId,
      metricLabel: r.metricLabel,
      unit: r.unit,
      plannedValue: r.plannedValue,
      actualValue: r.actualValue,
      status: r.status,
      measuredAt: r.measuredAt ? r.measuredAt.toISOString() : null,
    }));
  });
}

const CreateValueMetricSchema = z.object({
  epicId: z.string().min(1),
  metricLabel: z.string().min(1).max(200),
  unit: z.string().max(20).optional(),
  plannedValue: z.number().finite(),
  actualValue: z.number().finite().optional(),
  status: ValueMetricStatus.default("pending"),
  measuredAt: z.coerce.date().optional(),
});

export async function createValueMetric(
  input: z.input<typeof CreateValueMetricSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    // Same ownership tier as LeanBudget/InvestmentHorizon in horizons.ts —
    // ADMIN owns the platform, STE owns business outcomes/value realization
    // for the portfolio.
    requireRole(["ADMIN", "STE"], ctx);
    const {
      epicId,
      metricLabel,
      unit,
      plannedValue,
      actualValue,
      status,
      measuredAt,
    } = CreateValueMetricSchema.parse(input);

    // Cross-tenant IDOR guard — client-supplied epicId must belong to this tenant.
    const epic = await database.epic.findFirst({
      where: { id: epicId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!epic) {
      throw new Error("Epic inválido.");
    }

    const created = await database.epicValueMetric.create({
      data: {
        tenantId: ctx.tenantId,
        epicId,
        metricLabel,
        unit: unit ?? null,
        plannedValue,
        actualValue: actualValue ?? null,
        status,
        measuredAt: measuredAt ?? null,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "EpicValueMetric",
      entityId: created.id,
      diff: { epicId, metricLabel, plannedValue },
    });
    revalidateTag(`value-realization:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

const RecordActualValueSchema = z.object({
  id: z.string().min(1),
  actualValue: z.number().finite(),
  status: ValueMetricStatus,
  measuredAt: z.coerce.date().optional(),
});

// Records the realized outcome for an already-created metric (the LPM
// coming back after measuring real results). No epicId is accepted here —
// only the metric's own id, tenant-scoped via updateMany — so there is no
// client-suppliable FK to IDOR-guard beyond the tenant check itself.
export async function recordActualValue(
  input: z.input<typeof RecordActualValueSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { id, actualValue, status, measuredAt } =
      RecordActualValueSchema.parse(input);

    const { count } = await database.epicValueMetric.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: { actualValue, status, measuredAt: measuredAt ?? new Date() },
    });
    if (count === 0) {
      throw new Error("Métrica de valor não encontrada.");
    }

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "EpicValueMetric",
      entityId: id,
      diff: { actualValue, status },
    });
    revalidateTag(`value-realization:${ctx.tenantId}`, "max");
    return { id };
  });
}
