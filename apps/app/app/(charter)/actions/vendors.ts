"use server";

import {
  type CharterDataClass,
  type CharterVendorTier,
  withTenantDb,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  GovernanceError,
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import {
  dataClassWeight,
  deriveVendorMaxClass,
  vendorEligibility,
} from "@/lib/charter/rules";
import { type Result, safeAction } from "../../actions/_base";
import {
  buildDiff,
  type Db,
  FIELD_LABELS,
  logCharterAudit,
  nextCode,
} from "./_shared";

// Fornecedores e cláusulas — FR-8, FR-9.

export type VendorRow = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  tier: CharterVendorTier;
  region: string | null;
  dpa: boolean;
  retention: string | null;
  subprocessors: number;
  maxClass: CharterDataClass | null;
  score: number;
  cases: number;
  renewalAt: string | null;
  notes: string | null;
  /** Sinalizações que a lista destaca (FR-8.2). */
  flags: string[];
  /** Cláusulas críticas do tenant ausentes neste fornecedor (FR-8.2). */
  criticalMissing: number;
};

export type VendorDetail = VendorRow & {
  clauseCodes: string[];
  reasoning: string[];
  library: { id: string; code: string; name: string; critical: boolean }[];
  linkedCases: {
    code: string;
    title: string;
    dataClass: CharterDataClass;
    exceedsMaxClass: boolean;
  }[];
};

// "Zero" é a única retenção compatível com dado Confidencial pela política.
const ZERO_RETENTION = /zero/i;

function flagsFor(v: {
  dpa: boolean;
  retention: string | null;
  tier: CharterVendorTier;
}): string[] {
  const flags: string[] = [];
  if (!v.dpa) {
    flags.push("DPA ausente");
  }
  // "Zero" é a única retenção compatível com dado Confidencial pela política.
  if (v.retention && !ZERO_RETENTION.test(v.retention)) {
    flags.push("Retenção incompatível");
  }
  if (v.tier === "BLOCKED") {
    flags.push("Bloqueado");
  }
  return flags;
}

export async function listVendors(): Promise<Result<VendorRow[]>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      // A contagem de críticas é do tenant, não do fornecedor: "faltando" só
      // faz sentido contra a biblioteca inteira.
      const [vendors, criticalTotal] = await Promise.all([
        db.charterVendor.findMany({
          where: { tenantId: ctx.tenantId },
          include: {
            _count: { select: { useCases: true } },
            clauses: {
              where: { clause: { critical: true } },
              select: { id: true },
            },
          },
          orderBy: { code: "asc" },
        }),
        db.charterClause.count({
          where: { tenantId: ctx.tenantId, critical: true },
        }),
      ]);
      return vendors.map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
        category: v.category,
        tier: v.tier,
        region: v.region,
        dpa: v.dpa,
        retention: v.retention,
        subprocessors: v.subprocessors,
        maxClass: v.maxClass,
        score: v.score,
        cases: v._count.useCases,
        renewalAt: v.renewalAt?.toISOString() ?? null,
        notes: v.notes,
        flags: flagsFor(v),
        criticalMissing: criticalTotal - v.clauses.length,
      }));
    });
  });
}

export async function getVendor(
  code: string
): Promise<Result<VendorDetail | null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const v = await db.charterVendor.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code } },
        include: {
          clauses: { include: { clause: true } },
          useCases: {
            select: { code: true, title: true, dataClass: true },
            orderBy: { code: "desc" },
          },
        },
      });
      if (!v) {
        return null;
      }
      const library = await db.charterClause.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { code: "asc" },
      });

      const clauseCodes = v.clauses.map((c) => c.clause.code);
      const derivation = deriveVendorMaxClass({
        tier: v.tier,
        dpa: v.dpa,
        clauseCodes,
      });

      return {
        id: v.id,
        code: v.code,
        name: v.name,
        category: v.category,
        tier: v.tier,
        region: v.region,
        dpa: v.dpa,
        retention: v.retention,
        subprocessors: v.subprocessors,
        maxClass: v.maxClass,
        score: v.score,
        cases: v.useCases.length,
        renewalAt: v.renewalAt?.toISOString() ?? null,
        notes: v.notes,
        flags: flagsFor(v),
        criticalMissing: library.filter(
          (c) => c.critical && !clauseCodes.includes(c.code)
        ).length,
        clauseCodes,
        reasoning: derivation.reasoning,
        library: library.map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          critical: c.critical,
        })),
        linkedCases: v.useCases.map((uc) => ({
          code: uc.code,
          title: uc.title,
          dataClass: uc.dataClass,
          exceedsMaxClass:
            v.maxClass === null ||
            dataClassWeight(v.maxClass) < dataClassWeight(uc.dataClass),
        })),
      };
    });
  });
}

// ── Recomputo do teto contratual + reavaliação dos casos ──────────────────────

/**
 * Recomputa `maxClass` e reavalia todos os casos vinculados.
 *
 * Efeito colateral obrigatório do DATA-MODEL §6: um fornecedor serve N casos,
 * então mexer no fornecedor mexe em todos. Sinaliza (não bloqueia) os casos que
 * ficaram inelegíveis — bloquear silenciosamente esconderia o problema do
 * revisor humano, que é justamente quem precisa decidir o que fazer.
 */
async function recomputeVendorReach(
  db: Db,
  tenantId: string,
  vendorId: string
): Promise<{ maxClass: CharterDataClass | null; flagged: string[] }> {
  const vendor = await db.charterVendor.findUniqueOrThrow({
    where: { id: vendorId },
    include: { clauses: { include: { clause: { select: { code: true } } } } },
  });

  const derivation = deriveVendorMaxClass({
    tier: vendor.tier,
    dpa: vendor.dpa,
    clauseCodes: vendor.clauses.map((c) => c.clause.code),
  });

  await db.charterVendor.update({
    where: { id: vendorId },
    data: { maxClass: derivation.maxClass },
  });

  const cases = await db.charterUseCase.findMany({
    where: { tenantId, vendorId },
    select: { id: true, code: true, dataClass: true },
  });

  const flagged: string[] = [];
  for (const uc of cases) {
    const gate = vendorEligibility(
      { maxClass: derivation.maxClass, notes: vendor.notes },
      uc.dataClass
    );
    const ineligible = !gate.eligible;
    await db.charterUseCase.update({
      where: { id: uc.id },
      data: { vendorIneligible: ineligible },
    });
    if (ineligible) {
      flagged.push(uc.code);
    }
  }

  return { maxClass: derivation.maxClass, flagged };
}

// ── Cadastro (FR-8.4) ─────────────────────────────────────────────────────────

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  category: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  dpa: z.boolean().default(false),
  retention: z.string().trim().max(60).optional(),
  subprocessors: z.number().int().min(0).max(999).default(0),
  tier: z
    .enum(["APPROVED", "RESTRICTED", "REVIEW", "BLOCKED"])
    .default("REVIEW"),
  notes: z.string().trim().max(2000).optional(),
  clauseCodes: z.array(z.string()).default([]),
});

export async function createVendor(
  input: z.input<typeof CreateSchema>
): Promise<Result<{ code: string; maxClass: CharterDataClass | null }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("vendor.approve");
    const data = CreateSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const code = await nextCode({
        db,
        tenantId: ctx.tenantId,
        kind: "vendor",
        prefix: "V",
        pad: 2,
      });
      const vendor = await db.charterVendor.create({
        data: {
          tenantId: ctx.tenantId,
          code,
          name: data.name,
          category: data.category ?? null,
          region: data.region ?? null,
          dpa: data.dpa,
          retention: data.retention ?? null,
          subprocessors: data.subprocessors,
          tier: data.tier,
          notes: data.notes ?? null,
        },
      });

      if (data.clauseCodes.length > 0) {
        const clauses = await db.charterClause.findMany({
          where: { tenantId: ctx.tenantId, code: { in: data.clauseCodes } },
          select: { id: true },
        });
        await db.charterVendorClause.createMany({
          data: clauses.map((c) => ({
            tenantId: ctx.tenantId,
            vendorId: vendor.id,
            clauseId: c.id,
          })),
        });
      }

      const { maxClass } = await recomputeVendorReach(
        db,
        ctx.tenantId,
        vendor.id
      );

      await logCharterAudit(db, ctx, {
        action: "Cadastrou fornecedor",
        entityType: "charter.vendor",
        entityId: vendor.id,
        target: `${code} · ${data.name}`,
        note: data.notes,
        diff: [
          [FIELD_LABELS.tier, "—", data.tier],
          [FIELD_LABELS.dpa, "—", data.dpa ? "Sim" : "Não"],
          [FIELD_LABELS.maxClass, "—", maxClass ?? "Nenhuma"],
        ],
      });

      revalidatePath("/charter", "layout");
      return { code, maxClass };
    });
  });
}

// ── Mudança de tier (FR-8.5) ──────────────────────────────────────────────────

const TierSchema = z.object({
  vendorId: z.string().cuid(),
  tier: z.enum(["APPROVED", "RESTRICTED", "REVIEW", "BLOCKED"]),
  rationale: z
    .string()
    .trim()
    .min(1, "Mudança de tier exige justificativa")
    .max(2000),
});

export async function setVendorTier(
  input: z.input<typeof TierSchema>
): Promise<Result<{ maxClass: CharterDataClass | null; flagged: string[] }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("vendor.approve");
    const data = TierSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const vendor = await db.charterVendor.findFirst({
        where: { id: data.vendorId, tenantId: ctx.tenantId },
      });
      if (!vendor) {
        throw new GovernanceError(
          "vendor.unknown",
          "Fornecedor não encontrado."
        );
      }

      await db.charterVendor.update({
        where: { id: vendor.id },
        data: { tier: data.tier },
      });

      const { maxClass, flagged } = await recomputeVendorReach(
        db,
        ctx.tenantId,
        vendor.id
      );

      await logCharterAudit(db, ctx, {
        action: `Marcou como ${data.tier}`,
        entityType: "charter.vendor",
        entityId: vendor.id,
        target: `${vendor.code} · ${vendor.name}`,
        note: data.rationale,
        diff: buildDiff(
          { tier: vendor.tier, maxClass: vendor.maxClass ?? "Nenhuma" },
          { tier: data.tier, maxClass: maxClass ?? "Nenhuma" },
          { tier: FIELD_LABELS.tier, maxClass: FIELD_LABELS.maxClass }
        ),
      });

      revalidatePath("/charter", "layout");
      return { maxClass, flagged };
    });
  });
}

// ── Cláusulas (FR-9.3) ────────────────────────────────────────────────────────

const ClausesSchema = z.object({
  vendorId: z.string().cuid(),
  clauseCodes: z.array(z.string()),
});

export async function setVendorClauses(
  input: z.infer<typeof ClausesSchema>
): Promise<Result<{ maxClass: CharterDataClass | null; flagged: string[] }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("clause.manage");
    const data = ClausesSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const vendor = await db.charterVendor.findFirst({
        where: { id: data.vendorId, tenantId: ctx.tenantId },
        include: {
          clauses: { include: { clause: { select: { code: true } } } },
        },
      });
      if (!vendor) {
        throw new GovernanceError(
          "vendor.unknown",
          "Fornecedor não encontrado."
        );
      }

      const before = vendor.clauses.map((c) => c.clause.code).sort();

      const clauses = await db.charterClause.findMany({
        where: { tenantId: ctx.tenantId, code: { in: data.clauseCodes } },
        select: { id: true },
      });

      await db.charterVendorClause.deleteMany({
        where: { vendorId: vendor.id },
      });
      if (clauses.length > 0) {
        await db.charterVendorClause.createMany({
          data: clauses.map((c) => ({
            tenantId: ctx.tenantId,
            vendorId: vendor.id,
            clauseId: c.id,
          })),
        });
      }

      const { maxClass, flagged } = await recomputeVendorReach(
        db,
        ctx.tenantId,
        vendor.id
      );

      await logCharterAudit(db, ctx, {
        action: "Atualizou cláusulas contratuais",
        entityType: "charter.clause",
        entityId: vendor.id,
        target: `${vendor.code} · ${vendor.name}`,
        diff: [
          [
            "Cláusulas",
            before.join(", ") || "—",
            data.clauseCodes.sort().join(", ") || "—",
          ],
          [
            FIELD_LABELS.maxClass,
            vendor.maxClass ?? "Nenhuma",
            maxClass ?? "Nenhuma",
          ],
        ],
      });

      revalidatePath("/charter", "layout");
      return { maxClass, flagged };
    });
  });
}

// ── Biblioteca de cláusulas (FR-9.5) ──────────────────────────────────────────

export type ClauseLibraryRow = {
  code: string;
  name: string;
  critical: boolean;
  /** Quantos fornecedores do registro têm esta cláusula. Cobertura baixa numa
   *  cláusula crítica é um problema de contrato, não de um fornecedor só. */
  covered: number;
  total: number;
};

export async function getClauseLibrary(): Promise<Result<ClauseLibraryRow[]>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const [clauses, vendorCount] = await Promise.all([
        db.charterClause.findMany({
          where: { tenantId: ctx.tenantId },
          include: { _count: { select: { vendors: true } } },
          orderBy: { code: "asc" },
        }),
        db.charterVendor.count({ where: { tenantId: ctx.tenantId } }),
      ]);
      return clauses.map((c) => ({
        code: c.code,
        name: c.name,
        critical: c.critical,
        covered: c._count.vendors,
        total: vendorCount,
      }));
    });
  });
}
