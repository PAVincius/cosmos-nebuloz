"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit";

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

const RISK_LEVELS = ["low", "medium", "high"] as const;

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
