// dependencies.test.tsx — mapa de bloqueios entre times (/cosmos/dependencies).
// Cobre os critérios da story-058 visíveis na tela: AC-004 (estado do bloqueio
// em palavra e avanço pela tela) e AC-005 (vazio e erro sem dependência
// fabricada). Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listDependenciesMock = vi.fn();
const updateDependencyBoardStatusMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/dependencies", () => ({
  listDependencies: (...args: unknown[]) => listDependenciesMock(...args),
  updateDependencyBoardStatus: (...args: unknown[]) =>
    updateDependencyBoardStatusMock(...args),
  createDependency: vi.fn(),
}));

// NewDependencyModal puxa EntityLinkField, que importa a server action
// entity-search no escopo do módulo.
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

import DependenciesScreen from "../../components/cosmos/screens/dependencies";

const dep = (over: Record<string, unknown>) => ({
  id: "d1",
  title: "Fila depende do isolamento",
  blockingTitle: "Isolamento de tenant",
  blockedTitle: "Fila de eventos",
  status: "at-risk",
  boardStatus: "IDENTIFIED",
  criticalPath: false,
  fromTeamId: "tm1",
  fromTeamName: "Squad Atlas",
  fromTeamColor: "#6366f1",
  toTeamId: "tm2",
  toTeamName: "Squad Orion",
  toTeamColor: "#f59e0b",
  ...over,
});

describe("DependenciesScreen", () => {
  beforeEach(() => {
    listDependenciesMock.mockReset();
    updateDependencyBoardStatusMock.mockReset();
  });

  it("mostra o estado do bloqueio em palavra, não só o status legado (AC-004)", async () => {
    listDependenciesMock.mockResolvedValueOnce({
      ok: true,
      data: [
        dep({ id: "d1", boardStatus: "IDENTIFIED" }),
        dep({ id: "d2", boardStatus: "IN_PROGRESS" }),
        dep({ id: "d3", boardStatus: "RESOLVED" }),
      ],
    });

    render(<DependenciesScreen />);

    expect(await screen.findByText("Identificada")).toBeTruthy();
    expect(screen.getByText("Em resolução")).toBeTruthy();
    expect(screen.getByText("Resolvida")).toBeTruthy();
  });

  it("avança o estado pela tela e recarrega a lista (AC-004)", async () => {
    listDependenciesMock
      .mockResolvedValueOnce({
        ok: true,
        data: [dep({ id: "d1", boardStatus: "IDENTIFIED" })],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [dep({ id: "d1", boardStatus: "IN_PROGRESS" })],
      });
    updateDependencyBoardStatusMock.mockResolvedValue({
      ok: true,
      data: { id: "d1" },
    });

    render(<DependenciesScreen />);
    await screen.findByText("Identificada");

    fireEvent.click(screen.getByRole("button", { name: "Iniciar resolução" }));

    await waitFor(() =>
      expect(updateDependencyBoardStatusMock).toHaveBeenCalledWith({
        id: "d1",
        boardStatus: "IN_PROGRESS",
      })
    );
    await waitFor(() => expect(listDependenciesMock).toHaveBeenCalledTimes(2));
  });

  it("não oferece próximo passo para uma dependência resolvida (AC-004)", async () => {
    listDependenciesMock.mockResolvedValueOnce({
      ok: true,
      data: [dep({ id: "d1", boardStatus: "RESOLVED" })],
    });

    render(<DependenciesScreen />);

    await screen.findByText("Resolvida");
    expect(
      screen.queryByRole("button", { name: "Iniciar resolução" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Marcar resolvida" })
    ).toBeNull();
  });

  it("mostra o estado vazio quando o tenant não tem dependência (AC-005)", async () => {
    listDependenciesMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<DependenciesScreen />);

    expect(
      await screen.findByText("Nenhuma dependência registrada")
    ).toBeTruthy();
  });

  it("mostra o estado de erro e nenhuma dependência quando listDependencies falha (AC-005)", async () => {
    listDependenciesMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<DependenciesScreen />);

    await waitFor(() =>
      expect(screen.queryByText("Nenhuma dependência registrada")).toBeNull()
    );
    expect(document.body.innerHTML).not.toContain("Fila depende do isolamento");
  });
});
