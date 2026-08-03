// risks.test.tsx — registro ROAM do ART (/cosmos/risks). Cobre os critérios da
// story-059 visíveis na tela: AC-001 (guard do desfecho antes de chamar o
// servidor), AC-002 (transição pela tela e recarga), AC-004 (matriz 5×5 com o
// valor legado ainda posicionado) e AC-005 (vazio e erro sem risco fabricado).
// Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRisksMock = vi.fn();
const roamTransitionMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/risks", () => ({
  listRisks: (...args: unknown[]) => listRisksMock(...args),
  roamTransition: (...args: unknown[]) => roamTransitionMock(...args),
  createRisk: vi.fn(),
}));

// O seletor de dono do risco reusa a lista de membros do tenant que a tela de
// Settings já consome — mockada aqui para a cadeia de import nunca tocar
// @repo/auth/server sob o env de cliente.
const getMembersTabMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-members", () => ({
  getMembersTab: (...args: unknown[]) => getMembersTabMock(...args),
}));

import RisksScreen from "../../components/cosmos/screens/risks";

const risk = (over: Record<string, unknown>) => ({
  id: "rk-00000000",
  title: "Risco X",
  roamStatus: "UNCLASSIFIED",
  severity: 3,
  probability: "medium",
  impact: "medium",
  category: "TECHNICAL",
  ownerName: "—",
  ...over,
});

describe("RisksScreen", () => {
  beforeEach(() => {
    listRisksMock.mockReset();
    roamTransitionMock.mockReset();
    getMembersTabMock.mockReset();
    getMembersTabMock.mockResolvedValue({
      ok: true,
      data: {
        members: [
          {
            id: "m1",
            userId: "u1",
            name: "Marina Alves",
            email: "m@x.com",
            image: null,
            role: "RTE",
          },
        ],
        currentUserRole: "RTE",
        currentUserId: "u1",
      },
    });
  });

  it("desenha a matriz 5×5 e posiciona o risco na célula do seu par (AC-004)", async () => {
    listRisksMock.mockResolvedValueOnce({
      ok: true,
      data: [
        risk({
          id: "rk-extremo",
          title: "Fornecedor único de KYC",
          probability: "very_high",
          impact: "very_high",
        }),
      ],
    });

    const { container } = render(<RisksScreen />);
    await screen.findByText("Fornecedor único de KYC");

    expect(container.querySelectorAll("[data-cell]")).toHaveLength(25);
    expect(
      container.querySelector('[data-cell="very_high-very_high"]')?.textContent
    ).toContain("rk-ext");
    expect(
      container.querySelector('[data-cell="very_low-very_low"]')?.textContent
    ).toBe("");
  });

  it("mantém o valor legado high na coluna Alta (AC-004)", async () => {
    listRisksMock.mockResolvedValueOnce({
      ok: true,
      data: [
        risk({
          id: "rk-legado",
          title: "Latência do antifraude",
          probability: "high",
          impact: "high",
        }),
      ],
    });

    const { container } = render(<RisksScreen />);
    await screen.findByText("Latência do antifraude");

    expect(
      container.querySelector('[data-cell="high-high"]')?.textContent
    ).toContain("rk-leg");
  });

  it("conta os riscos sem classificação ROAM (AC-002)", async () => {
    listRisksMock.mockResolvedValueOnce({
      ok: true,
      data: [
        risk({ id: "rk-1", title: "Sem desfecho" }),
        risk({ id: "rk-2", title: "Com desfecho", roamStatus: "ACCEPTED" }),
      ],
    });

    render(<RisksScreen />);

    expect(await screen.findByText("1 sem classificação ROAM")).toBeTruthy();
  });

  it("não chama o servidor quando OWNED é escolhido sem dono (AC-001)", async () => {
    listRisksMock.mockResolvedValueOnce({
      ok: true,
      data: [risk({ id: "rk-1", title: "Sem desfecho" })],
    });

    render(<RisksScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Classificar ROAM de Sem desfecho",
      })
    );
    fireEvent.change(screen.getByLabelText("Desfecho ROAM"), {
      target: { value: "OWNED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gravar desfecho" }));

    await waitFor(() => expect(getMembersTabMock).toHaveBeenCalled());
    expect(roamTransitionMock).not.toHaveBeenCalled();
  });

  it("grava o desfecho pela tela e recarrega a lista (AC-002)", async () => {
    listRisksMock
      .mockResolvedValueOnce({
        ok: true,
        data: [risk({ id: "rk-1", title: "Sem desfecho" })],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          risk({
            id: "rk-1",
            title: "Sem desfecho",
            roamStatus: "ACCEPTED",
          }),
        ],
      });
    roamTransitionMock.mockResolvedValue({
      ok: true,
      data: { id: "rk-1", roamStatus: "ACCEPTED" },
    });

    render(<RisksScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Classificar ROAM de Sem desfecho",
      })
    );
    fireEvent.change(screen.getByLabelText("Desfecho ROAM"), {
      target: { value: "ACCEPTED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gravar desfecho" }));

    await waitFor(() =>
      expect(roamTransitionMock).toHaveBeenCalledWith({
        riskId: "rk-1",
        roamStatus: "ACCEPTED",
      })
    );
    await waitFor(() => expect(listRisksMock).toHaveBeenCalledTimes(2));
  });

  it("mostra o estado vazio quando o tenant não tem risco (AC-005)", async () => {
    listRisksMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<RisksScreen />);

    expect(await screen.findByText("Nenhum risco registrado")).toBeTruthy();
    expect(screen.queryByText("Classificar ROAM de Sem desfecho")).toBeNull();
  });

  it("mostra o estado de erro e nenhum risco quando listRisks falha (AC-005)", async () => {
    listRisksMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<RisksScreen />);

    expect(await screen.findByText("boom")).toBeTruthy();
    expect(screen.queryByText("Nenhum risco registrado")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Latência do antifraude");
  });
});
