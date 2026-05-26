import { logDecision } from "./decision-log";

export async function logBudgetChange(
  ctx: { tenantId: string; userId: string },
  args: {
    budgetId: string;
    oldAmount: number;
    newAmount: number;
    justificativa: string;
    valueStreamId?: string;
  },
) {
  return logDecision(ctx, {
    tipo: "budget_decision",
    targetType: "guardrail",
    targetId: args.budgetId,
    valueStreamId: args.valueStreamId,
    decisao: `Budget changed ${args.oldAmount} -> ${args.newAmount}`,
    justificativa: args.justificativa,
    dadosSuporte: {
      delta: args.newAmount - args.oldAmount,
      deltaPct:
        args.oldAmount !== 0
          ? ((args.newAmount - args.oldAmount) / args.oldAmount) * 100
          : null,
    },
  });
}

export async function logThemeChange(
  ctx: { tenantId: string; userId: string },
  args: {
    themeId: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    justificativa: string;
  },
) {
  return logDecision(ctx, {
    tipo: "theme_decision",
    targetType: "theme",
    targetId: args.themeId,
    decisao: `Theme ${args.field} changed`,
    justificativa: args.justificativa,
    dadosSuporte: {
      field: args.field,
      before: args.oldValue,
      after: args.newValue,
    },
  });
}
