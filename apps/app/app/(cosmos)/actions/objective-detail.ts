"use server";

// objective-detail.ts — ObjectiveDetailScreen (okr route) composition layer.
// The OKR/KeyResult data itself comes straight from the tables the mature
// app/actions/okrs layer already writes (getOKRById, updateOKR,
// createKeyResult, updateKeyResult, createKeyResultCheckIn) — this file only
// composes a single read shaped for the screen: the objective, its Key
// Results, and the owner's display name.
//
// "Why" note: the design handoff (screen-bundle-3.jsx KrEditRow, ~L536-704)
// wants a persistent, freely-editable per-KR explanation of its current
// status (`k.why`). KeyResult itself has no such column, but
// KeyResultSnapshot.note — written by the existing createKeyResultCheckIn
// check-in action — already models "commentary attached to the KR's
// current status": a check-in is a (value, note) pair. We surface the most
// recent snapshot's note as the "why" text below, and the client posts a
// new check-in with the SAME current value when only the explanation
// changes (a legitimate no-op-value check-in, not a workaround). This
// reuses `note` instead of adding a `whyNote` column + migration for a
// field that would just duplicate what a check-in already records.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type ObjectiveDetailKeyResult = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  progressPct: number;
  whyNote: string | null;
};

export type ObjectiveDetailFull = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  keyResults: ObjectiveDetailKeyResult[];
};

export async function getObjectiveDetail(
  id: string
): Promise<Result<ObjectiveDetailFull | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const okr = await database.oKR.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        ownerId: true,
        keyResults: {
          select: {
            id: true,
            title: true,
            current: true,
            target: true,
            unit: true,
            snapshots: {
              orderBy: { recordedAt: "desc" },
              take: 1,
              select: { note: true },
            },
          },
        },
      },
    });
    if (!okr) {
      return null;
    }

    const owner = okr.ownerId
      ? await database.user.findFirst({
          where: { id: okr.ownerId },
          select: { name: true },
        })
      : null;

    return {
      id: okr.id,
      title: okr.title,
      description: okr.description,
      status: okr.status,
      ownerId: okr.ownerId,
      ownerName: owner?.name ?? null,
      keyResults: okr.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        current: kr.current,
        target: kr.target,
        unit: kr.unit,
        progressPct:
          kr.target > 0
            ? Math.min(100, Math.round((kr.current / kr.target) * 100))
            : 0,
        whyNote: kr.snapshots[0]?.note ?? null,
      })),
    };
  });
}
