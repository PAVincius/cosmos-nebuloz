"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type RiskView = {
  id: string;
  title: string;
  roamStatus: string;
  severity: number;
  probability: string;
  impact: string;
  category: string;
  ownerName: string;
};

export async function listRisks(): Promise<Result<RiskView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.risk.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { severity: "desc" },
      select: {
        id: true,
        title: true,
        roamStatus: true,
        severity: true,
        probability: true,
        impact: true,
        category: true,
        ownerUserId: true,
      },
    });

    const ownerIds = [
      ...new Set(
        rows.map((r) => r.ownerUserId).filter((id): id is string => !!id)
      ),
    ];
    const owners = ownerIds.length
      ? await database.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true },
        })
      : [];
    const ownerNameById = new Map(owners.map((o) => [o.id, o.name]));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      roamStatus: r.roamStatus,
      severity: r.severity,
      probability: r.probability,
      impact: r.impact,
      category: r.category ?? "OUTRO",
      ownerName: (r.ownerUserId && ownerNameById.get(r.ownerUserId)) || "—",
    }));
  });
}

const RISK_CATEGORIES = [
  "TECHNICAL",
  "BUSINESS",
  "DEPENDENCY",
  "EXTERNAL",
  "COMPLIANCE",
  "CAPACITY",
  "IMPEDIMENT",
] as const;

// Vocabulário de probabilidade/impacto (story-059 AC-004). As colunas são
// String livre no Prisma, então os cinco níveis cabem sem migration e os
// valores já gravados (low/medium/high) seguem válidos — o vocabulário estende
// o anterior nas duas pontas, não o substitui.
const RISK_LEVELS = ["very_low", "low", "medium", "high", "very_high"] as const;

const CreateRiskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(RISK_CATEGORIES).optional(),
  severity: z.number().int().min(1).max(5).default(3),
  probability: z.enum(RISK_LEVELS).default("medium"),
  impact: z.enum(RISK_LEVELS).default("medium"),
});

export async function createRisk(
  input: z.input<typeof CreateRiskSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO", "SM"], ctx);
    const { title, description, category, severity, probability, impact } =
      CreateRiskSchema.parse(input);

    const created = await database.risk.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        description: description ?? null,
        category: category ?? null,
        severity,
        probability,
        impact,
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "risk",
      entityId: created.id,
      diff: { title },
    });
    revalidateTag(`risks:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

// ── ROAM (story-059 AC-001/AC-002/AC-003) ────────────────────────────────────

// UNCLASSIFIED não é destino: é o estado de nascimento. O gate de commitment do
// PI (story-019 AC-003) recusa PI com risco UNCLASSIFIED, então permitir a volta
// seria oferecer um caminho para esvaziar o gate depois do commitment. A 019 só
// descreve transições PARA os quatro desfechos.
const ROAM_OUTCOMES = ["RESOLVED", "OWNED", "ACCEPTED", "MITIGATED"] as const;

const MIN_MITIGATION_PLAN_LENGTH = 30;

const RoamTransitionSchema = z.object({
  riskId: z.string().min(1),
  roamStatus: z.enum(ROAM_OUTCOMES),
  ownerUserId: z.string().min(1).optional(),
  mitigationPlan: z.string().max(2000).optional(),
  resolutionNote: z.string().max(2000).optional(),
});

type RoamTransitionInput = z.infer<typeof RoamTransitionSchema>;

// Guards da story-019 AC-002. Desfecho ROAM não é rótulo: OWNED sem dono é
// promessa sem responsável, MITIGATED sem plano é plano imaginário, RESOLVED
// sem nota é afirmação sem prova.
function roamGuard(input: RoamTransitionInput): string | null {
  if (input.roamStatus === "OWNED" && !input.ownerUserId) {
    return "ownerRequired";
  }
  if (
    input.roamStatus === "MITIGATED" &&
    (input.mitigationPlan?.trim().length ?? 0) < MIN_MITIGATION_PLAN_LENGTH
  ) {
    return "mitigationPlanRequired";
  }
  if (input.roamStatus === "RESOLVED" && !input.resolutionNote?.trim()) {
    return "resolutionNoteRequired";
  }
  return null;
}

export async function roamTransition(
  input: z.input<typeof RoamTransitionSchema>
): Promise<Result<{ id: string; roamStatus: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    // Registrar risco é de qualquer um na sessão (ADMIN|RTE|PO|SM em
    // createRisk); classificar é do facilitador — PRD-v1.0 UC-03 passo 4 põe a
    // confirmação final do roamStatus na mão do RTE.
    requireRole(["ADMIN", "RTE"], ctx);
    const parsed = RoamTransitionSchema.parse(input);

    const guard = roamGuard(parsed);
    if (guard) {
      throw new Error(`ROAM_GUARD:${guard}`);
    }

    // Reconferência de posse dentro do tenant — id vindo do cliente nunca é
    // usado direto na escrita. O roamStatus anterior sai daqui: é o que a
    // trilha de auditoria precisa registrar.
    const existing = await database.risk.findFirst({
      where: { id: parsed.riskId, tenantId: ctx.tenantId },
      select: { id: true, roamStatus: true },
    });
    if (!existing) {
      throw new Error("Risco não encontrado.");
    }

    const now = new Date();
    await database.risk.update({
      where: { id: existing.id },
      data: {
        roamStatus: parsed.roamStatus,
        // Risk.status é a coluna legada de desfecho que arts/pi-plans e os
        // exports ainda leem. Escrever só roamStatus deixaria duas verdades
        // sobre o mesmo risco; unificar as duas exige migration (lacuna no nó).
        status: parsed.roamStatus,
        ...(parsed.ownerUserId ? { ownerUserId: parsed.ownerUserId } : {}),
        ...(parsed.roamStatus === "OWNED" ? { ownedAt: now } : {}),
        ...(parsed.mitigationPlan
          ? { mitigationPlan: parsed.mitigationPlan.trim() }
          : {}),
        ...(parsed.resolutionNote
          ? { resolutionNote: parsed.resolutionNote.trim() }
          : {}),
        ...(parsed.roamStatus === "RESOLVED" ? { resolvedAt: now } : {}),
      },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "status_changed",
      entityType: "risk",
      entityId: existing.id,
      diff: { roamStatus: `${existing.roamStatus}→${parsed.roamStatus}` },
    });
    revalidateTag(`risks:${ctx.tenantId}`, "max");
    return { id: existing.id, roamStatus: parsed.roamStatus };
  });
}
