import { z } from "zod";
import type { LeanBudget } from "@repo/database";
import {
  nnStr,
  optCuid,
} from "@/app/actions/_base";

export const GuardrailsSchema = z
  .object({
    capex: z.number().nonnegative(),
    opex:  z.number().nonnegative(),
  })
  .optional();

export const CreateBudgetSchema = z.object({
  artId:      optCuid,
  themeId:    optCuid,
  name:       nnStr,
  amount:     z.number().positive().finite(),
  spent:      z.number().nonnegative().finite().default(0),
  period:     z.string().min(1).max(20),
  guardrails: GuardrailsSchema,
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial().omit({ artId: true, themeId: true });

export const UpdateSpentSchema = z.object({
  spent: z.number().nonnegative().finite(),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
export type GuardrailsInput   = z.infer<typeof GuardrailsSchema>;

export type LeanBudgetWithStats = LeanBudget & {
  percentUsed:      number;        // (spent / amount) * 100
  isOverBudget:     boolean;       // spent > amount
  isNearLimit:      boolean;       // percentUsed > 80
  capexRemaining?:  number;
  opexRemaining?:   number;
};

export type LeanBudgetWithUsage = LeanBudgetWithStats & {
  /** @deprecated use isNearLimit */
  isOverGuardrail: boolean;
  guardrails: { capex: number; opex: number } | null;
};
