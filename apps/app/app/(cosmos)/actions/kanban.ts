"use server";

// kanban.ts — server actions for the Kanban de Épicos board, wired to the real
// multi-tenant Epic model. Every call is tenant-scoped; writes are RBAC-gated,
// audited, and invalidate the per-tenant board cache. The board renders from the
// denormalized read columns on Epic (one indexed query, no per-card joins).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database, type Prisma } from "@repo/database";
import { revalidateTag, unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";
import { portfolioEpicsCacheTag } from "../../actions/epics/portfolio-cache";

// ── column ↔ SAFe lifecycle mapping ──
const COLUMN_TO_LIFECYCLE = {
  funnel: "FUNNEL",
  analyzing: "ANALYZING",
  backlog: "PORTFOLIO_BACKLOG",
  implementing: "IMPLEMENTING",
  done: "DONE",
} as const;
type BoardColumn = keyof typeof COLUMN_TO_LIFECYCLE;
const LIFECYCLE_TO_COLUMN: Record<string, BoardColumn> = Object.fromEntries(
  Object.entries(COLUMN_TO_LIFECYCLE).map(([c, l]) => [l, c as BoardColumn])
) as Record<string, BoardColumn>;

export type KanbanEpic = {
  id: string;
  title: string;
  column: BoardColumn;
  theme: string | null;
  art: string | null;
  artTone: string;
  owner: string;
  wsjf: number;
  size: number;
  progress: number;
  hot: boolean;
};

const EPIC_SELECT = {
  id: true,
  title: true,
  lifecycleStatus: true,
  lifecycleOrder: true,
  wsjf: true,
  sizePoints: true,
  hot: true,
  ownerName: true,
  artId: true,
  artTone: true,
  featureCount: true,
  doneFeatureCount: true,
  strategicTheme: { select: { title: true } },
} satisfies Prisma.EpicSelect;

type EpicRow = Prisma.EpicGetPayload<{ select: typeof EPIC_SELECT }>;

function toKanbanEpic(row: EpicRow): KanbanEpic {
  return {
    id: row.id,
    title: row.title,
    column: LIFECYCLE_TO_COLUMN[row.lifecycleStatus] ?? "funnel",
    theme: row.strategicTheme?.title ?? null,
    art: row.artId,
    artTone: row.artTone ?? "accent",
    owner: row.ownerName ?? "",
    wsjf: row.wsjf ?? 0,
    size: row.sizePoints ?? 0,
    progress:
      row.featureCount > 0
        ? Math.round((row.doneFeatureCount / row.featureCount) * 100)
        : 0,
    hot: row.hot,
  };
}

// Cache keyed by tenant — headers are read outside the cache (dynamic), the query
// inside is cached and invalidated by revalidateTag('epics:<tenantId>').
const cachedEpics = (tenantId: string) =>
  unstable_cache(
    async () => {
      const rows = await database.epic.findMany({
        where: { tenantId, lifecycleStatus: { not: "REJECTED" } },
        orderBy: [{ lifecycleStatus: "asc" }, { lifecycleOrder: "asc" }],
        select: EPIC_SELECT,
      });
      return rows.map(toKanbanEpic);
    },
    ["kanban-epics", tenantId],
    { tags: [portfolioEpicsCacheTag(tenantId)] }
  )();

export async function listEpics(): Promise<Result<KanbanEpic[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return cachedEpics(ctx.tenantId);
  });
}

const MoveEpicSchema = z.object({
  id: z.string().min(1),
  column: z.enum(["funnel", "analyzing", "backlog", "implementing", "done"]),
  order: z.number().int().min(0),
});

export async function moveEpic(
  input: z.infer<typeof MoveEpicSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { id, column, order } = MoveEpicSchema.parse(input);

    // ownership re-check by tenant — never trust the client id
    const existing = await database.epic.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, lifecycleStatus: true },
    });
    if (!existing) {
      throw new Error("Épico não encontrado.");
    }

    const lifecycleStatus = COLUMN_TO_LIFECYCLE[column];
    await database.epic.update({
      where: { id },
      // DB column is lifecycleOrder — see art-core.prisma / H1 fix commit
      // body for why this is deliberately not the legacy `order` field.
      data: { lifecycleStatus, lifecycleOrder: order },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "epic",
      entityId: id,
      diff: {
        lifecycleStatus: `${existing.lifecycleStatus}→${lifecycleStatus}`,
        order: String(order),
      },
    });
    revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
    return { id };
  });
}

const CreateEpicSchema = z.object({
  title: z.string().min(1).max(200),
  column: z
    .enum(["funnel", "analyzing", "backlog", "implementing", "done"])
    .default("funnel"),
  strategicThemeId: z.string().optional(),
  hypothesis: z.string().max(2000).optional(),
  // WSJF quick-create inputs — component scores, not a rollup. `js` is a
  // divisor and must never be 0. No `score`/`wsjf` key: the value the client
  // sees is always recomputed here, never trusted from the request.
  bv: z.number().min(0).max(10).optional(),
  tc: z.number().min(0).max(10).optional(),
  rr: z.number().min(0).max(10).optional(),
  js: z.number().min(1).max(10).optional(),
});

// Unweighted (bv+tc+rr)/js, matching Epic.wsjf's existing rollup semantics —
// see commit body for the divergence from Task 16's tenant-weighted Feature
// scoring in app/actions/wsjf/score.ts. Only computed when all four inputs
// are present; a partial set of sliders must never produce a partial score.
function computeEpicWsjf(input: {
  bv?: number;
  tc?: number;
  rr?: number;
  js?: number;
}): number | null {
  const { bv, tc, rr, js } = input;
  if (
    bv === undefined ||
    tc === undefined ||
    rr === undefined ||
    js === undefined
  ) {
    return null;
  }
  return Math.round(((bv + tc + rr) / js) * 100) / 100;
}

export async function createEpic(
  input: z.infer<typeof CreateEpicSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { title, column, strategicThemeId, hypothesis, bv, tc, rr, js } =
      CreateEpicSchema.parse(input);

    // Cross-tenant IDOR guard — a client-supplied FK must belong to this tenant.
    if (strategicThemeId) {
      const theme = await database.strategicTheme.findFirst({
        where: { id: strategicThemeId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!theme) {
        throw new Error("Tema estratégico inválido.");
      }
    }

    const wsjf = computeEpicWsjf({ bv, tc, rr, js });

    const created = await database.epic.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        lifecycleStatus: COLUMN_TO_LIFECYCLE[column],
        strategicThemeId: strategicThemeId ?? null,
        hypothesis: hypothesis ?? null,
        wsjf,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "epic",
      entityId: created.id,
      diff: {
        title,
        lifecycleStatus: COLUMN_TO_LIFECYCLE[column],
        ...(wsjf !== null ? { wsjf: String(wsjf) } : {}),
      },
    });
    revalidateTag(portfolioEpicsCacheTag(ctx.tenantId), "max");
    return { id: created.id };
  });
}
