"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type OkrView = {
  id: string;
  title: string;
  status: string;
  ownerName: string;
  keyResults: {
    id: string;
    title: string;
    current: number;
    target: number;
    unit: string;
    progressPct: number;
  }[];
};

export async function listOkrs(): Promise<Result<OkrView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.oKR.findMany({
      where: { tenantId: ctx.tenantId, archivedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        ownerId: true,
        keyResults: {
          select: {
            id: true,
            title: true,
            current: true,
            target: true,
            unit: true,
          },
        },
      },
    });

    const ownerIds = [
      ...new Set(rows.map((r) => r.ownerId).filter((id): id is string => !!id)),
    ];
    const owners = ownerIds.length
      ? await database.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
      : [];
    const ownerNameById = new Map(owners.map((o) => [o.id, o.name]));

    return rows.map((okr) => ({
      id: okr.id,
      title: okr.title,
      status: okr.status,
      ownerName: (okr.ownerId && ownerNameById.get(okr.ownerId)) || "—",
      keyResults: okr.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        current: kr.current,
        target: kr.target,
        unit: kr.unit,
        progressPct:
          kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0,
      })),
    }));
  });
}
