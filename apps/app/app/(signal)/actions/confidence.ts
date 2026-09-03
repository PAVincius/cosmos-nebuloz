"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ConfidenceConfigError,
  computeConfidence,
  DEFAULT_CONFIDENCE_RULES,
} from "@/lib/signal/confidence";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import { nnStr, optStr } from "../../actions/_base";
import { logSignalAudit, type SignalResult, signalAction } from "./_shared";

// Confiança — US2.
//
// O score é derivado (soma dos `got`), então este arquivo grava FATORES, nunca
// o total. Escrever o total seria abrir a porta para ele divergir da soma — que
// é exatamente o defeito que o protótipo tinha (score 86, fatores somando 93).
//
// Os pesos são do tenant e valem para todas as iniciativas: mudar o peso de um
// fator é decisão de método, não de caso.

const ScoreSchema = z.object({
  initiativeCode: nnStr,
  scores: z
    .array(
      z.object({
        key: nnStr,
        got: z.coerce.number().int().min(0),
        note: optStr,
      })
    )
    .min(1)
    .max(20),
});

const RulesSchema = z.object({
  rules: z
    .array(
      z.object({
        key: nnStr,
        label: nnStr,
        weight: z.coerce.number().int().min(0).max(100),
        order: z.coerce.number().int().min(0).default(0),
      })
    )
    .min(1)
    .max(20),
});

export type ConfidenceView = ReturnType<typeof computeConfidence>;

/** Converte erro de configuração do motor no erro de domínio da action. */
function asRuleError(e: unknown): never {
  if (e instanceof ConfidenceConfigError) {
    throw new SignalRuleError(e.rule, e.message);
  }
  throw e;
}

export async function getConfidence(raw: {
  initiativeCode: string;
}): Promise<SignalResult<ConfidenceView>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");
    const { initiativeCode } = z.object({ initiativeCode: nnStr }).parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await db.signalInitiative.findUnique({
        where: {
          tenantId_code: { tenantId: ctx.tenantId, code: initiativeCode },
        },
        select: { id: true },
      });
      if (!initiative) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${initiativeCode} não encontrada nesta organização.`
        );
      }

      const scores = await db.signalConfidenceScore.findMany({
        where: { tenantId: ctx.tenantId, initiativeId: initiative.id },
        include: { rule: true },
        orderBy: { rule: { order: "asc" } },
      });

      try {
        return computeConfidence(
          scores.map((s) => ({
            key: s.rule.key,
            label: s.rule.label,
            weight: s.rule.weight,
            got: s.got,
            note: s.note,
          }))
        );
      } catch (e) {
        return asRuleError(e);
      }
    });
  });
}

type RuleRow = { id: string; key: string; label: string; weight: number };

/**
 * Resolve os fatores informados contra o catálogo do tenant e já calcula o
 * score.
 *
 * Separada da action porque é a etapa que PODE recusar: fator inexistente,
 * `got` acima do peso, pesos que não somam 100. Rodar tudo antes da primeira
 * escrita é o que garante que uma avaliação inválida não deixe metade das
 * linhas gravadas.
 */
function validateScores(
  scores: { key: string; got: number; note?: string }[],
  byKey: Map<string, RuleRow>
): ConfidenceView {
  const unknown = scores.filter((s) => !byKey.has(s.key));
  if (unknown.length > 0) {
    throw new SignalRuleError(
      "confidence.rule.unknown",
      `Fator não configurado nesta organização: ${unknown.map((u) => u.key).join(", ")}.`
    );
  }

  const factors = scores.map((s) => {
    const rule = byKey.get(s.key) as RuleRow;
    return {
      key: s.key,
      label: rule.label,
      weight: rule.weight,
      got: s.got,
      note: s.note,
    };
  });

  try {
    return computeConfidence(factors);
  } catch (e) {
    return asRuleError(e);
  }
}

export async function setConfidenceScores(
  raw: z.input<typeof ScoreSchema>
): Promise<SignalResult<{ score: number; band: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.formula.write");
    const input = ScoreSchema.parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const initiative = await db.signalInitiative.findUnique({
        where: {
          tenantId_code: { tenantId: ctx.tenantId, code: input.initiativeCode },
        },
      });
      if (!initiative) {
        throw new SignalRuleError(
          "initiative.not-found",
          `Iniciativa ${input.initiativeCode} não encontrada nesta organização.`
        );
      }

      const rules = await db.signalConfidenceRule.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { order: "asc" },
      });
      const byKey = new Map(rules.map((r) => [r.key, r]));

      // Valida ANTES de gravar: o motor recusa `got` acima do peso, e gravar
      // primeiro deixaria o banco com um score impossível caso a validação
      // falhasse no meio do laço.
      const computed = validateScores(input.scores, byKey);

      for (const s of input.scores) {
        const rule = byKey.get(s.key);
        if (!rule) {
          continue;
        }
        await db.signalConfidenceScore.upsert({
          where: {
            tenantId_initiativeId_ruleId: {
              tenantId: ctx.tenantId,
              initiativeId: initiative.id,
              ruleId: rule.id,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            initiativeId: initiative.id,
            ruleId: rule.id,
            got: s.got,
            note: s.note,
          },
          update: { got: s.got, note: s.note, evaluatedAt: new Date() },
        });
      }

      await logSignalAudit(db, ctx, {
        action: "Confiança reavaliada",
        entityType: "signal.confidence",
        entityId: initiative.id,
        target: `${initiative.code} · ${initiative.name}`,
        diff: [["Score de confiança", "—", String(computed.score)]],
      });

      return { score: computed.score, band: computed.band };
    });

    revalidatePath(`/signal/initiative/${input.initiativeCode}`);
    revalidatePath("/signal/initiatives");
    return result;
  });
}

export async function setConfidenceRules(
  raw: z.input<typeof RulesSchema>
): Promise<SignalResult<{ rules: number }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.settings.write");
    const input = RulesSchema.parse(raw);

    const sum = input.rules.reduce((a, r) => a + r.weight, 0);
    if (sum !== 100) {
      throw new SignalRuleError(
        "confidence.weights.sum",
        `Os pesos dos fatores somam ${sum}, e precisam somar 100 — senão "confiança 70" não quer dizer nada.`
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      for (const r of input.rules) {
        await db.signalConfidenceRule.upsert({
          where: { tenantId_key: { tenantId: ctx.tenantId, key: r.key } },
          create: { tenantId: ctx.tenantId, ...r },
          update: { label: r.label, weight: r.weight, order: r.order },
        });
      }
      await logSignalAudit(db, ctx, {
        action: "Fatores de confiança alterados",
        entityType: "signal.settings",
        entityId: ctx.tenantId,
        target: "Catálogo de fatores de confiança",
        note: `${input.rules.length} fatores, somando 100`,
      });
    });

    revalidatePath("/signal/settings");
    return { rules: input.rules.length };
  });
}

/** Catálogo padrão, para a tela de configurações oferecer o reset. */
export async function getDefaultConfidenceRules(): Promise<
  SignalResult<typeof DEFAULT_CONFIDENCE_RULES>
> {
  return await signalAction(async () => {
    await requireSignalPermissionContext("signal.read");
    return DEFAULT_CONFIDENCE_RULES;
  });
}

export type ConfidenceRuleRow = {
  key: string;
  label: string;
  weight: number;
  order: number;
};

/**
 * Os fatores desta organização — US7.
 *
 * Cai no catálogo padrão quando o tenant nunca configurou. Devolver lista vazia
 * faria a tela de configuração oferecer um formulário em branco cujo primeiro
 * salvamento quebraria a soma 100.
 */
export async function listConfidenceRules(): Promise<
  SignalResult<ConfidenceRuleRow[]>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalConfidenceRule.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { order: "asc" },
      });
      if (rows.length === 0) {
        return DEFAULT_CONFIDENCE_RULES.map((r, i) => ({
          key: r.key,
          label: r.label,
          weight: r.weight,
          order: i,
        }));
      }
      return rows.map((r) => ({
        key: r.key,
        label: r.label,
        weight: r.weight,
        order: r.order,
      }));
    });
  });
}
