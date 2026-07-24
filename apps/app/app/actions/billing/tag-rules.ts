"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import type { Prisma, TagRule } from "@repo/database";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "@/app/actions/_base";
import { logAudit } from "@/app/actions/audit";
import { inngest } from "@/lib/inngest/client";

// Condition operand used by the portfolio "Tag Rules" screen
// (cosmos.html screen-tags) to render "SE <field> <operator> <value>".
const TagRuleConditionSchema = z.object({
  field: z.string().min(1).max(80),
  operator: z.enum(["eq", "contains", "gte", "lte"]),
  value: z.string().min(1).max(120),
});

export type TagRuleCondition = z.infer<typeof TagRuleConditionSchema>;

export const TAG_RULE_OUTPUT_TONES = [
  "green",
  "red",
  "amber",
  "blue",
  "purple",
  "accent",
] as const;

const TagRuleSchema = z.object({
  name: z.string().max(255).optional(),
  integrationId: z.string().cuid().optional(),
  tagKey: z.string().max(255).optional(),
  tagValue: z.string().max(255).optional(),
  matchType: z.enum(["EXACT", "ACCOUNT"]),
  themeId: z.string().cuid().optional(),
  artId: z.string().cuid().optional(),
  epicId: z.string().cuid().optional(),
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
  // cosmos.html screen-tags — portfolio automation display fields
  scope: z.string().max(255).optional(),
  outputTag: z.string().max(60).optional(),
  outputTagTone: z.enum(TAG_RULE_OUTPUT_TONES).optional(),
  conditions: z.array(TagRuleConditionSchema).max(10).optional(),
});

export async function listTagRules(): Promise<Result<TagRule[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.tagRule.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });
}

export async function createTagRule(
  input: z.infer<typeof TagRuleSchema>
): Promise<Result<TagRule>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const data = TagRuleSchema.parse(input);
    const rule = await database.tagRule.create({
      data: {
        ...data,
        conditions: data.conditions as Prisma.InputJsonValue | undefined,
        tenantId: ctx.tenantId,
      },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "TagRule",
      entityId: rule.id,
      diff: { name: rule.name, scope: rule.scope, outputTag: rule.outputTag },
    });

    revalidatePath("/portfolio/budgets/tag-rules");
    revalidatePath("/portfolio/tags");
    return rule;
  });
}

export async function updateTagRule(
  id: string,
  input: Partial<z.infer<typeof TagRuleSchema>>
): Promise<Result<TagRule>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);

    const existing = await database.tagRule.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("TagRule not found");
    }

    const data = TagRuleSchema.partial().parse(input);

    const rule = await database.tagRule.update({
      where: { id },
      data: {
        ...data,
        conditions: data.conditions as Prisma.InputJsonValue | undefined,
      },
    });

    await inngest.send({
      name: "billing/remap.requested" as string,
      data: { tenantId: ctx.tenantId, tagRuleId: id },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "TagRule",
      entityId: rule.id,
      diff: data,
    });

    revalidatePath("/portfolio/budgets/tag-rules");
    revalidatePath("/portfolio/tags");
    return rule;
  });
}

export async function deleteTagRule(
  id: string
): Promise<Result<{ deleted: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    await database.tagRule.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "deleted",
      entityType: "TagRule",
      entityId: id,
    });

    revalidatePath("/portfolio/budgets/tag-rules");
    revalidatePath("/portfolio/tags");
    return { deleted: true };
  });
}
