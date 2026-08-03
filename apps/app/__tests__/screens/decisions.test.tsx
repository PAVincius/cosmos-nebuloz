// decisions.test.tsx — Decision Log (/cosmos/decisions). Cobre os critérios da
// story-054 visíveis na tela: AC-005 (lista real, vazio, erro) e o gatilho de
// export do AC-003/AC-004. Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listDecisionsMock = vi.fn();
const exportDecisionLogMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/decisions", () => ({
  listDecisions: (...args: unknown[]) => listDecisionsMock(...args),
  exportDecisionLog: (...args: unknown[]) => exportDecisionLogMock(...args),
  createDecision: vi.fn(),
}));

// NewDecisionModal é importado estaticamente por decisions.tsx e puxa
// EntityLinkField, que importa a server action de busca no escopo do módulo —
// sem este mock a cadeia de import encosta em @repo/auth/server sob o guard de
// ambiente cliente do vitest.
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

import DecisionsScreen from "../../components/cosmos/screens/decisions";

const decision = (over: Record<string, unknown>) => ({
  id: "d1",
  titulo: "Aprovar migração multi-tenant",
  decisao: "approved",
  justificativa: "Reduz dívida técnica crítica.",
  tipo: "epic_decision",
  dataDecisao: "2026-02-10T12:00:00.000Z",
  tags: ["tech-debt"],
  decisorName: "Helena Souza",
  ...over,
});

describe("DecisionsScreen", () => {
  beforeEach(() => {
    listDecisionsMock.mockReset();
    exportDecisionLogMock.mockReset();
    // jsdom não implementa createObjectURL; o download é efeito de browser e
    // não é o que este teste observa.
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("renderiza as decisões reais devolvidas por listDecisions (AC-005)", async () => {
    listDecisionsMock.mockResolvedValue({ ok: true, data: [decision({})] });

    render(<DecisionsScreen />);

    expect(
      await screen.findByText("Aprovar migração multi-tenant")
    ).toBeTruthy();
    expect(screen.getByText("Reduz dívida técnica crítica.")).toBeTruthy();
    expect(screen.getByText("Helena Souza")).toBeTruthy();
  });

  it("mostra o estado vazio e esconde o export quando não há decisão (AC-005)", async () => {
    listDecisionsMock.mockResolvedValue({ ok: true, data: [] });

    render(<DecisionsScreen />);

    expect(await screen.findByText("Nenhuma decisão registrada.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Exportar JSON/ })).toBeNull();
  });

  it("mostra o erro e nenhuma decisão quando listDecisions falha (AC-005)", async () => {
    listDecisionsMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<DecisionsScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar as decisões.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Aprovar migração multi-tenant")).toBeNull();
    expect(screen.queryByRole("button", { name: /Exportar JSON/ })).toBeNull();
  });

  it("dispara exportDecisionLog no clique de exportar (AC-003/AC-004)", async () => {
    listDecisionsMock.mockResolvedValue({ ok: true, data: [decision({})] });
    exportDecisionLogMock.mockResolvedValue({
      ok: true,
      data: {
        exportedAt: "2026-08-03T00:00:00.000Z",
        exportedBy: { id: "user-test", name: "Helena Souza" },
        tenantId: "tenant-test",
        totalEntries: 1,
        entries: [],
      },
    });

    render(<DecisionsScreen />);
    await screen.findByText("Aprovar migração multi-tenant");

    fireEvent.click(screen.getByRole("button", { name: /Exportar JSON/ }));

    await waitFor(() => expect(exportDecisionLogMock).toHaveBeenCalledTimes(1));
  });
});
