"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

export type GovernedEpicView = {
  id: string;
  epicTitle: string;
  governanceStatus: string;
  investmentEstimate: number | null;
  submittedAt: string | null;
};

export async function listGovernedEpics(): Promise<Result<GovernedEpicView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.governedEpic.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        governanceStatus: true,
        investmentEstimate: true,
        submittedAt: true,
        epic: { select: { title: true } },
      },
    });
    return rows.map((g) => ({
      id: g.id,
      epicTitle: g.epic.title,
      governanceStatus: g.governanceStatus,
      investmentEstimate: g.investmentEstimate,
      submittedAt: g.submittedAt?.toISOString() ?? null,
    }));
  });
}

// ─── Gate policy (ApprovalWorkflow) ────────────────────────────────────────────
// The "gate policy" concept (RF §2.18) is modeled by the existing
// ApprovalWorkflow model (governance.prisma) — nome = gate name, etapas =
// ordered approval steps, tipo = category (one policy per tipo per tenant,
// enforced by @@unique([tenantId, tipo])). No new model, no migration.

const MEMBER_ROLES = [
  "ADMIN",
  "STE",
  "RTE",
  "SM",
  "PO",
  "DEV",
  "MEMBER",
] as const;

const GateStepSchema = z.object({
  order: z.number().int().nonnegative(),
  roleRequired: z.enum(MEMBER_ROLES),
  slaDays: z.number().int().nonnegative().optional(),
});

const UpsertApprovalWorkflowSchema = z.object({
  tipo: z.enum([
    "epic_investment",
    "budget_guardrail_change",
    "theme_creation",
  ]),
  nome: z.string().min(1).max(200),
  etapas: z.array(GateStepSchema).min(1),
  ativo: z.boolean().default(true),
});

export async function upsertApprovalWorkflow(
  input: z.input<typeof UpsertApprovalWorkflowSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { tipo, nome, etapas, ativo } =
      UpsertApprovalWorkflowSchema.parse(input);

    const existing = await database.approvalWorkflow.findFirst({
      where: { tenantId: ctx.tenantId, tipo },
      select: { id: true },
    });

    const saved = await database.approvalWorkflow.upsert({
      where: { tenantId_tipo: { tenantId: ctx.tenantId, tipo } },
      create: { tenantId: ctx.tenantId, tipo, nome, etapas, ativo },
      update: { nome, etapas, ativo },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: existing ? "updated" : "created",
      entityType: "approval_workflow",
      entityId: saved.id,
      diff: { tipo, nome, ativo },
    });
    revalidateTag(`governance:${ctx.tenantId}`, "max");
    return { id: saved.id };
  });
}
