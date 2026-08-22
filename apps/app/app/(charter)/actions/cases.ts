"use server";

import {
  type CharterDataClass,
  type CharterUseCase,
  type CharterUseCaseStatus,
  withTenantDb,
} from "@repo/database";
import { hasCharterPermission } from "@repo/rbac";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  GovernanceError,
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import {
  recommendPath,
  riskScore,
  slaRemaining,
  vendorEligibility,
} from "@/lib/charter/rules";
import { type Result, safeAction } from "../../actions/_base";
import { buildDiff, FIELD_LABELS, logCharterAudit, nextCode } from "./_shared";

// Casos de uso — FR-3, FR-4, FR-5, FR-6.
//
// Contrato de API: DATA-MODEL §5. Códigos: 403 permissão, 422 regra de
// governança violada (com a regra nomeada), 409 conflito de estado.

// ── Views ─────────────────────────────────────────────────────────────────────

export type UseCaseRow = {
  id: string;
  code: string;
  title: string;
  department: string | null;
  ownerName: string | null;
  vendorName: string | null;
  vendorTier: string | null;
  exposure: string;
  dataClass: CharterDataClass;
  status: CharterUseCaseStatus;
  score: number;
  riskLabel: string;
  riskTone: string;
  slaRemaining: number | null;
  slaTotal: number | null;
};

export type UseCaseDetail = UseCaseRow & {
  objective: string;
  exposure: string;
  criticality: string;
  hitl: string | null;
  approvalPath: string | null;
  vendorId: string | null;
  vendorCode: string | null;
  vendorCategory: string | null;
  vendorRegion: string | null;
  vendorDpa: boolean | null;
  vendorRetention: string | null;
  vendorMaxClass: CharterDataClass | null;
  vendorIneligible: boolean;
  submittedAt: string | null;
  severity: number;
  likelihood: number;
  risks: Record<string, number>;
  restrictions: string[];
  blockReason: string | null;
  changeRequest: string | null;
  mitigations: {
    id: string;
    code: string;
    category: string;
    action: string;
    ownerName: string | null;
    dueDate: string | null;
    status: string;
    overdue: boolean;
  }[];
  decisions: {
    id: string;
    outcome: string;
    rationale: string;
    conditions: string[];
    deciderRole: string;
    createdAt: string;
  }[];
  /** Permissão do papel da sessão. O cliente não pode importar @repo/rbac
   *  (server-only), então a matriz é resolvida aqui. */
  can: { decide: boolean };
};

function riskProfile(uc: CharterUseCase) {
  return {
    privacy: uc.riskPrivacy,
    regulatory: uc.riskRegulatory,
    security: uc.riskSecurity,
    bias: uc.riskBias,
    ip: uc.riskIp,
    operational: uc.riskOperational,
    reputational: uc.riskReputational,
  };
}

/** Estados em que o relógio de SLA ainda corre. Fora deles o prazo não
 *  significa nada: um caso aprovado em maio tem SLA aritmeticamente vencido e
 *  isso não é problema de ninguém. Mostrar "vencido" numa linha arquivada
 *  enche a coluna de alarme falso e ensina o revisor a ignorá-la. */
const SLA_RUNNING: CharterUseCaseStatus[] = ["SUBMITTED", "REVIEW", "CHANGES"];

function toRow(
  uc: CharterUseCase & { vendor?: { name: string; tier?: string } | null }
): UseCaseRow {
  const r = riskScore(riskProfile(uc));
  const slaLive = SLA_RUNNING.includes(uc.status);
  return {
    id: uc.id,
    code: uc.code,
    title: uc.title,
    department: uc.department,
    ownerName: uc.ownerName,
    vendorName: uc.vendor?.name ?? null,
    vendorTier: uc.vendor?.tier ?? null,
    exposure: uc.exposure,
    dataClass: uc.dataClass,
    status: uc.status,
    score: r.score,
    riskLabel: r.label,
    riskTone: r.tone,
    slaRemaining: slaLive ? slaRemaining(uc.submittedAt, uc.slaTotal) : null,
    slaTotal: slaLive ? uc.slaTotal : null,
  };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

const ListSchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  dataClass: z.string().optional(),
  q: z.string().max(120).optional(),
});

export async function listCases(
  input: z.infer<typeof ListSchema> = {}
): Promise<Result<{ rows: UseCaseRow[]; departments: string[] }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    const f = ListSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.charterUseCase.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...(f.status && f.status !== "all"
            ? { status: f.status as CharterUseCaseStatus }
            : {}),
          ...(f.department && f.department !== "all"
            ? { department: f.department }
            : {}),
          ...(f.dataClass && f.dataClass !== "all"
            ? { dataClass: f.dataClass as CharterDataClass }
            : {}),
          ...(f.q
            ? {
                OR: [
                  { title: { contains: f.q, mode: "insensitive" as const } },
                  { code: { contains: f.q, mode: "insensitive" as const } },
                  {
                    ownerName: { contains: f.q, mode: "insensitive" as const },
                  },
                ],
              }
            : {}),
        },
        include: { vendor: { select: { name: true, tier: true } } },
        // Por código decrescente: o caso mais recente é o que interessa primeiro,
        // e o código é a ordem que o usuário reconhece — createdAt do seed não é.
        orderBy: [{ code: "desc" }],
      });

      const departments = await db.charterUseCase.findMany({
        where: { tenantId: ctx.tenantId, department: { not: null } },
        select: { department: true },
        distinct: ["department"],
      });

      return {
        rows: rows.map(toRow),
        departments: departments
          .map((d) => d.department)
          .filter((d): d is string => d !== null)
          .sort(),
      };
    });
  });
}

export async function getCase(
  code: string
): Promise<Result<UseCaseDetail | null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const uc = await db.charterUseCase.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code } },
        include: {
          vendor: {
            select: {
              name: true,
              code: true,
              category: true,
              region: true,
              dpa: true,
              retention: true,
              maxClass: true,
            },
          },
          mitigations: { orderBy: { dueDate: "asc" } },
          decisions: { orderBy: { createdAt: "desc" } },
        },
      });
      if (!uc) {
        return null;
      }
      const r = riskScore(riskProfile(uc));
      const now = Date.now();
      return {
        ...toRow(uc),
        objective: uc.objective,
        exposure: uc.exposure,
        criticality: uc.criticality,
        hitl: uc.hitl,
        approvalPath: uc.approvalPath,
        vendorId: uc.vendorId,
        vendorCode: uc.vendor?.code ?? null,
        vendorCategory: uc.vendor?.category ?? null,
        vendorRegion: uc.vendor?.region ?? null,
        vendorDpa: uc.vendor?.dpa ?? null,
        vendorRetention: uc.vendor?.retention ?? null,
        vendorMaxClass: uc.vendor?.maxClass ?? null,
        vendorIneligible: uc.vendorIneligible,
        submittedAt: uc.submittedAt?.toISOString() ?? null,
        can: { decide: hasCharterPermission(ctx.charterRole, "case.decide") },
        severity: r.severity,
        likelihood: r.likelihood,
        risks: riskProfile(uc),
        restrictions: uc.restrictions,
        blockReason: uc.blockReason,
        changeRequest: uc.changeRequest,
        mitigations: uc.mitigations.map((m) => ({
          id: m.id,
          code: m.code,
          category: m.category,
          action: m.action,
          ownerName: m.ownerName,
          dueDate: m.dueDate?.toISOString() ?? null,
          status: m.status,
          // OVERDUE é derivado; persistir exigiria um job só para envelhecer linhas.
          overdue:
            m.status !== "DONE" &&
            m.dueDate !== null &&
            m.dueDate.getTime() < now,
        })),
        decisions: uc.decisions.map((d) => ({
          id: d.id,
          outcome: d.outcome,
          rationale: d.rationale,
          conditions: d.conditions,
          deciderRole: d.deciderRole,
          createdAt: d.createdAt.toISOString(),
        })),
      };
    });
  });
}

// ── Intake (FR-4) ─────────────────────────────────────────────────────────────

const SubmitSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(160),
  objective: z.string().trim().min(1, "Objetivo é obrigatório").max(4000),
  department: z.string().trim().max(80).optional(),
  ownerName: z.string().trim().max(120).optional(),
  vendorId: z.string().cuid().nullable(),
  dataClass: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]),
  exposure: z.enum(["INTERNAL", "EXTERNAL"]),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH"]),
  launchTarget: z.coerce.date().optional(),
  /** Rascunho não passa pelo gate de fornecedor nem consome SLA. */
  asDraft: z.boolean().default(false),
});

export async function submitCase(
  input: z.input<typeof SubmitSchema>
): Promise<Result<{ code: string }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const data = SubmitSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      let vendorName: string | null = null;

      if (data.vendorId) {
        const vendor = await db.charterVendor.findFirst({
          where: { id: data.vendorId, tenantId: ctx.tenantId },
          select: { name: true, maxClass: true, notes: true },
        });
        if (!vendor) {
          throw new GovernanceError(
            "vendor.unknown",
            "Fornecedor não encontrado nesta organização."
          );
        }
        vendorName = vendor.name;

        // Gate de fornecedor: barra ANTES de submeter. Submeter para reprovar
        // depois queima um ciclo de SLA e a paciência do requester.
        if (!data.asDraft) {
          const gate = vendorEligibility(vendor, data.dataClass);
          if (!gate.eligible) {
            throw new GovernanceError("vendor.maxClass", gate.reason);
          }
        }
      } else if (!data.asDraft) {
        throw new GovernanceError(
          "vendor.required",
          "Todo caso submetido precisa declarar o fornecedor ou modelo usado."
        );
      }

      const rec = recommendPath(
        data.dataClass,
        data.exposure,
        data.criticality
      );
      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "usecase",
        prefix: "UC",
      });

      const created = await db.charterUseCase.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          title: data.title,
          objective: data.objective,
          department: data.department ?? null,
          ownerName: data.ownerName ?? ctx.user.name ?? null,
          ownerId: ctx.userId,
          vendorId: data.vendorId,
          dataClass: data.dataClass,
          exposure: data.exposure,
          criticality: data.criticality,
          launchTarget: data.launchTarget ?? null,
          status: data.asDraft ? "DRAFT" : "SUBMITTED",
          // Congelado no ato da submissão: mudar a regra depois não pode
          // reescrever o SLA de um caso em curso.
          approvalPath: data.asDraft ? null : rec.path,
          slaTotal: data.asDraft ? null : rec.slaDays,
          hitl: data.asDraft ? null : rec.hitl,
          submittedAt: data.asDraft ? null : new Date(),
        },
      });

      await logCharterAudit(db, ctx, {
        action: data.asDraft ? "Salvou rascunho" : "Submeteu caso de uso",
        entityType: "charter.usecase",
        entityId: created.id,
        target: `${code} · ${data.title}`,
        note: data.asDraft
          ? undefined
          : `${rec.path} · SLA ${rec.slaDays} dias úteis · ${rec.rule}`,
        diff: [
          ["Status", "—", data.asDraft ? "Rascunho" : "Submetido"],
          ["Classe de dado", "—", data.dataClass],
          ["Fornecedor", "—", vendorName ?? "—"],
        ],
      });

      return { code };
    });
  });
}

// ── Decisão (FR-6) ────────────────────────────────────────────────────────────

const OUTCOME_STATUS: Record<string, CharterUseCaseStatus> = {
  APPROVED: "APPROVED",
  RESTRICTED: "RESTRICTED",
  CHANGES: "CHANGES",
  BLOCKED: "BLOCKED",
};

const OUTCOME_LABEL: Record<string, string> = {
  APPROVED: "Aprovou",
  RESTRICTED: "Aprovou com restrições",
  CHANGES: "Pediu ajustes",
  BLOCKED: "Bloqueou caso",
};

const DecideSchema = z
  .object({
    code: z.string().min(1),
    outcome: z.enum(["APPROVED", "RESTRICTED", "CHANGES", "BLOCKED"]),
    // Obrigatória sem exceção, inclusive em aprovação limpa: é o registro que a
    // auditoria lê seis meses depois.
    rationale: z
      .string()
      .trim()
      .min(1, "Justificativa é obrigatória")
      .max(4000),
    conditions: z.array(z.string().trim().min(1)).default([]),
    changeRequest: z.string().trim().max(4000).optional(),
    blockReason: z.string().trim().max(4000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === "RESTRICTED" && v.conditions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["conditions"],
        message:
          "Aprovação com restrições exige ao menos uma condição explícita.",
      });
    }
    if (v.outcome === "CHANGES" && !v.changeRequest?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["changeRequest"],
        message: "Pedido de ajuste exige a descrição do que ajustar.",
      });
    }
    if (v.outcome === "BLOCKED" && !v.blockReason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["blockReason"],
        message: "Bloqueio exige motivo.",
      });
    }
  });

export async function decideCase(
  input: z.input<typeof DecideSchema>
): Promise<Result<{ status: CharterUseCaseStatus }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.decide");
    const data = DecideSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const uc = await db.charterUseCase.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: data.code } },
      });
      if (!uc) {
        throw new GovernanceError("case.unknown", "Caso não encontrado.");
      }
      if (uc.status === "DRAFT") {
        throw new GovernanceError(
          "case.notSubmitted",
          "Caso em rascunho ainda não foi submetido — não há o que decidir."
        );
      }
      if (uc.status === "ARCHIVED") {
        throw new GovernanceError(
          "case.archived",
          "Caso arquivado não aceita nova decisão."
        );
      }

      const status = OUTCOME_STATUS[data.outcome];

      const updated = await db.charterUseCase.update({
        where: { id: uc.id },
        data: {
          status,
          restrictions: data.outcome === "RESTRICTED" ? data.conditions : [],
          blockReason:
            data.outcome === "BLOCKED" ? (data.blockReason ?? null) : null,
          changeRequest:
            data.outcome === "CHANGES" ? (data.changeRequest ?? null) : null,
          reviewerId: ctx.userId,
          // Bloqueado sai da fila de SLA: continuar contando prazo de algo que
          // não vai andar polui a fila de "fora de SLA".
          slaTotal: data.outcome === "BLOCKED" ? null : uc.slaTotal,
        },
      });

      await db.charterDecision.create({
        data: {
          tenantId: ctx.tenantId,
          useCaseId: uc.id,
          outcome: data.outcome,
          rationale: data.rationale,
          conditions: data.outcome === "RESTRICTED" ? data.conditions : [],
          deciderId: ctx.userId,
          deciderRole: ctx.charterRole,
          previousStatus: uc.status,
        },
      });

      await logCharterAudit(db, ctx, {
        action: OUTCOME_LABEL[data.outcome],
        entityType: "charter.decision",
        entityId: uc.id,
        target: `${uc.code} · ${uc.title}`,
        note: data.rationale,
        diff: buildDiff(
          { status: uc.status, restrictions: uc.restrictions.length },
          {
            status: updated.status,
            restrictions:
              data.outcome === "RESTRICTED"
                ? `${data.conditions.length} condições`
                : undefined,
          },
          {
            status: FIELD_LABELS.status,
            restrictions: FIELD_LABELS.restrictions,
          }
        ),
      });

      revalidatePath("/charter", "layout");
      return { status };
    });
  });
}

// ── Repontuar risco (FR-7.5 / DATA-MODEL §6) ──────────────────────────────────

const RescoreSchema = z.object({
  code: z.string().min(1),
  risks: z.object({
    privacy: z.number().int().min(1).max(5),
    regulatory: z.number().int().min(1).max(5),
    security: z.number().int().min(1).max(5),
    bias: z.number().int().min(1).max(5),
    ip: z.number().int().min(1).max(5),
    operational: z.number().int().min(1).max(5),
    reputational: z.number().int().min(1).max(5),
  }),
  note: z.string().trim().max(1000).optional(),
});

async function rescoreCase(
  input: z.infer<typeof RescoreSchema>
): Promise<Result<{ score: number; label: string }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("risk.score");
    const data = RescoreSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const uc = await db.charterUseCase.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: data.code } },
      });
      if (!uc) {
        throw new GovernanceError("case.unknown", "Caso não encontrado.");
      }

      const before = riskScore(riskProfile(uc));
      const after = riskScore(data.risks);

      await db.charterUseCase.update({
        where: { id: uc.id },
        data: {
          riskPrivacy: data.risks.privacy,
          riskRegulatory: data.risks.regulatory,
          riskSecurity: data.risks.security,
          riskBias: data.risks.bias,
          riskIp: data.risks.ip,
          riskOperational: data.risks.operational,
          riskReputational: data.risks.reputational,
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Reavaliou risco",
        entityType: "charter.risk",
        entityId: uc.id,
        target: `${uc.code} · ${uc.title}`,
        note: data.note,
        diff: buildDiff(
          {
            riskPrivacy: uc.riskPrivacy,
            riskRegulatory: uc.riskRegulatory,
            riskSecurity: uc.riskSecurity,
            riskBias: uc.riskBias,
            riskIp: uc.riskIp,
            riskOperational: uc.riskOperational,
            riskReputational: uc.riskReputational,
            severity: before.severity,
            score: before.score,
          },
          {
            riskPrivacy: data.risks.privacy,
            riskRegulatory: data.risks.regulatory,
            riskSecurity: data.risks.security,
            riskBias: data.risks.bias,
            riskIp: data.risks.ip,
            riskOperational: data.risks.operational,
            riskReputational: data.risks.reputational,
            severity: after.severity,
            score: after.score,
          },
          FIELD_LABELS
        ),
      });

      revalidatePath("/charter", "layout");
      return { score: after.score, label: after.label };
    });
  });
}

/** Avaliação ao vivo do intake (FR-4.2). Roda no cliente; esta versão existe
 *  para quem preferir chamar do servidor — mesma função pura dos dois lados. */
async function previewPath(input: {
  dataClass: CharterDataClass;
  exposure: "INTERNAL" | "EXTERNAL";
  criticality: "LOW" | "MEDIUM" | "HIGH";
}): Promise<Result<ReturnType<typeof recommendPath>>> {
  return await safeAction(async () => {
    await requireCharterContext();
    return recommendPath(input.dataClass, input.exposure, input.criticality);
  });
}
