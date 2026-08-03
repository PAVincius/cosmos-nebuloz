// anomalies.test.tsx — Anomalias de Custo (/cosmos/anomalies). Cobre os
// critérios da story-059 visíveis na tela: AC-001 (restaurar o padrão da
// plataforma pela tela), AC-004 (número vem da linha; "Δ% médio" é "—" com
// lista vazia) e AC-005 (o vazio distingue "sem dado de custo" de "sem
// anomalia"; o erro não renderiza anomalia).
// Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCostAnomaliesMock = vi.fn();
const getAnomalySensitivityMock = vi.fn();
const resetAnomalySensitivityMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/anomalies", () => ({
  listCostAnomalies: (...args: unknown[]) => listCostAnomaliesMock(...args),
  getAnomalySensitivity: (...args: unknown[]) =>
    getAnomalySensitivityMock(...args),
  resetAnomalySensitivity: (...args: unknown[]) =>
    resetAnomalySensitivityMock(...args),
  setAnomalySensitivity: vi.fn(),
  acknowledgeCostAnomaly: vi.fn(),
  detectCostAnomaliesNow: vi.fn(),
  generateCostAnomalyNarrativeAction: vi.fn(),
}));

import AnomaliesScreen from "../../components/cosmos/screens/anomalies";

const anomaly = (over: Record<string, unknown>) => ({
  id: "an-x",
  service: "AmazonEC2",
  accountId: "111122223333",
  period: "2026-07-01T00:00:00.000Z",
  detectedAt: "2026-07-15T00:00:00.000Z",
  baselineMedian: 200,
  baselineMAD: 12,
  actualAmount: 650,
  modifiedZScore: 8.42,
  deltaAbs: 450,
  deltaPct: 225,
  severity: "HIGH",
  status: "OPEN",
  acknowledgedBy: null,
  acknowledgedAt: null,
  ...over,
});

const sensitivity = (over: Record<string, unknown> = {}) => ({
  threshold: 3.5,
  isDefault: true,
  bounds: { min: 2, max: 8 },
  ...over,
});

describe("AnomaliesScreen", () => {
  beforeEach(() => {
    // mockReset e não clearAllMocks: só o reset esvazia a fila de
    // mockResolvedValueOnce, e um `once` sobrando vaza para o teste seguinte.
    listCostAnomaliesMock.mockReset();
    getAnomalySensitivityMock.mockReset();
    resetAnomalySensitivityMock.mockReset();
    getAnomalySensitivityMock.mockResolvedValue({
      ok: true,
      data: sensitivity(),
    });
  });

  it("mostra o desvio com os números da linha, sem recalcular (AC-004)", async () => {
    listCostAnomaliesMock.mockResolvedValue({
      ok: true,
      data: { items: [anomaly({ id: "an-1" })], hasBillingData: true },
    });

    render(<AnomaliesScreen />);

    expect(await screen.findByText("AmazonEC2 · 111122223333")).toBeTruthy();
    // Δ% e z-score vêm da linha; a tela formata e não deriva de actual/baseline
    expect(screen.getByText("+225%")).toBeTruthy();
    expect(screen.getByText("z=8.42")).toBeTruthy();
    expect(screen.getByText("Alta")).toBeTruthy();
  });

  it("mostra '—' no Δ% médio quando não há anomalia, nunca 0% (AC-004)", async () => {
    listCostAnomaliesMock.mockResolvedValue({
      ok: true,
      data: { items: [], hasBillingData: true },
    });

    render(<AnomaliesScreen />);

    expect(await screen.findByText("Nenhuma anomalia de custo")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("diz que falta dado de custo, e não que não há anomalia, quando o tenant não tem BillingEntry (AC-005)", async () => {
    listCostAnomaliesMock.mockResolvedValue({
      ok: true,
      data: { items: [], hasBillingData: false },
    });

    render(<AnomaliesScreen />);

    expect(
      await screen.findByText(
        "Nenhum dado de custo (BillingEntry) foi sincronizado para este tenant ainda — conecte uma integração de billing primeiro."
      )
    ).toBeTruthy();
  });

  it("diz que nada foi detectado nos dados atuais quando há dado de custo (AC-005)", async () => {
    listCostAnomaliesMock.mockResolvedValue({
      ok: true,
      data: { items: [], hasBillingData: true },
    });

    render(<AnomaliesScreen />);

    expect(
      await screen.findByText(
        "Nenhuma anomalia foi detectada nos dados de custo atuais."
      )
    ).toBeTruthy();
  });

  it("mostra o erro e nenhuma anomalia quando a leitura falha (AC-005)", async () => {
    listCostAnomaliesMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<AnomaliesScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar as anomalias de custo.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Nenhuma anomalia de custo")).toBeNull();
    expect(document.body.innerHTML).not.toContain("AmazonEC2");
  });

  it("restaura o padrão da plataforma pela tela e recarrega a sensibilidade (AC-001)", async () => {
    listCostAnomaliesMock.mockResolvedValue({
      ok: true,
      data: { items: [], hasBillingData: true },
    });
    getAnomalySensitivityMock
      .mockResolvedValueOnce({
        ok: true,
        data: sensitivity({ threshold: 2.5, isDefault: false }),
      })
      .mockResolvedValue({ ok: true, data: sensitivity() });
    resetAnomalySensitivityMock.mockResolvedValue({
      ok: true,
      data: { threshold: 3.5, wasOverridden: true },
    });

    render(<AnomaliesScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Sensibilidade" })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Restaurar padrão" })
    );

    await waitFor(() => expect(resetAnomalySensitivityMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(getAnomalySensitivityMock).toHaveBeenCalledTimes(2)
    );
  });

  it("não oferece restaurar quando a sensibilidade já é a padrão da plataforma (AC-001)", async () => {
    listCostAnomaliesMock.mockResolvedValue({
      ok: true,
      data: { items: [], hasBillingData: true },
    });

    render(<AnomaliesScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Sensibilidade" })
    );

    expect(await screen.findByText("Sensibilidade de detecção")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Restaurar padrão" })
    ).toBeNull();
  });
});
