"use server";

import { requireTenantSession } from "@repo/auth/server";
import type { TagRule } from "@repo/database";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "@/app/actions/_base";
import { inngest } from "@/lib/inngest/client";

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
});

export function listTagRules(): Promise<Result<TagRule[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.tagRule.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });
}

export function createTagRule(
  input: z.infer<typeof TagRuleSchema>
): Promise<Result<TagRule>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = TagRuleSchema.parse(input);
    const rule = await database.tagRule.create({
      data: { ...data, tenantId: ctx.tenantId },
    });
    revalidatePath("/portfolio/budgets/tag-rules");
    return rule;
  });
}

export function updateTagRule(
  id: string,
  input: Partial<z.infer<typeof TagRuleSchema>>
): Promise<Result<TagRule>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.tagRule.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("TagRule not found");
    }

    const rule = await database.tagRule.update({
      where: { id },
      data: input,
    });

    await inngest.send({
      name: "billing/remap.requested" as string,
      data: { tenantId: ctx.tenantId, tagRuleId: id },
    });

    revalidatePath("/portfolio/budgets/tag-rules");
    return rule;
  });
}

export function deleteTagRule(
  id: string
): Promise<Result<{ deleted: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    await database.tagRule.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });
    revalidatePath("/portfolio/budgets/tag-rules");
    return { deleted: true };
  });
}
