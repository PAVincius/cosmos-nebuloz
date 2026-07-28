"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { ANOMALY_RULES, validateThresholdInBounds } from "@/lib/anomaly/rules";
import { type Result, safeAction } from "../_base";

// ─── setRuleThreshold ─────────────────────────────────────────────────────────

const setRuleThresholdSchema = z.object({
  ruleId: z.string().min(1),
  artId: z.string().optional(),
  threshold: z.number(),
});

export async function setRuleThreshold(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());
    const input = setRuleThresholdSchema.parse(raw);

    const rule = ANOMALY_RULES[input.ruleId];
    if (!rule) {
      throw new Error(`UNKNOWN_RULE: ${input.ruleId}`);
    }

    // AC-006: CRITICAL rules non-disablable — also non-configurable threshold
    if (rule.critical) {
      throw new Error(`CRITICAL_RULE_NON_DISABLABLE: ruleId=${input.ruleId}`);
    }

    // AC-005: validate within platform bounds
    const { valid, bounds } = validateThresholdInBounds(
      input.ruleId,
      input.threshold
    );
    if (!valid) {
      throw new Error(
        `THRESHOLD_OUT_OF_BOUNDS: ruleId=${input.ruleId} min=${bounds?.min} max=${bounds?.max} value=${input.threshold}`
      );
    }

    const config = await database.anomalyRuleConfig.upsert({
      where: {
        tenantId_artId_ruleId: {
          tenantId,
          artId: input.artId ?? "",
          ruleId: input.ruleId,
        },
      },
      create: {
        tenantId,
        artId: input.artId,
        ruleId: input.ruleId,
        threshold: input.threshold,
      },
      update: { threshold: input.threshold },
      select: { id: true },
    });

    revalidatePath("/");
    return { id: config.id };
  });
}

// ─── disableRule ──────────────────────────────────────────────────────────────

const disableRuleSchema = z.object({
  ruleId: z.string().min(1),
  artId: z.string().optional(),
});

export async function disableRule(
  raw: unknown
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = disableRuleSchema.parse(raw);

    const rule = ANOMALY_RULES[input.ruleId];
    if (!rule) {
      throw new Error(`UNKNOWN_RULE: ${input.ruleId}`);
    }

    // AC-006: CRITICAL rules non-disablable
    if (rule.critical) {
      throw new Error(`CRITICAL_RULE_NON_DISABLABLE: ruleId=${input.ruleId}`);
    }

    const config = await database.anomalyRuleConfig.upsert({
      where: {
        tenantId_artId_ruleId: {
          tenantId,
          artId: input.artId ?? "",
          ruleId: input.ruleId,
        },
      },
      create: {
        tenantId,
        artId: input.artId,
        ruleId: input.ruleId,
        threshold: rule.defaultThreshold,
        isDisabled: true,
      },
      update: { isDisabled: true },
      select: { id: true },
    });

    await database.auditLog.create({
      data: {
        tenantId,
        action: "ANOMALY_RULE_DISABLED",
        entityType: "AnomalyRuleConfig",
        entityId: config.id,
        userId,
        metadata: { ruleId: input.ruleId, artId: input.artId },
      },
    });

    revalidatePath("/");
    return { id: config.id };
  });
}

// ─── resetRuleThreshold ───────────────────────────────────────────────────────

const resetRuleThresholdSchema = z.object({
  ruleId: z.string().min(1),
  artId: z.string().optional(),
});

export async function resetRuleThreshold(
  raw: unknown
): Promise<Result<{ deleted: boolean }>> {
  return safeAction(async () => {
    const { tenantId, userId } = await requireTenantSession(await headers());
    const input = resetRuleThresholdSchema.parse(raw);

    // AC-008: delete override → next run uses platform default
    const result = await database.anomalyRuleConfig.deleteMany({
      where: { tenantId, ruleId: input.ruleId, artId: input.artId ?? null },
    });

    if (result.count > 0) {
      await database.auditLog.create({
        data: {
          tenantId,
          action: "ANOMALY_RULE_RESET",
          entityType: "AnomalyRuleConfig",
          entityId: input.ruleId,
          userId,
          metadata: { ruleId: input.ruleId, artId: input.artId },
        },
      });
    }

    revalidatePath("/");
    return { deleted: result.count > 0 };
  });
}
