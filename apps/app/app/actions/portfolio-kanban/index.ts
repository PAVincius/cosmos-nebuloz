"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { type Result, safeAction } from "../_base";
import {
  DEFAULT_PORTFOLIO_COLUMNS,
  KanbanConfigSchema,
  UpdateColumnColorSchema,
  UpdateColumnLabelSchema,
  type KanbanColumnConfig,
  type KanbanConfig,
} from "./schema";

const METADATA_KEY = "portfolioKanban";

type TenantMetadata = {
  [METADATA_KEY]?: KanbanConfig;
  [k: string]: unknown;
};

function mergeWithDefaults(stored?: KanbanColumnConfig[]): KanbanColumnConfig[] {
  if (!stored || stored.length === 0) return DEFAULT_PORTFOLIO_COLUMNS;
  const byId = new Map(stored.map((c) => [c.id, c]));
  return DEFAULT_PORTFOLIO_COLUMNS.map((d) => byId.get(d.id) ?? d);
}

export async function getPortfolioKanbanConfig(): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const tenant = await database.tenant.findFirst({
      where:  { id: ctx.tenantId },
      select: { metadata: true },
    });

    const meta = (tenant?.metadata as TenantMetadata | null) ?? {};
    const stored = meta[METADATA_KEY];
    const parsed = stored ? KanbanConfigSchema.safeParse(stored) : null;
    const columns = parsed?.success
      ? mergeWithDefaults(parsed.data.columns)
      : DEFAULT_PORTFOLIO_COLUMNS;

    return { columns };
  });
}

async function persistConfig(
  tenantId: string,
  next: KanbanConfig,
): Promise<KanbanConfig> {
  const tenant = await database.tenant.findFirstOrThrow({
    where:  { id: tenantId },
    select: { metadata: true },
  });
  const current = (tenant.metadata as TenantMetadata | null) ?? {};
  const merged: TenantMetadata = { ...current, [METADATA_KEY]: next };

  await database.tenant.update({
    where: { id: tenantId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data:  { metadata: merged as any },
  });

  revalidatePath("/portfolio");
  revalidatePath("/dashboard/portfolio");
  return next;
}

export async function updateColumnColor(raw: unknown): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const { columnId, color } = UpdateColumnColorSchema.parse(raw);

    const existing = await getPortfolioKanbanConfig();
    if (!existing.ok) throw new Error(existing.error);

    const next: KanbanConfig = {
      columns: existing.data.columns.map((c) =>
        c.id === columnId ? { ...c, color } : c,
      ),
    };

    return persistConfig(ctx.tenantId, next);
  });
}

export async function updateColumnLabel(raw: unknown): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const { columnId, label } = UpdateColumnLabelSchema.parse(raw);

    const existing = await getPortfolioKanbanConfig();
    if (!existing.ok) throw new Error(existing.error);

    const next: KanbanConfig = {
      columns: existing.data.columns.map((c) =>
        c.id === columnId ? { ...c, label } : c,
      ),
    };

    return persistConfig(ctx.tenantId, next);
  });
}

export async function resetKanbanColumns(): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    return persistConfig(ctx.tenantId, { columns: DEFAULT_PORTFOLIO_COLUMNS });
  });
}

export async function getViewerRole(): Promise<Result<string>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return ctx.role;
  });
}
