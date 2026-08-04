// create.test.ts — createLeanBudget era a única forma de criar um Lean Budget
// no sistema e não tinha chamador nenhum. Ao ligá-la numa tela (story-062) ela
// deixa de ser código morto e passa a ser superfície de escrita, então precisa
// dos três guards que o resto do repo aplica e que faltavam aqui: papel
// (LeanBudget.create = RTE, ADMIN por cima), IDOR nos FKs vindos do cliente
// (artId/themeId) e trilha de auditoria.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthError, tenantCtx } from "../../helpers/action-mocks";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireTenantSession: vi.fn(),
  revalidatePath: vi.fn(),
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
    leanBudget: { create: mocks.leanBudgetCreate },
    aRT: { findFirst: mocks.artFindFirst },
    strategicTheme: { findFirst: mocks.themeFindFirst },
  },
}));
vi.mock("../../../app/actions/audit/log-audit", () => ({
  logAudit: mocks.logAudit,
}));

import { createLeanBudget } from "../../../app/actions/lean-budget";

const ART_ID = "clx1111111111aaaaaaaaaaa";
const THEME_ID = "clx2222222222bbbbbbbbbbb";
const rteCtx = { ...tenantCtx, role: "RTE" as const };

const entrada = (over: Record<string, unknown> = {}) => ({
  name: "Budget Pagamentos",
  amount: 1_000_000,
  period: "PI-2026-Q1",
  ...over,
});

describe("createLeanBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.requireTenantSession.mockResolvedValue(rteCtx);
    mocks.leanBudgetCreate.mockResolvedValue({ id: "lb-1" });
    mocks.artFindFirst.mockResolvedValue({ id: ART_ID });
    mocks.themeFindFirst.mockResolvedValue({ id: THEME_ID });
  });

  it("grava com o tenantId da sessão", async () => {
    const res = await createLeanBudget(entrada());

    expect(res.ok).toBe(true);
    expect(mocks.leanBudgetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: rteCtx.tenantId,
        name: "Budget Pagamentos",
        amount: 1_000_000,
      }),
    });
  });

  it("recusa papel sem permissão de criar orçamento", async () => {
    mocks.requireTenantSession.mockResolvedValue({
      ...tenantCtx,
      role: "DEV",
    });

    const res = await createLeanBudget(entrada());

    expect(res.ok).toBe(false);
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });

  it("recusa artId de outro tenant — guard de IDOR", async () => {
    mocks.artFindFirst.mockResolvedValue(null);

    const res = await createLeanBudget(entrada({ artId: ART_ID }));

    expect(res.ok).toBe(false);
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });

  it("recusa themeId de outro tenant — guard de IDOR", async () => {
    mocks.themeFindFirst.mockResolvedValue(null);

    const res = await createLeanBudget(entrada({ themeId: THEME_ID }));

    expect(res.ok).toBe(false);
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });

  it("confirma o tenant dos dois FKs quando ambos vêm preenchidos", async () => {
    await createLeanBudget(entrada({ artId: ART_ID, themeId: THEME_ID }));

    expect(mocks.artFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ART_ID, tenantId: rteCtx.tenantId },
      })
    );
    expect(mocks.themeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: THEME_ID, tenantId: rteCtx.tenantId },
      })
    );
  });

  it("registra na trilha de auditoria — orçamento é dinheiro", async () => {
    await createLeanBudget(entrada());

    expect(mocks.logAudit).toHaveBeenCalledWith(
      rteCtx.tenantId,
      expect.objectContaining({
        userId: rteCtx.userId,
        action: "created",
        entityType: "lean_budget",
        entityId: "lb-1",
      })
    );
  });

  it("recusa valor não-positivo", async () => {
    const res = await createLeanBudget(entrada({ amount: 0 }));

    expect(res.ok).toBe(false);
    expect(mocks.leanBudgetCreate).not.toHaveBeenCalled();
  });
});
