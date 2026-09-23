"use server";

import { type CharterDataClass, withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  GovernanceError,
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import { caseRisk, SEM_PONTUACAO } from "@/lib/charter/rules";
import { type Result, safeAction } from "../../actions/_base";
import { logCharterAudit, nextCode } from "./_shared";

// Matriz de risco — FR-7. Heatmap 5×5, distribuição por categoria e mitigações.

export type HeatCell = {
  severity: number;
  likelihood: number;
  count: number;
  codes: string[];
};

export type MitigationRow = {
  id: string;
  code: string;
  useCaseCode: string;
  useCaseTitle: string;
  category: string;
  action: string;
  ownerName: string | null;
  dueDate: string | null;
  status: string;
  overdue: boolean;
};

export type RiskBoard = {
  /** 25 células, sempre — célula vazia também é informação. */
  heatmap: HeatCell[];
  categories: { id: string; total: number; max: number }[];
  mitigations: MitigationRow[];
  /** Todos os casos ativos; sem pontuação, os números são null e o caso fica
   *  fora do heatmap e da exposição por categoria. */
  cases: {
    code: string;
    title: string;
    dataClass: CharterDataClass;
    severity: number | null;
    likelihood: number | null;
    score: number | null;
    label: string;
    tone: string;
    status: string;
  }[];
};

export async function getRiskBoard(): Promise<Result<RiskBoard>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const cases = await db.charterUseCase.findMany({
        where: {
          tenantId: ctx.tenantId,
          // Arquivado sai da matriz: risco de caso encerrado não compete por
          // atenção com risco vivo.
          status: { not: "ARCHIVED" },
        },
        select: {
          code: true,
          title: true,
          status: true,
          dataClass: true,
          riskPrivacy: true,
          riskRegulatory: true,
          riskSecurity: true,
          riskBias: true,
          riskIp: true,
          riskOperational: true,
          riskReputational: true,
          riskScoredAt: true,
        },
      });

      const rows = cases.map((c) => {
        const risks = {
          privacy: c.riskPrivacy,
          regulatory: c.riskRegulatory,
          security: c.riskSecurity,
          bias: c.riskBias,
          ip: c.riskIp,
          operational: c.riskOperational,
          reputational: c.riskReputational,
        };
        return { ...c, risks, r: caseRisk(risks, c.riskScoredAt) };
      });
      // Heatmap e exposição por categoria só com risco que alguém avaliou: o
      // default 1 do intake cairia na célula 1×1 como "Baixo" medido.
      const scored = rows.flatMap((c) => (c.r ? [{ ...c, ...c.r }] : []));

      const heatmap: HeatCell[] = [];
      for (let sev = 5; sev >= 1; sev--) {
        for (let like = 1; like <= 5; like++) {
          const hits = scored.filter(
            (s) => s.severity === sev && s.likelihood === like
          );
          heatmap.push({
            severity: sev,
            likelihood: like,
            count: hits.length,
            codes: hits.map((h) => h.code),
          });
        }
      }

      const CATEGORY_KEYS = [
        "PRIVACY",
        "REGULATORY",
        "SECURITY",
        "BIAS",
        "IP",
        "OPERATIONAL",
        "REPUTATIONAL",
      ] as const;
      const FIELD: Record<
        (typeof CATEGORY_KEYS)[number],
        keyof (typeof scored)[0]["risks"]
      > = {
        PRIVACY: "privacy",
        REGULATORY: "regulatory",
        SECURITY: "security",
        BIAS: "bias",
        IP: "ip",
        OPERATIONAL: "operational",
        REPUTATIONAL: "reputational",
      };

      const categories = CATEGORY_KEYS.map((id) => {
        const values = scored.map((s) => s.risks[FIELD[id]]);
        return {
          id,
          total: values.reduce((a, b) => a + b, 0),
          max: values.length ? Math.max(...values) : 0,
        };
      });

      const mitigations = await db.charterMitigation.findMany({
        where: { tenantId: ctx.tenantId },
        include: { useCase: { select: { code: true, title: true } } },
        orderBy: [{ dueDate: "asc" }],
      });
      const now = Date.now();

      return {
        heatmap,
        categories,
        cases: rows.map((s) => ({
          code: s.code,
          title: s.title,
          dataClass: s.dataClass,
          severity: s.r?.severity ?? null,
          likelihood: s.r?.likelihood ?? null,
          score: s.r?.score ?? null,
          label: s.r?.label ?? SEM_PONTUACAO,
          tone: s.r?.tone ?? "accent",
          status: s.status,
        })),
        mitigations: mitigations
          .map((m) => ({
            id: m.id,
            code: m.code,
            useCaseCode: m.useCase.code,
            useCaseTitle: m.useCase.title,
            category: m.category,
            action: m.action,
            ownerName: m.ownerName,
            dueDate: m.dueDate?.toISOString() ?? null,
            status: m.status,
            overdue:
              m.status !== "DONE" &&
              m.dueDate !== null &&
              m.dueDate.getTime() < now,
          }))
          // Atrasadas primeiro (FR-7.4): a lista existe para cobrar o que
          // venceu, não para catalogar o que está no prazo.
          .sort((a, b) => Number(b.overdue) - Number(a.overdue)),
      };
    });
  });
}

// ── Mitigações (FR-7.5) ───────────────────────────────────────────────────────

const CreateMitigationSchema = z.object({
  useCaseCode: z.string().min(1),
  category: z.enum([
    "PRIVACY",
    "REGULATORY",
    "SECURITY",
    "BIAS",
    "IP",
    "OPERATIONAL",
    "REPUTATIONAL",
  ]),
  action: z.string().trim().min(1, "Descreva a ação de mitigação").max(2000),
  ownerName: z.string().trim().max(120).optional(),
  dueDate: z.coerce.date().optional(),
});

export async function createMitigation(
  input: z.input<typeof CreateMitigationSchema>
): Promise<Result<{ code: string }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("risk.score");
    const data = CreateMitigationSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const uc = await db.charterUseCase.findUnique({
        where: {
          tenantId_code: { tenantId: ctx.tenantId, code: data.useCaseCode },
        },
        select: { id: true, code: true, title: true },
      });
      if (!uc) {
        throw new GovernanceError("case.unknown", "Caso não encontrado.");
      }

      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "mitigation",
        prefix: "MIT",
        pad: 2,
      });
      const created = await db.charterMitigation.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          useCaseId: uc.id,
          category: data.category,
          action: data.action,
          ownerName: data.ownerName ?? ctx.user.name ?? null,
          ownerId: ctx.userId,
          dueDate: data.dueDate ?? null,
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Criou mitigação",
        entityType: "charter.mitigation",
        entityId: created.id,
        target: `${code} · ${uc.code} ${uc.title}`,
        note: data.action,
        diff: [
          ["Categoria", "—", data.category],
          [
            "Prazo",
            "—",
            data.dueDate ? data.dueDate.toISOString().slice(0, 10) : "—",
          ],
        ],
      });

      revalidatePath("/charter", "layout");
      return { code };
    });
  });
}

const UpdateMitigationSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["OPEN", "PROGRESS", "DONE"]),
});

export async function setMitigationStatus(
  input: z.infer<typeof UpdateMitigationSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("risk.score");
    const data = UpdateMitigationSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const m = await db.charterMitigation.findFirst({
        where: { id: data.id, tenantId: ctx.tenantId },
        include: { useCase: { select: { code: true, title: true } } },
      });
      if (!m) {
        throw new GovernanceError(
          "mitigation.unknown",
          "Mitigação não encontrada."
        );
      }

      await db.charterMitigation.update({
        where: { id: m.id },
        data: { status: data.status },
      });

      await logCharterAudit(db, ctx, {
        action: "Atualizou mitigação",
        entityType: "charter.mitigation",
        entityId: m.id,
        target: `${m.code} · ${m.useCase.code} ${m.useCase.title}`,
        diff: [["Status", m.status, data.status]],
      });

      revalidatePath("/charter", "layout");
      return null;
    });
  });
}
