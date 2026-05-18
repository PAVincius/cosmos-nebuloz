"use server";

import {
  type Result,
  safeAction,
} from "@/app/actions/_base";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import type { AuditLog, Epic, KeyResult, OKR, StrategicTheme } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/app/actions/audit";
import {
  CreateKeyResultSchema,
  CreateThemeOkrSchema,
  CreateThemeSchema,
  ChangeStatusSchema,
  LinkArtSchema,
  ThemeFiltersSchema,
  UpdateKeyResultSchema,
  UpdateThemeOkrSchema,
  UpdateThemeSchema,
  canTransition,
  type EpicForTheme,
  type StrategicThemeDetail,
  type StrategicThemeWithCount,
  type ThemeListItem,
  type ThemeStatusType,
} from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revalidateThemePaths(id?: string): void {
  revalidatePath("/portfolio/themes");
  revalidatePath("/portfolio");
  if (id) revalidatePath(`/portfolio/themes/${id}`);
}

function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k in input) if (input[k] !== undefined) out[k] = input[k];
  return out;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listStrategicThemes(
  raw?: unknown,
): Promise<Result<StrategicThemeWithCount[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const f = ThemeFiltersSchema.parse(raw ?? {});

    return database.strategicTheme.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(f.status      ? { status: f.status }            : {}),
        ...(f.themeType   ? { themeType: f.themeType }      : {}),
        ...(f.ownerUserId ? { ownerUserId: f.ownerUserId }  : {}),
        ...(f.horizon     ? { horizon: f.horizon }          : {}),
        ...(f.search
          ? {
              OR: [
                { title:       { contains: f.search, mode: "insensitive" as const } },
                { description: { contains: f.search, mode: "insensitive" as const } },
                { code:        { contains: f.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { epics: true, okrs: true } } },
      orderBy: { order: "asc" },
    });
  });
}

export async function getStrategicThemeById(
  id: string,
): Promise<Result<StrategicThemeDetail>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const theme = await database.strategicTheme.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        epics: true,
        okrs: {
          include: {
            keyResults:   { orderBy: { createdAt: "asc" } },
            linkedRisks:  { include: { risk: true }, orderBy: { createdAt: "desc" } },
          },
          orderBy: { createdAt: "asc" },
        },
        arts: { include: { art: true } },
      },
    });

    if (!theme) throw new Error("Tema estratégico não encontrado.");
    return theme;
  });
}

export type AuditLogWithUser = AuditLog & {
  user: { id: string; name: string | null; image: string | null } | null;
};

export async function listThemeAuditHistory(themeId: string): Promise<Result<AuditLogWithUser[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const logs = await database.auditLog.findMany({
      where: {
        tenantId:   ctx.tenantId,
        entityType: "StrategicTheme",
        entityId:   themeId,
      },
      orderBy: { createdAt: "desc" },
      take:    100,
    });

    const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => id !== null))];
    const users = userIds.length > 0
      ? await database.user.findMany({
          where:  { id: { in: userIds } },
          select: { id: true, name: true, image: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return logs.map((log) => ({
      ...log,
      user: log.userId ? (userMap.get(log.userId) ?? null) : null,
    }));
  });
}

// ─── Theme Mutations ─────────────────────────────────────────────────────────

export async function createStrategicTheme(raw: unknown): Promise<Result<StrategicTheme>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = CreateThemeSchema.parse(raw);

    const theme = await database.strategicTheme.create({
      data: {
        tenantId:    ctx.tenantId,
        title:       input.title,
        description: input.description ?? null,
        code:        input.code ?? null,
        color:       input.color,
        order:       input.order,
        horizon:     input.horizon ?? null,
        themeType:   input.themeType ?? null,
        ownerUserId: input.ownerUserId ?? null,
        budgetTotal: input.budgetTotal ?? null,
        status:      "DRAFT",
      },
    });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "created",
      entityType: "StrategicTheme",
      entityId:   theme.id,
      diff:       { title: theme.title, status: theme.status },
    });

    revalidateThemePaths(theme.id);
    return theme;
  });
}

export async function updateStrategicTheme(
  id: string,
  raw: unknown,
): Promise<Result<StrategicTheme>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = UpdateThemeSchema.parse(raw);

    const current = await database.strategicTheme.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!current) throw new Error("Tema não encontrado ou sem permissão.");

    const data = pickDefined({
      title:       input.title,
      description: input.description === undefined ? undefined : (input.description ?? null),
      code:        input.code === undefined ? undefined : (input.code ?? null),
      color:       input.color,
      order:       input.order,
      horizon:     input.horizon === undefined ? undefined : (input.horizon ?? null),
      themeType:   input.themeType === undefined ? undefined : (input.themeType ?? null),
      ownerUserId: input.ownerUserId === undefined ? undefined : (input.ownerUserId ?? null),
      budgetTotal: input.budgetTotal === undefined ? undefined : (input.budgetTotal ?? null),
    });

    const updated = await database.strategicTheme.update({
      where: { id },
      data,
    });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "updated",
      entityType: "StrategicTheme",
      entityId:   id,
      diff:       Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")])),
    });

    revalidateThemePaths(id);
    return updated;
  });
}

export async function updateThemeStatus(
  id: string,
  raw: unknown,
): Promise<Result<StrategicTheme>> {
  return safeAction(async () => {
    const ctx     = await requireTenantSession(await headers());
    const { status: next } = ChangeStatusSchema.parse(raw);

    const current = await database.strategicTheme.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!current) throw new Error("Tema não encontrado ou sem permissão.");

    const from = current.status as ThemeStatusType;
    if (from === next) return current;

    if (!canTransition(from, next)) {
      throw new Error(`Transição inválida: ${from} → ${next}.`);
    }

    const updated = await database.strategicTheme.update({
      where: { id },
      data:  { status: next },
    });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "status_changed",
      entityType: "StrategicTheme",
      entityId:   id,
      diff:       { from, to: next },
    });

    revalidateThemePaths(id);
    return updated;
  });
}

export async function deleteStrategicTheme(id: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const theme = await database.strategicTheme.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!theme) throw new Error("Tema não encontrado ou sem permissão.");

    await database.epic.updateMany({
      where: { tenantId: ctx.tenantId, strategicThemeId: id },
      data:  { strategicThemeId: null },
    });

    await database.strategicTheme.delete({ where: { id } });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "deleted",
      entityType: "StrategicTheme",
      entityId:   id,
      diff:       { title: theme.title },
    });

    revalidateThemePaths(id);
    return { id };
  });
}

export async function linkEpicToTheme(
  epicId: string,
  themeId: string | null,
): Promise<Result<Epic>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: epicId, tenantId: ctx.tenantId },
    });
    if (!epic) throw new Error("Épico não encontrado ou sem permissão.");

    if (themeId !== null) {
      const theme = await database.strategicTheme.findFirst({
        where: { id: themeId, tenantId: ctx.tenantId },
      });
      if (!theme) throw new Error("Tema estratégico não encontrado ou sem permissão.");
    }

    const updated = await database.epic.update({
      where: { id: epicId },
      data:  { strategicThemeId: themeId },
    });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "epic_linked",
      entityType: "StrategicTheme",
      entityId:   themeId ?? epic.strategicThemeId ?? epicId,
      diff:       { epicId, from: epic.strategicThemeId ?? "", to: themeId ?? "" },
    });

    revalidateThemePaths(themeId ?? undefined);
    return updated;
  });
}

export async function reorderThemes(orderedIds: string[]): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    await database.$transaction(
      orderedIds.map((id, index) =>
        database.strategicTheme.updateMany({
          where: { id, tenantId: ctx.tenantId },
          data:  { order: index },
        }),
      ),
    );

    revalidateThemePaths();
  });
}

// ─── ART association ─────────────────────────────────────────────────────────

export async function linkArtToTheme(themeId: string, raw: unknown): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx        = await requireTenantSession(await headers());
    const { artId }  = LinkArtSchema.parse(raw);

    const [theme, art] = await Promise.all([
      database.strategicTheme.findFirst({ where: { id: themeId, tenantId: ctx.tenantId } }),
      database.aRT.findFirst({           where: { id: artId,   tenantId: ctx.tenantId } }),
    ]);
    if (!theme) throw new Error("Tema não encontrado.");
    if (!art)   throw new Error("ART não encontrada.");

    await database.themeART.upsert({
      where:  { themeId_artId: { themeId, artId } },
      update: {},
      create: { themeId, artId },
    });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "art_linked",
      entityType: "StrategicTheme",
      entityId:   themeId,
      diff:       { artId },
    });

    revalidateThemePaths(themeId);
  });
}

export async function unlinkArtFromTheme(themeId: string, raw: unknown): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx       = await requireTenantSession(await headers());
    const { artId } = LinkArtSchema.parse(raw);

    const theme = await database.strategicTheme.findFirst({
      where: { id: themeId, tenantId: ctx.tenantId },
    });
    if (!theme) throw new Error("Tema não encontrado.");

    await database.themeART.deleteMany({ where: { themeId, artId } });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "art_unlinked",
      entityType: "StrategicTheme",
      entityId:   themeId,
      diff:       { artId },
    });

    revalidateThemePaths(themeId);
  });
}

// ─── OKR + KR ────────────────────────────────────────────────────────────────

export async function createThemeOkr(
  themeId: string,
  raw: unknown,
): Promise<Result<OKR>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = CreateThemeOkrSchema.parse(raw);

    const theme = await database.strategicTheme.findFirst({
      where: { id: themeId, tenantId: ctx.tenantId },
    });
    if (!theme) throw new Error("Tema não encontrado.");

    const okr = await database.oKR.create({
      data: {
        tenantId:         ctx.tenantId,
        type:             "portfolio_theme",
        strategicThemeId: themeId,
        title:            input.title,
        description:      input.description ?? null,
        ownerId:          input.ownerId ?? null,
        horizon:          input.horizon ?? null,
      },
    });

    await logAudit(ctx.tenantId, {
      userId:     ctx.userId,
      action:     "okr_created",
      entityType: "StrategicTheme",
      entityId:   themeId,
      diff:       { okrId: okr.id, title: okr.title },
    });

    revalidateThemePaths(themeId);
    return okr;
  });
}

export async function updateThemeOkr(
  okrId: string,
  raw: unknown,
): Promise<Result<OKR>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = UpdateThemeOkrSchema.parse(raw);

    const current = await database.oKR.findFirst({
      where: { id: okrId, tenantId: ctx.tenantId },
    });
    if (!current) throw new Error("OKR não encontrado.");

    const data = pickDefined({
      title:       input.title,
      description: input.description === undefined ? undefined : (input.description ?? null),
      ownerId:     input.ownerId === undefined ? undefined : (input.ownerId ?? null),
      horizon:     input.horizon === undefined ? undefined : (input.horizon ?? null),
      status:      input.status,
    });

    const updated = await database.oKR.update({ where: { id: okrId }, data });

    if (current.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "okr_updated",
        entityType: "StrategicTheme",
        entityId:   current.strategicThemeId,
        diff:       { okrId, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")])) },
      });
      revalidateThemePaths(current.strategicThemeId);
    }

    return updated;
  });
}

export async function deleteThemeOkr(okrId: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const okr = await database.oKR.findFirst({
      where: { id: okrId, tenantId: ctx.tenantId },
    });
    if (!okr) throw new Error("OKR não encontrado.");

    await database.oKR.delete({ where: { id: okrId } });

    if (okr.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "okr_deleted",
        entityType: "StrategicTheme",
        entityId:   okr.strategicThemeId,
        diff:       { okrId, title: okr.title },
      });
      revalidateThemePaths(okr.strategicThemeId);
    }

    return { id: okrId };
  });
}

export async function createKeyResult(raw: unknown): Promise<Result<KeyResult>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = CreateKeyResultSchema.parse(raw);

    const okr = await database.oKR.findFirst({
      where: { id: input.okrId, tenantId: ctx.tenantId },
    });
    if (!okr) throw new Error("OKR não encontrado.");

    const kr = await database.keyResult.create({
      data: {
        tenantId:        ctx.tenantId,
        okrId:           input.okrId,
        title:           input.title,
        metric:          input.metric ?? null,
        baseline:        input.baseline ?? null,
        current:         input.current,
        target:          input.target,
        unit:            input.unit,
        measurementType: input.measurementType ?? null,
        dueDate:         input.dueDate ?? null,
        ownerId:         input.ownerId ?? null,
        dataSource:      input.dataSource ?? null,
      },
    });

    if (okr.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "kr_created",
        entityType: "StrategicTheme",
        entityId:   okr.strategicThemeId,
        diff:       { krId: kr.id, title: kr.title, target: String(kr.target) },
      });
      revalidateThemePaths(okr.strategicThemeId);
    }

    return kr;
  });
}

export async function updateKeyResult(
  krId: string,
  raw: unknown,
): Promise<Result<KeyResult>> {
  return safeAction(async () => {
    const ctx   = await requireTenantSession(await headers());
    const input = UpdateKeyResultSchema.parse(raw);

    const current = await database.keyResult.findFirst({
      where: { id: krId, tenantId: ctx.tenantId },
      include: { okr: { select: { strategicThemeId: true } } },
    });
    if (!current) throw new Error("Key Result não encontrado.");

    const data = pickDefined({
      title:           input.title,
      metric:          input.metric === undefined ? undefined : (input.metric ?? null),
      baseline:        input.baseline === undefined ? undefined : (input.baseline ?? null),
      current:         input.current,
      target:          input.target,
      unit:            input.unit,
      measurementType: input.measurementType === undefined ? undefined : (input.measurementType ?? null),
      dueDate:         input.dueDate === undefined ? undefined : (input.dueDate ?? null),
      ownerId:         input.ownerId === undefined ? undefined : (input.ownerId ?? null),
      dataSource:      input.dataSource === undefined ? undefined : (input.dataSource ?? null),
    });

    const updated = await database.keyResult.update({ where: { id: krId }, data });

    if (current.okr.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "kr_updated",
        entityType: "StrategicTheme",
        entityId:   current.okr.strategicThemeId,
        diff:       { krId, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")])) },
      });
      revalidateThemePaths(current.okr.strategicThemeId);
    }

    return updated;
  });
}

export async function deleteKeyResult(krId: string): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const kr = await database.keyResult.findFirst({
      where: { id: krId, tenantId: ctx.tenantId },
      include: { okr: { select: { strategicThemeId: true } } },
    });
    if (!kr) throw new Error("Key Result não encontrado.");

    await database.keyResult.delete({ where: { id: krId } });

    if (kr.okr.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "kr_deleted",
        entityType: "StrategicTheme",
        entityId:   kr.okr.strategicThemeId,
        diff:       { krId, title: kr.title },
      });
      revalidateThemePaths(kr.okr.strategicThemeId);
    }

    return { id: krId };
  });
}

// ─── ROAM Risk ↔ OKR ─────────────────────────────────────────────────────────

export async function linkRiskToOkr(
  okrId: string,
  riskId: string,
  impact?: string,
  notes?: string,
): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const [okr, risk] = await Promise.all([
      database.oKR.findFirst({ where: { id: okrId, tenantId: ctx.tenantId } }),
      database.risk.findFirst({ where: { id: riskId, tenantId: ctx.tenantId } }),
    ]);
    if (!okr)  throw new Error("OKR não encontrado.");
    if (!risk) throw new Error("Risco não encontrado.");

    await database.riskOKR.upsert({
      where:  { riskId_okrId: { riskId, okrId } },
      update: { impact: impact ?? "medium", notes: notes ?? null },
      create: { riskId, okrId, impact: impact ?? "medium", notes: notes ?? null },
    });

    if (okr.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "risk_linked",
        entityType: "StrategicTheme",
        entityId:   okr.strategicThemeId,
        diff:       { okrId, riskId, impact: impact ?? "medium" },
      });
      revalidateThemePaths(okr.strategicThemeId);
    }
  });
}

export async function unlinkRiskFromOkr(okrId: string, riskId: string): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const okr = await database.oKR.findFirst({ where: { id: okrId, tenantId: ctx.tenantId } });
    if (!okr) throw new Error("OKR não encontrado.");

    await database.riskOKR.deleteMany({ where: { riskId, okrId } });

    if (okr.strategicThemeId) {
      await logAudit(ctx.tenantId, {
        userId:     ctx.userId,
        action:     "risk_unlinked",
        entityType: "StrategicTheme",
        entityId:   okr.strategicThemeId,
        diff:       { okrId, riskId },
      });
      revalidateThemePaths(okr.strategicThemeId);
    }
  });
}

/** List all Risks for the current tenant (for UI selectors) */
export async function listTenantRisks(): Promise<Result<{ id: string; title: string; status: string; impact: string; piPlanId: string | null }[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.risk.findMany({
      where:   { tenantId: ctx.tenantId },
      select:  { id: true, title: true, status: true, impact: true, piPlanId: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  });
}

// ─── Backward-compatible helpers (used by existing UI) ───────────────────────

/** Flat list shape consumed by themes-board.tsx */
export async function getStrategicThemes(): Promise<ThemeListItem[]> {
  const result = await listStrategicThemes();
  if (!result.ok) throw new Error(result.error);
  return result.data.map((t) => ({
    id:          t.id,
    code:        t.code,
    title:       t.title,
    description: t.description,
    color:       t.color,
    order:       t.order,
    status:      t.status,
    horizon:     t.horizon,
    themeType:   t.themeType,
    ownerUserId: t.ownerUserId,
    epicCount:   t._count.epics,
    okrCount:    t._count.okrs,
  }));
}

export async function getAllEpics(): Promise<EpicForTheme[]> {
  const ctx = await requireTenantSession(await headers());
  return database.epic.findMany({
    where:   { tenantId: ctx.tenantId },
    select:  { id: true, title: true, statusId: true, strategicThemeId: true },
    orderBy: [{ statusId: "asc" }, { order: "asc" }],
  });
}

