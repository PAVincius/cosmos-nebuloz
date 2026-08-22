import type { LeanBudget } from "@repo/database";
import { z } from "zod";
import { nnStr, optCuid } from "@/app/actions/_base";

const GuardrailsSchema = z
  .object({
    capex: z.number().nonnegative(),
    opex: z.number().nonnegative(),
  })
  .optional();

export const CreateBudgetSchema = z.object({
  artId: optCuid,
  themeId: optCuid,
  name: nnStr,
  amount: z.number().positive().finite(),
  spent: z.number().nonnegative().finite().default(0),
  period: z.string().min(1).max(20),
  guardrails: GuardrailsSchema,
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial().omit({
  artId: true,
  themeId: true,
});

export const UpdateSpentSchema = z.object({
  spent: z.number().nonnegative().finite(),
});

type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
type GuardrailsInput = z.infer<typeof GuardrailsSchema>;

export type LeanBudgetWithStats = Omit<
  LeanBudget,
  "spent" | "spentManualOverride"
> & {
  spentDecimal: number | null;
  spentManualOverride: number | null;
  percentUsed: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  capexRemaining?: number;
  opexRemaining?: number;
};

export type LeanBudgetWithUsage = LeanBudgetWithStats & {
  /** @deprecated use isNearLimit */
  isOverGuardrail: boolean;
  guardrails: { capex: number; opex: number } | null;
};
