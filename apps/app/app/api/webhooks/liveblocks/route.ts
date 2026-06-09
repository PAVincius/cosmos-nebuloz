// Story-031: Liveblocks storageUpdated webhook → dual-write to Prisma

import { WebhookHandler } from "@liveblocks/node";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

type AssignmentValue = {
  teamId: string;
  sprintId: string;
  rank?: number;
  updatedBy?: string;
};

type StorageData = {
  assignments?: Record<string, AssignmentValue>;
};

// AC-005: dual-write within 500ms — parse room context from storageUpdated event
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.LIVEBLOCKS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = await req.text();
  const webhookHandler = new WebhookHandler(secret);

  let event: ReturnType<typeof webhookHandler.verifyRequest>;
  try {
    event = webhookHandler.verifyRequest({
      headers: Object.fromEntries(req.headers.entries()),
      rawBody,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "storageUpdated") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const roomId = event.data.roomId as string;
  // room format: {tenantId}:pi-planning-board:{piPlanId}
  const parts = roomId.split(":");
  if (parts.length !== 3 || parts[1] !== "pi-planning-board") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const tenantId = parts[0] ?? "";
  const piPlanId = parts[2] ?? "";

  const storageData = event.data.storage as StorageData | undefined;
  const assignments = storageData?.assignments ?? {};

  await syncAssignments(tenantId, piPlanId, assignments);

  return NextResponse.json({ ok: true });
}

async function syncAssignments(
  tenantId: string,
  piPlanId: string,
  assignments: Record<string, AssignmentValue>
): Promise<void> {
  for (const [featureId, value] of Object.entries(assignments)) {
    if (!(value.teamId && value.sprintId)) {
      continue;
    }

    try {
      await database.pIPlanFeatureAssignment.upsert({
        where: { piPlanId_featureId: { piPlanId, featureId } },
        create: {
          tenantId,
          piPlanId,
          featureId,
          teamId: value.teamId,
          sprintId: value.sprintId,
          rank: value.rank ?? 0,
          updatedBy: value.updatedBy ?? null,
        },
        update: {
          teamId: value.teamId,
          sprintId: value.sprintId,
          rank: value.rank ?? 0,
          updatedBy: value.updatedBy ?? null,
        },
      });
    } catch (err) {
      log.error(
        `[webhook/liveblocks] upsert failed feature=${featureId} piPlan=${piPlanId}`,
        err
      );
    }
  }
}
