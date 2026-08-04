// mutations.test.ts — as quatro mutações restantes de Lean Budget. Todas eram
// tenant-scoped e nada mais: sem guard de papel, sem auditoria, e — o mais
// grave — sem respeitar `immutableAt`.
//
// O carimbo de imutabilidade passou a ser gravado no fecho do PI (story-017
// AC-005, transitionPIPlan → lockLeanBudgets). Um lock que não recusa escrita é
// decoração: o PI fecharia com o orçamento "congelado" e qualquer um seguiria
// editando o valor depois do fato. É isso que estes testes fixam.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
  leanBudgetFindFirst: vi.fn(),
  leanBudgetFindFirstOrThrow: vi.fn(),
  leanBudgetUpdateMany: vi.fn(),
  leanBudgetDeleteMany: vi.fn(),
  leanBudgetCreate: vi.fn(),
  artFindFirst: vi.fn(),
  themeFindFirst: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
  AuthError: MockAuthError,
}));
vi.mock("@repo/database", () => ({
  database: {
    leanBudget: {
      findFirst: mocks.leanBudgetFindFirst,
      findFirstOrThrow: mocks.leanBudgetFindFirstOrThrow,
      updateMany: mocks.leanBudgetUpdateMany,
      deleteMany: mocks.leanBudgetDeleteMany,
      create: mocks.leanBudgetCreate,
    },
    aRT: { findFirst: mocks.artFindFirst },
    strategicTheme: { findFirst: mocks.themeFindFirst },
  },
}));
vi.mock("../../../app/actions/audit/log-audit", () => ({
  logAudit: mocks.logAudit,
}));

import {
  deleteLeanBudget,
  linkBudgetToTheme,
  updateLeanBudget,
  updateSpent,
} from "../../../app/actions/lean-budget";

const BUDGET_ID = "clx3333333333ccccccccccc";
const THEME_ID = "clx2222222222bbbbbbbbbbb";
const rteCtx = { ...tenantCtx, role: "RTE" as const };

const aberto = { id: BUDGET_ID, name: "Budget Pagamentos", immutableAt: null };
const travado = {
  id: BUDGET_ID,
  name: "Budget Pagamentos",
  immutableAt: new Date("2026-03-01T00:00:00.000Z"),
};

describe("mutações de Lean Budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(rteCtx);
    mocks.leanBudgetFindFirst.mockResolvedValue(aberto);
    mocks.leanBudgetFindFirstOrThrow.mockResolvedValue({ id: BUDGET_ID });
    mocks.leanBudgetUpdateMany.mockResolvedValue({ count: 1 });
    mocks.leanBudgetDeleteMany.mockResolvedValue({ count: 1 });
    mocks.themeFindFirst.mockResolvedValue({ id: THEME_ID });
  });

  describe("orçamento travado pelo fecho do PI", () => {
    beforeEach(() => {
      mocks.leanBudgetFindFirst.mockResolvedValue(travado);
    });

    it("recusa updateLeanBudget", async () => {
      const res = await updateLeanBudget(BUDGET_ID, { amount: 999 });

      expect(res.ok).toBe(false);
      if (res.ok) {
        return;
      }
      expect(res.error).toContain("BUDGET_IMMUTABLE");
      expect(mocks.leanBudgetUpdateMany).not.toHaveBeenCalled();
    });

    it("recusa updateSpent", async () => {
      const res = await updateSpent(BUDGET_ID, { spent: 500 });

      expect(res.ok).toBe(false);
      expect(mocks.leanBudgetUpdateMany).not.toHaveBeenCalled();
    });

    it("recusa deleteLeanBudget", async () => {
      const res = await deleteLeanBudget(BUDGET_ID);

      expect(res.ok).toBe(false);
      expect(mocks.leanBudgetDeleteMany).not.toHaveBeenCalled();
    });

    it("recusa linkBudgetToTheme", async () => {
      const res = await linkBudgetToTheme(BUDGET_ID, THEME_ID);

      expect(res.ok).toBe(false);
      expect(mocks.leanBudgetUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("guard de papel", () => {
    beforeEach(() => {
      mocks.requireTenantSession.mockResolvedValue({
        ...tenantCtx,
        role: "DEV",
      });
    });

    it("recusa update de quem não pode", async () => {
      const res = await updateLeanBudget(BUDGET_ID, { amount: 999 });
      expect(res.ok).toBe(false);
      expect(mocks.leanBudgetUpdateMany).not.toHaveBeenCalled();
    });

    it("recusa delete de quem não pode", async () => {
      const res = await deleteLeanBudget(BUDGET_ID);
      expect(res.ok).toBe(false);
      expect(mocks.leanBudgetDeleteMany).not.toHaveBeenCalled();
    });
  });

  describe("caminho feliz", () => {
    it("atualiza e registra na auditoria", async () => {
      const res = await updateLeanBudget(BUDGET_ID, { amount: 2_000_000 });

      expect(res.ok).toBe(true);
      expect(mocks.leanBudgetUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BUDGET_ID, tenantId: rteCtx.tenantId },
        })
      );
      expect(mocks.logAudit).toHaveBeenCalledWith(
        rteCtx.tenantId,
        expect.objectContaining({
          action: "updated",
          entityType: "lean_budget",
          entityId: BUDGET_ID,
        })
      );
    });

    it("apaga e registra na auditoria", async () => {
      const res = await deleteLeanBudget(BUDGET_ID);

      expect(res.ok).toBe(true);
      expect(mocks.logAudit).toHaveBeenCalledWith(
        rteCtx.tenantId,
        expect.objectContaining({
          action: "deleted",
          entityType: "lean_budget",
        })
      );
    });

    it("desvincula o tema sem exigir tema nenhum", async () => {
      const res = await linkBudgetToTheme(BUDGET_ID, null);

      expect(res.ok).toBe(true);
      // null é desvincular: não há FK para conferir.
      expect(mocks.themeFindFirst).not.toHaveBeenCalled();
    });
  });

  it("recusa themeId de outro tenant — guard de IDOR", async () => {
    mocks.themeFindFirst.mockResolvedValue(null);

    const res = await linkBudgetToTheme(BUDGET_ID, THEME_ID);

    expect(res.ok).toBe(false);
    expect(mocks.leanBudgetUpdateMany).not.toHaveBeenCalled();
  });

  it("recusa orçamento de outro tenant", async () => {
    mocks.leanBudgetFindFirst.mockResolvedValue(null);

    const res = await updateLeanBudget(BUDGET_ID, { amount: 999 });

    expect(res.ok).toBe(false);
    expect(mocks.leanBudgetUpdateMany).not.toHaveBeenCalled();
  });
});
