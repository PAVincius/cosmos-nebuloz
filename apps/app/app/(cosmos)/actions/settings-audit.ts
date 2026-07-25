"use server";

// settings-audit.ts — Auditoria tab (Settings screen, tab 4). Wraps the
// mature app/actions/audit/index.ts::listAuditLogs, which is already
// tenant-scoped (`where: { tenantId: ctx.tenantId }`) and paginated —
// capped here at 25/page so the tab never pulls an unbounded log. The
// AuditLog model only stores `userId` (nullable), not an actor name, so
// this also fetches the real tenant member list and joins by userId to
// show a name instead of a raw id — still real data, no fabrication; a
// userId with no matching member (removed since) falls back to the raw id.
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { listAuditLogs } from "../../actions/audit";
import { getTenantMembersForSearch } from "../../actions/teams/members";

const PAGE_SIZE = 25;

export type AuditLogRow = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};

export type AuditTabView = {
  items: AuditLogRow[];
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export async function getAuditTab(page = 1): Promise<Result<AuditTabView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const [logsResult, members] = await Promise.all([
      listAuditLogs({ page, limit: PAGE_SIZE }),
      getTenantMembersForSearch(),
    ]);

    if (!logsResult.ok) {
      throw new Error(logsResult.error);
    }

    const nameByUserId = new Map(members.map((m) => [m.userId, m.name]));

    return {
      items: logsResult.data.items.map((log) => ({
        id: log.id,
        actorName: log.userId
          ? (nameByUserId.get(log.userId) ?? log.userId)
          : "Sistema",
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: new Date(log.createdAt).toISOString(),
      })),
      page: logsResult.data.meta.page,
      hasNext: logsResult.data.meta.hasNext,
      hasPrev: logsResult.data.meta.hasPrev,
    };
  });
}
