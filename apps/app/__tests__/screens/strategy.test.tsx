// strategy.test.tsx — Strategy Map (/cosmos/strategy). Cobre os critérios da
// story-060 visíveis na tela: AC-001 (vincular tema a pilar pela tela), AC-002
// (faixa de desalinhados que nomeia os temas e some quando não há nenhum),
// AC-003 (rollup sem épico mensurável é "—", nunca 0%) e AC-004 (vazio e erro
// distintos). Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listStrategyPillarsMock = vi.fn();
const listUnlinkedThemesMock = vi.fn();
const assignThemeToPillarMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/strategy", () => ({
  listStrategyPillars: (...args: unknown[]) => listStrategyPillarsMock(...args),
  listUnlinkedThemes: (...args: unknown[]) => listUnlinkedThemesMock(...args),
  assignThemeToPillar: (...args: unknown[]) => assignThemeToPillarMock(...args),
  createPillar: vi.fn(),
}));

import StrategyScreen from "../../components/cosmos/screens/strategy";

const pillar = (over: Record<string, unknown>) => ({
  id: "p-x",
  name: "Pilar X",
  tone: "accent",
  themes: [],
  epicCount: 0,
  avgProgress: null,
  ...over,
});

describe("StrategyScreen", () => {
  beforeEach(() => {
    listStrategyPillarsMock.mockReset();
    listUnlinkedThemesMock.mockReset();
    assignThemeToPillarMock.mockReset();
    listUnlinkedThemesMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("mostra '—' no pilar sem épico mensurável, nunca 0% (AC-003)", async () => {
    listStrategyPillarsMock.mockResolvedValue({
      ok: true,
      data: [
        pillar({ id: "p1", name: "Crescimento", epicCount: 0 }),
        pillar({
          id: "p2",
          name: "Eficiência",
          epicCount: 2,
          avgProgress: 75,
        }),
      ],
    });

    render(<StrategyScreen />);

    expect(await screen.findByText("Crescimento")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("nomeia os temas desalinhados numa faixa própria (AC-002)", async () => {
    listStrategyPillarsMock.mockResolvedValue({
      ok: true,
      data: [pillar({ id: "p1", name: "Crescimento" })],
    });
    listUnlinkedThemesMock.mockResolvedValue({
      ok: true,
      data: [
        { id: "th9", title: "Tema órfão", healthStatus: "watch" },
        { id: "th8", title: "Outro sem pilar", healthStatus: "on" },
      ],
    });

    render(<StrategyScreen />);

    expect(await screen.findByText("Tema órfão")).toBeTruthy();
    expect(screen.getByText("Outro sem pilar")).toBeTruthy();
    expect(screen.getByText("2 temas sem pilar")).toBeTruthy();
  });

  it("não mostra a faixa de desalinhados quando não há lacuna (AC-002)", async () => {
    listStrategyPillarsMock.mockResolvedValue({
      ok: true,
      data: [pillar({ id: "p1", name: "Crescimento" })],
    });

    render(<StrategyScreen />);

    await screen.findByText("Crescimento");
    expect(screen.queryByText("Fora de qualquer pilar")).toBeNull();
  });

  it("vincula o tema desalinhado ao pilar escolhido e recarrega (AC-001)", async () => {
    listStrategyPillarsMock.mockResolvedValue({
      ok: true,
      data: [pillar({ id: "p1", name: "Crescimento" })],
    });
    listUnlinkedThemesMock
      .mockResolvedValueOnce({
        ok: true,
        data: [{ id: "th9", title: "Tema órfão", healthStatus: "watch" }],
      })
      .mockResolvedValue({ ok: true, data: [] });
    assignThemeToPillarMock.mockResolvedValue({
      ok: true,
      data: { id: "th9" },
    });

    render(<StrategyScreen />);

    await screen.findByText("Tema órfão");
    fireEvent.change(screen.getByLabelText("Vincular Tema órfão a um pilar"), {
      target: { value: "p1" },
    });

    await waitFor(() =>
      expect(assignThemeToPillarMock).toHaveBeenCalledWith({
        themeId: "th9",
        pillarId: "p1",
      })
    );
    await waitFor(() =>
      expect(listStrategyPillarsMock).toHaveBeenCalledTimes(2)
    );
  });

  it("mostra o estado vazio quando o tenant não tem pilar (AC-004)", async () => {
    listStrategyPillarsMock.mockResolvedValue({ ok: true, data: [] });

    render(<StrategyScreen />);

    expect(
      await screen.findByText("Nenhum pilar estratégico cadastrado.")
    ).toBeTruthy();
  });

  it("mostra o erro e nenhum pilar quando a leitura falha (AC-004)", async () => {
    listStrategyPillarsMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<StrategyScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os pilares estratégicos.")
      ).toBeTruthy()
    );
    expect(
      screen.queryByText("Nenhum pilar estratégico cadastrado.")
    ).toBeNull();
  });
});
