// workflows.test.tsx — Workflows (/cosmos/workflows). Cobre os critérios da
// story-059 visíveis na tela: AC-004 (escopo por linha e aviso de substituição
// só quando ela vai acontecer) e AC-005 (vazio e erro sem automação
// fabricada), mais o caminho de toggle. Asserção sobre conteúdo — sem
// snapshot: o audit de 2026-07-23 mostrou que casca passa em snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listWorkflowsMock = vi.fn();
const toggleWorkflowActiveMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/workflows", () => ({
  listWorkflows: (...args: unknown[]) => listWorkflowsMock(...args),
  toggleWorkflowActive: (...args: unknown[]) =>
    toggleWorkflowActiveMock(...args),
}));

import WorkflowsScreen from "../../components/cosmos/screens/workflows";

const wf = (over: Record<string, unknown>) => ({
  id: "wf-x",
  name: "Workflow X",
  entityType: "FEATURE",
  ownerType: "ART",
  ownerId: "art-1",
  triggerLabel: "Ao mover para Review",
  actionCount: 3,
  runCount: 12,
  active: false,
  activatedAt: null,
  ...over,
});

describe("WorkflowsScreen", () => {
  beforeEach(() => {
    // mockReset e não clearAllMocks: só o reset esvazia a fila de
    // mockResolvedValueOnce, e um `once` sobrando vaza para o teste seguinte.
    listWorkflowsMock.mockReset();
    toggleWorkflowActiveMock.mockReset();
  });

  it("mostra o escopo de cada automação — sem ele 'ativo' não quer dizer nada (AC-004)", async () => {
    listWorkflowsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        wf({ id: "w1", name: "Aprovação de Feature", active: true }),
        wf({
          id: "w2",
          name: "Escalonamento de Story",
          entityType: "STORY",
          ownerType: "TEAM",
          ownerId: "team-1",
        }),
      ],
    });

    render(<WorkflowsScreen />);

    expect(await screen.findByText("FEATURE · ART")).toBeTruthy();
    expect(screen.getByText("STORY · TEAM")).toBeTruthy();
  });

  it("avisa qual automação será substituída ao ativar no mesmo escopo (AC-004)", async () => {
    listWorkflowsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        wf({ id: "w1", name: "Aprovação v1", active: true }),
        wf({ id: "w2", name: "Aprovação v2", active: false }),
      ],
    });

    render(<WorkflowsScreen />);
    await screen.findByText("Aprovação v2");

    expect(
      screen.getByRole("button", {
        name: "Ativar Aprovação v2 (substitui Aprovação v1)",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Desativar Aprovação v1" })
    ).toBeTruthy();
  });

  it("não anuncia substituição quando o escopo não tem nenhuma ativa (AC-004)", async () => {
    listWorkflowsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        wf({ id: "w1", name: "Aprovação v1", active: true }),
        wf({
          id: "w2",
          name: "Escalonamento de Story",
          entityType: "STORY",
          ownerType: "TEAM",
          ownerId: "team-1",
          active: false,
        }),
      ],
    });

    render(<WorkflowsScreen />);
    await screen.findByText("Escalonamento de Story");

    expect(
      screen.getByRole("button", { name: "Ativar Escalonamento de Story" })
    ).toBeTruthy();
  });

  it("ativa pela tela e recarrega a lista", async () => {
    listWorkflowsMock
      .mockResolvedValueOnce({
        ok: true,
        data: [wf({ id: "w2", name: "Aprovação v2", active: false })],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [wf({ id: "w2", name: "Aprovação v2", active: true })],
      });
    toggleWorkflowActiveMock.mockResolvedValue({
      ok: true,
      data: { id: "w2", active: true, deactivated: 0 },
    });

    render(<WorkflowsScreen />);
    await screen.findByText("Aprovação v2");

    fireEvent.click(
      screen.getByRole("button", { name: "Ativar Aprovação v2" })
    );

    await waitFor(() =>
      expect(toggleWorkflowActiveMock).toHaveBeenCalledWith({
        id: "w2",
        active: true,
      })
    );
    await waitFor(() => expect(listWorkflowsMock).toHaveBeenCalledTimes(2));
  });

  it("mostra o estado vazio quando o tenant não tem automação (AC-005)", async () => {
    listWorkflowsMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<WorkflowsScreen />);

    expect(await screen.findByText("Nenhum workflow")).toBeTruthy();
  });

  it("mostra o estado de erro e nenhuma automação quando listWorkflows falha (AC-005)", async () => {
    listWorkflowsMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<WorkflowsScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os workflows.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Nenhum workflow")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Aprovação");
  });
});
