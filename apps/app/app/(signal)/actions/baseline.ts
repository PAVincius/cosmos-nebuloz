"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import {
  requireInitiativeOwnership,
  requireSignalPermissionContext,
} from "@/lib/signal/guards";
import {
  BASELINE_KEY_LABEL,
  REQUIRED_BASELINE_KEYS,
} from "@/lib/signal/lifecycle";
import { isoDate, nnStr } from "../../actions/_base";
import {
  FIELD_LABELS,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";

// Baseline — US1.
//
// Duas etapas separadas de propósito: `draftBaseline` grava, `signBaseline`
// congela. Fundir as duas em "salvar" faria toda correção de digitação virar
// uma versão nova, e a lista de versões — que é a prova de que a régua não
// mudou no meio do jogo — encheria de ruído.
//
// Depois de assinado, o baseline é imutável. Editar cria versão nova; a
// anterior nunca some, porque é ela que sustenta o número já reportado no
// trimestre passado.

const DimensionSchema = z.object({
  key: nnStr,
  label: nnStr,
  value: nnStr,
  numericValue: z.coerce.number().optional(),
  unit: nnStr.optional(),
  sourceLabel: nnStr,
});

const DraftSchema = z.object({
  initiativeCode: nnStr,
  windowLabel: nnStr,
  windowStart: isoDate,
  windowEnd: isoDate,
  dimensions: z.array(DimensionSchema).min(1).max(20),
});

const SignSchema = z.object({
  initiativeCode: nnStr,
  version: z.coerce.number().int().positive(),
});

async function loadInitiative(
  db: Parameters<Parameters<typeof withTenantDb>[1]>[0],
  tenantId: string,
  code: string
) {
  const row = await db.signalInitiative.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });
  if (!row) {
    throw new SignalRuleError(
      "initiative.not-found",
      `Iniciativa ${code} não encontrada nesta organização.`
    );
  }
  return row;
}

export async function getBaselines(raw: {
  code: string;
}): Promise<SignalResult<unknown>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const { code } = z.object({ code: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await loadInitiative(db, ctx.tenantId, code);
      const rows = await db.signalBaseline.findMany({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
        include: {
          dimensions: { orderBy: { order: "asc" } },
          signedBy: { select: { name: true, email: true } },
        },
        orderBy: { version: "desc" },
      });
      return rows.map((b) => ({
        version: b.version,
        windowLabel: b.windowLabel,
        windowStart: b.windowStart,
        windowEnd: b.windowEnd,
        signedAt: b.signedAt,
        signedBy: b.signedBy?.name ?? b.signedBy?.email ?? null,
        frozen: b.signedAt !== null,
        dimensions: b.dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          value: d.value,
          unit: d.unit,
          sourceLabel: d.sourceLabel,
        })),
      }));
    });
  });
}

export async function draftBaseline(
  raw: z.input<typeof DraftSchema>
): Promise<SignalResult<{ version: number }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.baseline.write");
    const input = DraftSchema.parse(raw);

    if (input.windowEnd <= input.windowStart) {
      throw new SignalRuleError(
        "baseline.window",
        "A janela de medição precisa terminar depois de começar."
      );
    }

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await loadInitiative(
        db,
        ctx.tenantId,
        input.initiativeCode
      );
      requireInitiativeOwnership(ctx, initiative);

      const latest = await db.signalBaseline.findFirst({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
        orderBy: { version: "desc" },
      });

      // Rascunho aberto continua editável: sobrescreve em vez de abrir versão.
      if (latest && latest.signedAt === null) {
        await db.signalBaselineDimension.deleteMany({
          where: { baselineId: latest.id },
        });
        await db.signalBaseline.update({
          where: { id: latest.id },
          data: {
            windowLabel: input.windowLabel,
            windowStart: input.windowStart,
            windowEnd: input.windowEnd,
            dimensions: {
              create: input.dimensions.map((d, order) => ({
                tenantId: ctx.tenantId,
                key: d.key,
                label: d.label,
                value: d.value,
                numericValue: d.numericValue,
                unit: d.unit,
                sourceLabel: d.sourceLabel,
                order,
              })),
            },
          },
        });
        return { version: latest.version, created: false };
      }

      const version = (latest?.version ?? 0) + 1;
      const created = await db.signalBaseline.create({
        data: {
          tenantId: ctx.tenantId,
          initiativeId: initiative.id,
          version,
          windowLabel: input.windowLabel,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          dimensions: {
            create: input.dimensions.map((d, order) => ({
              tenantId: ctx.tenantId,
              key: d.key,
              label: d.label,
              value: d.value,
              numericValue: d.numericValue,
              unit: d.unit,
              sourceLabel: d.sourceLabel,
              order,
            })),
          },
        },
      });
      await logSignalAudit(db, ctx, {
        action: "Baseline rascunhado",
        entityType: "signal.baseline",
        entityId: created.id,
        target: `${initiative.code} · baseline v${version}`,
        diff: latest
          ? [[FIELD_LABELS.version, `v${latest.version}`, `v${version}`]]
          : undefined,
      });
      return { version, created: true };
    });

    revalidatePath(`/signal/initiative/${input.initiativeCode}`);
    return { version: result.version };
  });
}

export async function signBaseline(
  raw: z.input<typeof SignSchema>
): Promise<SignalResult<{ version: number; signedAt: Date }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.baseline.write");
    const input = SignSchema.parse(raw);

    const signed = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await loadInitiative(
        db,
        ctx.tenantId,
        input.initiativeCode
      );
      requireInitiativeOwnership(ctx, initiative);

      const baseline = await db.signalBaseline.findUnique({
        where: {
          tenantId_initiativeId_version: {
            tenantId: ctx.tenantId,
            initiativeId: initiative.id,
            version: input.version,
          },
        },
        include: { dimensions: true },
      });
      if (!baseline) {
        throw new SignalRuleError(
          "baseline.not-found",
          `Baseline v${input.version} não existe para ${initiative.code}.`
        );
      }
      if (baseline.signedAt) {
        throw new SignalRuleError(
          "baseline.already-signed",
          `O baseline v${input.version} já foi assinado e é imutável. Para mudar a linha de base, rascunhe uma versão nova.`
        );
      }

      const present = new Set(baseline.dimensions.map((d) => d.key));
      const missing = REQUIRED_BASELINE_KEYS.filter((k) => !present.has(k));
      if (missing.length > 0) {
        throw new SignalRuleError(
          "baseline.dimensions.incomplete",
          `Faltam dimensões obrigatórias: ${missing
            .map((k) => BASELINE_KEY_LABEL[k] ?? k)
            .join(
              ", "
            )}. Sem elas, o ganho medido depois fica sem contra-prova em pelo menos um eixo.`
        );
      }
      const sourceless = baseline.dimensions.filter(
        (d) => d.sourceLabel.trim().length === 0
      );
      if (sourceless.length > 0) {
        throw new SignalRuleError(
          "baseline.source.required",
          `Dimensão sem fonte declarada: ${sourceless.map((d) => d.label).join(", ")}. Número sem origem não é baseline, é lembrança.`
        );
      }

      const at = new Date();
      await db.signalBaseline.update({
        where: { id: baseline.id },
        data: { signedById: ctx.userId, signedAt: at },
      });
      await logSignalAudit(db, ctx, {
        action: "Baseline assinado",
        entityType: "signal.baseline",
        entityId: baseline.id,
        target: `${initiative.code} · baseline v${input.version}`,
        note: baseline.windowLabel,
        diff: [[FIELD_LABELS.signedAt, "—", at.toISOString()]],
      });
      return at;
    });

    revalidatePath(`/signal/initiative/${input.initiativeCode}`);
    return { version: input.version, signedAt: signed };
  });
}
