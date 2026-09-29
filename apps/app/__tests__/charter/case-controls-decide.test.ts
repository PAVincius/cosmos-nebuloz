import { beforeEach, describe, expect, it, vi } from "vitest";

// CH-DEV-06 — a decisão do caso fica bloqueada com controle sem evidência, com
// ajuste pedido ou vencido. Botão desabilitado na tela não protege: o bloqueio
// mora no backend. Só APROVAR e APROVAR COM RESTRIÇÕES são bloqueados; pedir
// mudança e bloquear continuam possíveis (bloquear um caso por falta de controle
// não pode depender de o controle estar pronto).
const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  ucFindUnique: vi.fn(),
  ucUpdate: vi.fn(),
  decisionCreate: vi.fn(),
  ccFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requirePerm,
  requireCharterContext: h.requirePerm,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterUseCase: { findUnique: h.ucFindUnique, update: h.ucUpdate },
      charterDecision: { create: h.decisionCreate },
      charterCaseControl: { findMany: h.ccFindMany },
      auditLog: { create: h.auditCreate },
    }),
}));

import { decideCase } from "@/app/(charter)/actions/cases";

const CTX = {
  tenantId: "t1",
  userId: "u-comp",
  charterRole: "COMPLIANCE",
  user: { name: "Ana", email: "ana@x.test" },
};

const UC = {
  id: "uc1",
  code: "UC-118",
  title: "Triagem de autorizações prévias",
  status: "REVIEW",
  restrictions: [],
  slaTotal: 5,
};

const c = (code: string, state: string) => ({
  code,
  name: `Controle ${code}`,
  state,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requirePerm.mockResolvedValue(CTX);
  h.ucFindUnique.mockResolvedValue(UC);
  h.ucUpdate.mockResolvedValue({ ...UC, status: "APPROVED" });
  h.decisionCreate.mockResolvedValue({});
  h.auditCreate.mockResolvedValue({});
  h.ccFindMany.mockResolvedValue([]);
});

const approve = () =>
  decideCase({
    code: "UC-118",
    outcome: "APPROVED",
    rationale: "Tudo em ordem.",
  });

describe("decideCase com plano de controles", () => {
  it("caso SEM plano de controles decide como sempre (compatível)", async () => {
    const r = await approve();

    expect(r.ok).toBe(true);
  });

  it("aprova com todos os controles aceitos ou dispensados", async () => {
    h.ccFindMany.mockResolvedValue([
      c("TR-1", "ACCEPTED"),
      c("TR-2", "DISPENSED"),
    ]);

    const r = await approve();

    expect(r.ok).toBe(true);
    expect(h.decisionCreate).toHaveBeenCalled();
  });

  it("controles em elaboração ou em revisão não bloqueiam (trabalho em andamento)", async () => {
    h.ccFindMany.mockResolvedValue([
      c("TR-1", "IN_PROGRESS"),
      c("TR-2", "IN_REVIEW"),
    ]);

    const r = await approve();

    expect(r.ok).toBe(true);
  });

  it.each([
    ["sem evidência", "NO_EVIDENCE"],
    ["ajuste pedido", "ADJUSTMENT_REQUESTED"],
    ["vencido", "EXPIRED"],
    ["reaberto", "REOPENED"],
  ])("BLOQUEIA aprovar com controle %s, dizendo qual", async (_n, state) => {
    h.ccFindMany.mockResolvedValue([c("TR-1", "ACCEPTED"), c("TR-2", state)]);

    const r = await approve();

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("x");
    expect(r.error).toContain("TR-2");
    expect(h.ucUpdate).not.toHaveBeenCalled();
    expect(h.decisionCreate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("aprovar COM RESTRIÇÕES também é bloqueado", async () => {
    h.ccFindMany.mockResolvedValue([c("TR-2", "NO_EVIDENCE")]);

    const r = await decideCase({
      code: "UC-118",
      outcome: "RESTRICTED",
      rationale: "Com condições.",
      conditions: ["Revisão humana em 100% dos casos urgentes."],
    });

    expect(r.ok).toBe(false);
    expect(h.decisionCreate).not.toHaveBeenCalled();
  });

  it("a mensagem conta quantos bloqueiam", async () => {
    h.ccFindMany.mockResolvedValue([
      c("TR-1", "NO_EVIDENCE"),
      c("TR-2", "EXPIRED"),
      c("TR-3", "ADJUSTMENT_REQUESTED"),
    ]);

    const r = await approve();

    if (r.ok) throw new Error("x");
    expect(r.error).toMatch(/3 controle/);
  });

  it("pedir mudança segue possível com controle pendente", async () => {
    h.ccFindMany.mockResolvedValue([c("TR-2", "NO_EVIDENCE")]);

    const r = await decideCase({
      code: "UC-118",
      outcome: "CHANGES",
      rationale: "Faltam controles.",
      changeRequest: "Anexar a evidência do rollback.",
    });

    expect(r.ok).toBe(true);
  });

  it("bloquear o caso segue possível com controle pendente", async () => {
    h.ccFindMany.mockResolvedValue([c("TR-2", "NO_EVIDENCE")]);

    const r = await decideCase({
      code: "UC-118",
      outcome: "BLOCKED",
      rationale: "Sem controle não há uso.",
      blockReason: "Risco sem mitigação.",
    });

    expect(r.ok).toBe(true);
  });

  it("consulta só os controles deste caso e tenant", async () => {
    await approve();

    expect(h.ccFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1", useCaseId: "uc1" },
      })
    );
  });
});
