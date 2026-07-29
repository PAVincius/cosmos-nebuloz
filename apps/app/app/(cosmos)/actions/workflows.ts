"use server";

// workflows.ts — Workflows screen (no-code automation list), wired to the
// existing BpmnDefinition model (planning.prisma). triggerLabel/actionCount/
// runCount/active are the exact fields the schema comment calls out as
// "Layout denorm — cosmos.html screen-workflows list cards". No new model.
//
// This is a thin (cosmos)/actions home, not apps/app/app/actions/workflow/ —
// that module (transition.ts) is the state-machine *execution* engine
// (compiles+runs an active BpmnDefinition against a Story/Feature); listing
// and toggling definitions for the screen is a different concern and matches
// the established (cosmos)/actions shape used by decisions.ts/themes.ts/
// governance.ts (safeAction + requireTenantSession for reads, +requireRole/
// logAudit/revalidateTag for the one mutation).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type WorkflowView = {
  id: string;
  name: string;
  entityType: string;
  ownerType: string;
  ownerId: string;
  triggerLabel: string | null;
  actionCount: number;
  runCount: number;
  active: boolean;
  activatedAt: string | null;
};

export async function listWorkflows(): Promise<Result<WorkflowView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.bpmnDefinition.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ active: "desc" }, { runCount: "desc" }],
      select: {
        id: true,
        name: true,
        entityType: true,
        ownerType: true,
        ownerId: true,
        triggerLabel: true,
        actionCount: true,
        runCount: true,
        active: true,
        activatedAt: true,
      },
    });
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      entityType: w.entityType,
      ownerType: w.ownerType,
      ownerId: w.ownerId,
      triggerLabel: w.triggerLabel,
      actionCount: w.actionCount,
      runCount: w.runCount,
      active: w.active,
      activatedAt: w.activatedAt?.toISOString() ?? null,
    }));
  });
}

const ToggleWorkflowActiveSchema = z.object({
  id: z.string().cuid(),
  active: z.boolean(),
});

export async function toggleWorkflowActive(
  input: z.input<typeof ToggleWorkflowActiveSchema>
): Promise<Result<{ id: string; active: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "STE"], ctx);
    const { id, active } = ToggleWorkflowActiveSchema.parse(input);

    const existing = await database.bpmnDefinition.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Workflow não encontrado.");
    }

    const updated = await database.bpmnDefinition.update({
      where: { id },
      data: active
        ? { active: true, activatedAt: new Date(), activatedBy: ctx.userId }
        : { active: false },
      select: { id: true, active: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "bpmn_definition",
      entityId: updated.id,
      diff: { active },
    });
    revalidateTag(`workflows:${ctx.tenantId}`, "max");
    return { id: updated.id, active: updated.active };
  });
}
