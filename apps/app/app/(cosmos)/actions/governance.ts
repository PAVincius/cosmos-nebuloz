"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

// Compact per-row gate-stage step summary — mirrors the estado shape read
// by getApprovalRequest (apps/app/app/actions/governance), just the fields
// the dot indicator needs. Sourced from the ApprovalRequest matching
// currentApprovalRequestId, joined in the single listGovernedEpics query
// below (no per-row refetch).
export type GovernanceGateStepView = {
  etapaOrdem: number;
  roleRequired: string;
  estado: string;
};

export type GovernedEpicView = {
  id: string;
  epicId: string;
  epicTitle: string;
  governanceStatus: string;
  investmentEstimate: number | null;
  submittedAt: string | null;
  currentApprovalRequestId: string | null;
  gateSteps: GovernanceGateStepView[];
};

export type GovernanceKpis = {
  totalUnderGovernance: number;
  awaitingDecision: number;
  investmentInReview: number;
};

export type ListGovernedEpicsResult = {
  epics: GovernedEpicView[];
  kpis: GovernanceKpis;
};

export async function listGovernedEpics(): Promise<
  Result<ListGovernedEpicsResult>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.governedEpic.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        epicId: true,
        governanceStatus: true,
        investmentEstimate: true,
        submittedAt: true,
        currentApprovalRequestId: true,
        epic: { select: { title: true } },
        // Tenant-scoped even though it's already a child of the
        // tenant-scoped GovernedEpic above (defense in depth). One join,
        // not N+1 — Prisma batches this across all rows in the findMany.
        approvalRequests: {
          where: { tenantId: ctx.tenantId },
          select: {
            id: true,
            steps: {
              select: { etapaOrdem: true, roleRequired: true, estado: true },
              orderBy: { etapaOrdem: "asc" },
            },
          },
        },
      },
    });

    const epics = rows.map((g) => {
      const currentRequest = g.approvalRequests.find(
        (r) => r.id === g.currentApprovalRequestId
      );
      return {
        id: g.id,
        epicId: g.epicId,
        epicTitle: g.epic.title,
        governanceStatus: g.governanceStatus,
        investmentEstimate: g.investmentEstimate,
        submittedAt: g.submittedAt?.toISOString() ?? null,
        currentApprovalRequestId: g.currentApprovalRequestId,
        gateSteps: currentRequest?.steps ?? [],
      };
    });

    // "Tempo médio no gate" (handoff's 4th KPI) is deliberately NOT
    // computed: GovernedEpic.submittedAt is selected/read everywhere in
    // this codebase but never written by any action (grepped the whole
    // app — submitEpicForApproval, reviewStep, bypassApproval all leave it
    // null). A submittedAt → decision diff would average over nulls, which
    // is fabrication dressed as a metric. Omitted, not faked.
    const kpis: GovernanceKpis = {
      totalUnderGovernance: epics.length,
      awaitingDecision: epics.filter((e) => e.governanceStatus === "review")
        .length,
      investmentInReview: epics
        .filter((e) => e.governanceStatus === "review")
        .reduce((sum, e) => sum + (e.investmentEstimate ?? 0), 0),
    };

    return { epics, kpis };
  });
}

// ─── Per-epic Gate Detail (RF §2.18) ───────────────────────────────────────────
// Thin read composing GovernedEpic + its Epic for the gate detail screen.
// The approval steps themselves (role/SLA/state) are loaded client-side via
// the existing getApprovalRequest (apps/app/app/actions/governance) — no
// duplication of that query here.

export type GovernedEpicDetail = {
  id: string;
  epicId: string;
  epicTitle: string;
  epicLifecycleStatus: string;
  governanceStatus: string;
  investmentEstimate: number | null;
  valueStreamId: string | null;
  themeId: string | null;
  guardrailFlags: string[];
  currentApprovalRequestId: string | null;
  submittedAt: string | null;
};

export async function getGovernedEpicDetail(
  epicId: string
): Promise<Result<GovernedEpicDetail | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const ge = await database.governedEpic.findFirst({
      where: { epicId, tenantId: ctx.tenantId },
      select: {
        id: true,
        epicId: true,
        governanceStatus: true,
        investmentEstimate: true,
        valueStreamId: true,
        themeId: true,
        guardrailFlags: true,
        currentApprovalRequestId: true,
        submittedAt: true,
        epic: { select: { title: true, lifecycleStatus: true } },
      },
    });
    if (!ge) {
      return null;
    }
    return {
      id: ge.id,
      epicId: ge.epicId,
      epicTitle: ge.epic.title,
      epicLifecycleStatus: ge.epic.lifecycleStatus,
      governanceStatus: ge.governanceStatus,
      investmentEstimate: ge.investmentEstimate,
      valueStreamId: ge.valueStreamId,
      themeId: ge.themeId,
      guardrailFlags: Array.isArray(ge.guardrailFlags)
        ? (ge.guardrailFlags as string[])
        : [],
      currentApprovalRequestId: ge.currentApprovalRequestId,
      submittedAt: ge.submittedAt?.toISOString() ?? null,
    };
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
