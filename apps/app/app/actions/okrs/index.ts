"use server";

import {
  type Result,
  type Page,
  safeAction,
  OKRStatus,
  paginationArgs,
  buildPage,
} from "@/app/actions/_base";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import type { OKR } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enforce } from "../permissions";
import {
  CreateOKRSchema,
  UpdateOKRSchema,
  OKRFiltersSchema,
  CreateKeyResultSchema,
  UpdateKeyResultSchema,
  UpdateKeyResultProgressSchema,
  CreateCheckInSchema,
  type OKRStatus as OKRStatusType,
  type CreateOKRInput,
  type UpdateOKRInput,
  type OKRFiltersInput,
  type CreateKeyResultInput,
  type UpdateKeyResultInput,
  type KeyResultWithProgress,
  type OKRWithProgress,
  type OKRWithContext,
  type KeyResultSnapshotItem,
} from "./schema";

export type {
  OKRStatusType as OKRStatus,
  CreateOKRInput, UpdateOKRInput, OKRFiltersInput,
  CreateKeyResultInput, UpdateKeyResultInput,
  KeyResultWithProgress, OKRWithProgress, OKRWithContext, KeyResultSnapshotItem,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcProgress(keyResults: KeyResultWithProgress[]): number {
  if (keyResults.length === 0) return 0;
  const avg =
    keyResults.reduce((s, kr) => s + Math.min(kr.current / (kr.target || 1), 1), 0) /
    keyResults.length;
  return Math.round(avg * 100);
}

function toOKRWithProgress(okr: OKR & { keyResults: { id: string; title: string; current: number; target: number; unit: string; okrId?: string; tenantId?: string; createdAt?: Date; updatedAt?: Date }[] }): OKRWithProgress {
  const keyResults: KeyResultWithProgress[] = okr.keyResults.map((kr) => ({
    ...kr,
    progress: kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0,
  }));
  return { ...okr, keyResults, progress: calcProgress(keyResults) };
}

// ─── OKR Queries ─────────────────────────────────────────────────────────────

export async function listOKRs(raw?: unknown): Promise<Result<Page<OKRWithProgress>>> {
  return safeAction(async () => {
    const ctx    = await requireTenantSession(await headers());
    const input  = OKRFiltersSchema.parse(raw ?? {});
    const { page, limit, piPlanId, status } = input;

    const where = {
      tenantId: ctx.tenantId,
      ...(piPlanId !== undefined && { piPlanId }),
      ...(status   !== undefined && { status }),
    };

    const [total, okrs] = await Promise.all([
      database.oKR.count({ where }),
      database.oKR.findMany({
        where,
        include: { keyResults: true },
        orderBy: { createdAt: "asc" },
        ...paginationArgs(page, limit),
      }),
    ]);

    return buildPage(okrs.map(toOKRWithProgress), total, page, limit);
  });
}

export async function getOKRById(id: string): Promise<Result<OKRWithProgress>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const okr = await database.oKR.findFirst({
      where:   { id, tenantId: ctx.tenantId },
      include: { keyResults: true },
    });

    if (!okr) throw new Error("OKR não encontrado.");
    return toOKRWithProgress(okr);
  });
}

// ─── OKR Mutations ───────────────────────────────────────────────────────────

export async function createOKR(raw: unknown): Promise<Result<OKR>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    enforce(ctx.role, "OKR", "create");
    const input = CreateOKRSchema.parse(raw);

    const okr = await database.oKR.create({
      data: {
        tenantId:    ctx.tenantId,
        title:       input.title,
        description: input.description ?? null,
        piPlanId:    input.piPlanId    ?? null,
        ownerId:     input.ownerId     ?? null,
        status:      input.status,
      },
    });

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return okr;
  });
}

export async function updateOKR(id: string, raw: unknown): Promise<Result<OKR>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    enforce(ctx.role, "OKR", "update");
    const input = UpdateOKRSchema.parse(raw);

    const { count } = await database.oKR.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.title       !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.piPlanId    !== undefined && { piPlanId: input.piPlanId ?? null }),
        ...(input.ownerId     !== undefined && { ownerId: input.ownerId ?? null }),
        ...(input.status      !== undefined && { status: input.status }),
      },
    });

    if (count === 0) throw new Error("OKR não encontrado ou sem permissão.");

    const updated = await database.oKR.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return updated;
  });
}

export async function updateOKRStatus(id: string, status: string): Promise<Result<OKR>> {
  return safeAction(async () => {
    const ctx           = await requireTenantSession(await headers());
    enforce(ctx.role, "OKR", "update");
    const { status: s } = z.object({ status: OKRStatus }).parse({ status });

    const { count } = await database.oKR.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data:  { status: s },
    });

    if (count === 0) throw new Error("OKR não encontrado ou sem permissão.");

    const updated = await database.oKR.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return updated;
  });
}

export async function deleteOKR(id: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "OKR", "delete");

    // Cascade delete keyResults scoped by tenant
    await database.keyResult.deleteMany({
      where: { tenantId: ctx.tenantId, okrId: id },
    });

    const { count } = await database.oKR.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });

    if (count === 0) throw new Error("OKR não encontrado ou sem permissão.");

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return { id };
  });
}

// ─── Key Result Mutations ─────────────────────────────────────────────────────

export async function createKeyResult(raw: unknown): Promise<Result<KeyResultWithProgress>>;
export async function createKeyResult(okrId: string, input: { title: string; current: number; target: number; unit: string }): Promise<Result<KeyResultWithProgress>>;
export async function createKeyResult(
  rawOrOkrId: unknown,
  legacyInput?: { title: string; current: number; target: number; unit: string },
): Promise<Result<KeyResultWithProgress>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    enforce(ctx.role, "KeyResult", "create");

    let parsed: z.infer<typeof CreateKeyResultSchema>;
    if (typeof rawOrOkrId === "string" && legacyInput) {
      // Legacy 2-arg call: createKeyResult(okrId, { title, current, target, unit })
      parsed = CreateKeyResultSchema.parse({ okrId: rawOrOkrId, ...legacyInput });
    } else {
      parsed = CreateKeyResultSchema.parse(rawOrOkrId);
    }

    // Verify OKR belongs to tenant
    const okr = await database.oKR.findFirst({
      where: { id: parsed.okrId, tenantId: ctx.tenantId },
    });
    if (!okr) throw new Error("OKR não encontrado ou sem permissão.");

    const kr = await database.keyResult.create({
      data: {
        tenantId: ctx.tenantId,
        okrId:    parsed.okrId,
        title:    parsed.title,
        current:  parsed.current,
        target:   parsed.target,
        unit:     parsed.unit,
      },
    });

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return {
      ...kr,
      progress: kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0,
    };
  });
}

export async function updateKeyResult(id: string, raw: unknown): Promise<Result<KeyResultWithProgress>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    enforce(ctx.role, "KeyResult", "update");
    const input = UpdateKeyResultSchema.parse(raw);

    const { count } = await database.keyResult.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data: {
        ...(input.title   !== undefined && { title: input.title }),
        ...(input.current !== undefined && { current: input.current }),
        ...(input.target  !== undefined && { target: input.target }),
        ...(input.unit    !== undefined && { unit: input.unit }),
      },
    });

    if (count === 0) throw new Error("Key Result não encontrado ou sem permissão.");

    const updated = await database.keyResult.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return {
      ...updated,
      progress: updated.target > 0 ? Math.min(100, Math.round((updated.current / updated.target) * 100)) : 0,
    };
  });
}

export async function updateKeyResultProgress(id: string, raw: unknown): Promise<Result<KeyResultWithProgress>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    enforce(ctx.role, "KeyResult", "update");
    const input = UpdateKeyResultProgressSchema.parse(raw);

    const { count } = await database.keyResult.updateMany({
      where: { id, tenantId: ctx.tenantId },
      data:  { current: input.current },
    });

    if (count === 0) throw new Error("Key Result não encontrado ou sem permissão.");

    const updated = await database.keyResult.findFirstOrThrow({
      where: { id, tenantId: ctx.tenantId },
    });

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return {
      ...updated,
      progress: updated.target > 0 ? Math.min(100, Math.round((updated.current / updated.target) * 100)) : 0,
    };
  });
}

export async function deleteKeyResult(id: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const { count } = await database.keyResult.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });

    if (count === 0) throw new Error("Key Result não encontrado ou sem permissão.");

    revalidatePath("/portfolio/okrs");
    revalidatePath("/portfolio");
    return { id };
  });
}

// ─── Context-enriched query (inclui tema estratégico + snapshots) ────────────

export async function getOKRsWithContext(piPlanId?: string): Promise<OKRWithContext[]> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const where = {
      tenantId: ctx.tenantId,
      ...(piPlanId ? { piPlanId } : {}),
    };

    const okrs = await database.oKR.findMany({
      where,
      include: {
        keyResults: {
          include: { snapshots: { orderBy: { recordedAt: "desc" }, take: 8 } },
        },
        strategicTheme: { select: { id: true, title: true, color: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return okrs.map((okr) => {
      const keyResults: KeyResultWithProgress[] = okr.keyResults.map((kr) => ({
        ...kr,
        progress: kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0,
        snapshots: kr.snapshots.map((s) => ({
          id: s.id, keyResultId: s.keyResultId,
          value: s.value, note: s.note,
          recordedAt: s.recordedAt,
        })),
      }));
      return {
        ...okr,
        keyResults,
        progress: calcProgress(keyResults),
        themeTitle: okr.strategicTheme?.title ?? null,
        themeColor: okr.strategicTheme?.color ?? null,
      } as OKRWithContext;
    });
  }).then((r) => {
    if (!r.ok) throw new Error(r.error);
    return r.data;
  });
}

// ─── Check-in (snapshot de progresso de KR) ──────────────────────────────────

export async function createKeyResultCheckIn(raw: unknown): Promise<Result<KeyResultSnapshotItem>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    enforce(ctx.role, "KeyResult", "update");
    const input = CreateCheckInSchema.parse(raw);

    // Verificar que KR pertence ao tenant
    const kr = await database.keyResult.findFirst({
      where: { id: input.keyResultId, tenantId: ctx.tenantId },
    });
    if (!kr) throw new Error("Key Result não encontrado.");

    const [snapshot] = await Promise.all([
      database.keyResultSnapshot.create({
        data: {
          tenantId:     ctx.tenantId,
          keyResultId:  input.keyResultId,
          value:        input.value,
          note:         input.note ?? null,
          recordedById: ctx.userId,
        },
      }),
      database.keyResult.update({
        where: { id: input.keyResultId },
        data:  { current: input.value },
      }),
    ]);

    revalidatePath("/portfolio/okrs");
    return { id: snapshot.id, keyResultId: snapshot.keyResultId, value: snapshot.value, note: snapshot.note, recordedAt: snapshot.recordedAt };
  });
}

// ─── OKR Traceability Tree ────────────────────────────────────────────────────

export type OKRTraceabilityNode = {
  okrId:       string;
  okrTitle:    string;
  okrStatus:   string;
  themeTitle:  string | null;
  themeColor:  string | null;
  epicId:      string | null;
  epicTitle:   string | null;
  epicStatus:  string | null;
  featureCount: number;
  featureDone:  number;
  progress:    number;
};

export async function getOKRTraceability(): Promise<OKRTraceabilityNode[]> {
  const ctx = await requireTenantSession(await headers());

  const okrs = await database.oKR.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      strategicTheme: { select: { title: true, color: true } },
      keyResults: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const epicIds = okrs.map((o) => o.epicId).filter(Boolean) as string[];
  const epics = epicIds.length > 0
    ? await database.epic.findMany({
        where: { id: { in: epicIds }, tenantId: ctx.tenantId },
        include: {
          features: { select: { id: true, statusId: true } },
        },
      })
    : [];

  const epicMap = new Map(epics.map((e) => [e.id, e]));

  return okrs.map((okr) => {
    const krs  = okr.keyResults;
    const prog = krs.length > 0
      ? Math.round(krs.reduce((s, kr) => s + (kr.target > 0 ? Math.min(100, (kr.current / kr.target) * 100) : 0), 0) / krs.length)
      : 0;

    const epic = okr.epicId ? epicMap.get(okr.epicId) : null;
    const features = epic?.features ?? [];
    const DONE_STATUSES = new Set(["done", "DONE", "completed", "COMPLETED"]);
    const done = features.filter((f) => DONE_STATUSES.has(f.statusId)).length;

    return {
      okrId:        okr.id,
      okrTitle:     okr.title,
      okrStatus:    okr.status,
      themeTitle:   okr.strategicTheme?.title ?? null,
      themeColor:   okr.strategicTheme?.color ?? null,
      epicId:       okr.epicId,
      epicTitle:    epic?.title ?? null,
      epicStatus:   epic?.statusId ?? null,
      featureCount: features.length,
      featureDone:  done,
      progress:     prog,
    };
  });
}

// ─── Backward-compatible helpers (for existing UI components) ─────────────────

/** @deprecated use listOKRs */
export async function getOKRs(piPlanId?: string): Promise<OKRWithProgress[]> {
  const result = await listOKRs(piPlanId ? { piPlanId, page: 1, limit: 100 } : { page: 1, limit: 100 });
  if (!result.ok) throw new Error(result.error);
  return result.data.items;
}
