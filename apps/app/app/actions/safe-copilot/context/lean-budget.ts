import { database } from "@repo/database";

export type LeanBudgetContext = {
  themes: Array<{
    id: string;
    code: string | null;
    title: string;
    status: string;
    budgetTotal: number | null;
    epicsCount: number;
  }>;
  leanBudgets: Array<{
    id: string;
    name: string;
    amount: number;
    spent: number;
    period: string;
    artId: string | null;
  }>;
  governedEpics: Array<{
    id: string;
    epicTitle: string;
    investmentEstimate: number | null;
    governanceStatus: string;
    valueStreamId: string | null;
  }>;
};

export async function buildLeanBudgetContext(
  tenantId: string,
  contextRef: { vsId?: string }
): Promise<LeanBudgetContext> {
  const { vsId } = contextRef;

  const [themes, leanBudgets, governedEpics] = await Promise.all([
    database.strategicTheme.findMany({
      where: { tenantId, status: { in: ["ACTIVE", "APPROVED", "ANALYSIS"] } },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        budgetTotal: true,
        _count: { select: { epics: true } },
      },
      take: 15,
    }),

    database.leanBudget.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        amount: true,
        spent: true,
        period: true,
        artId: true,
      },
      take: 20,
    }),

    database.governedEpic.findMany({
      where: {
        tenantId,
        ...(vsId ? { valueStreamId: vsId } : {}),
      },
      include: { epic: { select: { title: true } } },
      take: 15,
    }),
  ]);

  return {
    themes: themes.map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      budgetTotal: t.budgetTotal,
      epicsCount: t._count.epics,
    })),
    leanBudgets: leanBudgets.map((b) => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      spent: b.spent,
      period: b.period,
      artId: b.artId,
    })),
    governedEpics: governedEpics.map((ge) => ({
      id: ge.id,
      epicTitle: ge.epic.title,
      investmentEstimate: ge.investmentEstimate,
      governanceStatus: ge.governanceStatus,
      valueStreamId: ge.valueStreamId,
    })),
  };
}
