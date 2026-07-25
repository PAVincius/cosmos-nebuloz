"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { transitionEpicStatus } from "@/app/actions/epics/transition-status";
import { type Result, safeAction } from "../_base";
import {
  DEFAULT_PORTFOLIO_COLUMNS,
  type KanbanColumnConfig,
  type KanbanConfig,
  KanbanConfigSchema,
  MoveEpicSchema,
  UpdateColumnColorSchema,
  UpdateColumnLabelSchema,
  UpdateWipLimitSchema,
} from "./schema";

const METADATA_KEY = "portfolioKanban";

type TenantMetadata = {
  [METADATA_KEY]?: KanbanConfig;
  [k: string]: unknown;
};

function mergeWithDefaults(
  stored?: KanbanColumnConfig[]
): KanbanColumnConfig[] {
  if (!stored || stored.length === 0) {
    return DEFAULT_PORTFOLIO_COLUMNS;
  }
  const byId = new Map(stored.map((c) => [c.id, c]));
  return DEFAULT_PORTFOLIO_COLUMNS.map((d) => byId.get(d.id) ?? d);
}

async function loadKanbanConfig(tenantId: string): Promise<KanbanConfig> {
  const tenant = await database.tenant.findFirst({
    where: { id: tenantId },
    select: { metadata: true },
  });
  const meta = (tenant?.metadata as TenantMetadata | null) ?? {};
  const stored = meta[METADATA_KEY];
  const parsed = stored ? KanbanConfigSchema.safeParse(stored) : null;
  return {
    columns: parsed?.success
      ? mergeWithDefaults(parsed.data.columns)
      : DEFAULT_PORTFOLIO_COLUMNS,
  };
}

export async function getPortfolioKanbanConfig(): Promise<
  Result<KanbanConfig>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return loadKanbanConfig(ctx.tenantId);
  });
}

async function persistConfig(
  tenantId: string,
  next: KanbanConfig
): Promise<KanbanConfig> {
  const tenant = await database.tenant.findFirstOrThrow({
    where: { id: tenantId },
    select: { metadata: true },
  });
  const current = (tenant.metadata as TenantMetadata | null) ?? {};
  const merged: TenantMetadata = { ...current, [METADATA_KEY]: next };

  await database.tenant.update({
    where: { id: tenantId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { metadata: merged as any },
  });

  revalidatePath("/portfolio");
  revalidatePath("/dashboard/portfolio");
  return next;
}

// Roles that can override WIP limits
const WIP_OVERRIDE_ROLES = new Set(["ADMIN", "STE", "RTE", "PO", "SM"]);

// Maps lifecycle column → state machine event
const COLUMN_TO_TRANSITION_EVENT: Record<string, string> = {
  ANALYZING: "ANALYZE",
  PORTFOLIO_BACKLOG: "MOVE_TO_BACKLOG",
  IMPLEMENTING: "START_IMPLEMENTING",
  DONE: "COMPLETE",
  REJECTED: "REJECT",
};

export async function moveEpicAction(
  raw: unknown
): Promise<Result<{ epicId: string; fromColumn: string; toColumn: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = MoveEpicSchema.parse(raw);

    const transitionEvent = COLUMN_TO_TRANSITION_EVENT[input.toColumn];
    if (!transitionEvent) {
      throw new Error("INVALID_TARGET_COLUMN");
    }

    if (input.toColumn === "REJECTED" && !input.reason) {
      throw new Error("REJECTION_REASON_REQUIRED");
    }

    // Server-side WIP check
    const config = await loadKanbanConfig(ctx.tenantId);
    const targetCol = config.columns.find((c) => c.id === input.toColumn);
    if (targetCol?.wipLimit) {
      const count = await database.epic.count({
        where: { tenantId: ctx.tenantId, lifecycleStatus: input.toColumn },
      });
      if (count >= targetCol.wipLimit) {
        if (!WIP_OVERRIDE_ROLES.has(ctx.role)) {
          throw new Error("WIP_LIMIT_EXCEEDED");
        }
        if (!input.wipOverrideReason) {
          throw new Error("WIP_OVERRIDE_REASON_REQUIRED");
        }
        await database.decisionLogEntry.create({
          data: {
            tenantId: ctx.tenantId,
            tipo: "epic_decision",
            targetType: "epic",
            targetId: input.epicId,
            decisao: "wip_override",
            justificativa: input.wipOverrideReason,
            dadosSuporte: {
              toColumn: input.toColumn,
              wipLimit: targetCol.wipLimit,
              currentCount: count,
            },
            decisorId: ctx.userId,
          },
        });
      }
    }

    const result = await transitionEpicStatus({
      epicId: input.epicId,
      event: transitionEvent,
      reason: input.reason,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data as unknown as {
      epicId: string;
      fromColumn: string;
      toColumn: string;
    };
  });
}

export async function updateWipLimitAction(
  raw: unknown
): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE", "RTE"], ctx);

    const { columnId, wipLimit } = UpdateWipLimitSchema.parse(raw);
    const config = await loadKanbanConfig(ctx.tenantId);

    const next: KanbanConfig = {
      columns: config.columns.map((c) =>
        c.id === columnId
          ? wipLimit === null
            ? { ...c, wipLimit: undefined }
            : { ...c, wipLimit }
          : c
      ),
    };

    return persistConfig(ctx.tenantId, next);
  });
}

export async function updateColumnColor(
  raw: unknown
): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const { columnId, color } = UpdateColumnColorSchema.parse(raw);
    const config = await loadKanbanConfig(ctx.tenantId);

    const next: KanbanConfig = {
      columns: config.columns.map((c) =>
        c.id === columnId ? { ...c, color } : c
      ),
    };

    return persistConfig(ctx.tenantId, next);
  });
}

export async function updateColumnLabel(
  raw: unknown
): Promise<Result<KanbanConfig>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const { columnId, label } = UpdateColumnLabelSchema.parse(raw);
    const config = await loadKanbanConfig(ctx.tenantId);

    const next: KanbanConfig = {
      columns: config.columns.map((c) =>
        c.id === columnId ? { ...c, label } : c
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
