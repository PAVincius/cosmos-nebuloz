// flow.test.tsx — Analytics · Flow Metrics (/cosmos/flow), seção DORA. Cobre a
// decisão de produto que o nó `flow` carrega: change failure rate é derivado do
// estado do deployment (fonte que existe) e MTTR fica explicitamente
// indisponível com o motivo (fonte que não existe), nunca como 0. Asserção
// sobre conteúdo — sem snapshot.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDoraMetricsMock = vi.fn();
const getLatestFlowMetricsMock = vi.fn();
const getFlowMetricsSeriesMock = vi.fn();
const getAgingWipMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/dora", () => ({
  getDoraMetrics: (...args: unknown[]) => getDoraMetricsMock(...args),
}));
vi.mock("@/app/(cosmos)/actions/flow", () => ({
  getLatestFlowMetrics: (...args: unknown[]) =>
    getLatestFlowMetricsMock(...args),
  getFlowMetricsSeries: (...args: unknown[]) =>
    getFlowMetricsSeriesMock(...args),
  getAgingWip: (...args: unknown[]) => getAgingWipMock(...args),
}));

import FlowScreen from "../../components/cosmos/screens/flow";

const dora = (over: Record<string, unknown>) => ({
  windowDays: 30,
  hasProductionDeployments: true,
  totalProductionDeployments: 4,
  successfulProductionDeployments: 2,
  failedProductionDeployments: 2,
  deploymentFrequency: { status: "measured", value: 0.13 },
  leadTimeHours: { status: "measured", value: 48 },
  changeFailureRate: { status: "measured", value: 0.5 },
  mttrHours: { status: "unavailable", reason: "sem fonte de incidente" },
  ...over,
});

describe("FlowScreen — DORA", () => {
  beforeEach(() => {
    getDoraMetricsMock.mockReset();
    getLatestFlowMetricsMock.mockReset();
    getFlowMetricsSeriesMock.mockReset();
    getAgingWipMock.mockReset();
    getLatestFlowMetricsMock.mockResolvedValue({ ok: true, data: null });
    getFlowMetricsSeriesMock.mockResolvedValue({ ok: true, data: [] });
    getAgingWipMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("mostra o change failure rate medido com o denominador ao lado", async () => {
    getDoraMetricsMock.mockResolvedValue({ ok: true, data: dora({}) });

    render(<FlowScreen />);

    await waitFor(() =>
      expect(screen.getByText("Change Failure Rate")).toBeTruthy()
    );
    // 2 de 4 deployments concluídos falharam
    await waitFor(() => expect(screen.getByText("50")).toBeTruthy(), {
      timeout: 3000,
    });
    // o denominador vai junto: 50% sobre 4 e 50% sobre 400 não se leem igual
    expect(
      screen.getByText("2 de 4 deploy(s) de produção concluídos")
    ).toBeTruthy();
  });

  it("mantém MTTR indisponível com o motivo, nunca como zero", async () => {
    getDoraMetricsMock.mockResolvedValue({ ok: true, data: dora({}) });

    render(<FlowScreen />);

    await waitFor(() => expect(screen.getByText("MTTR")).toBeTruthy());
    expect(screen.getByText("sem fonte de incidente")).toBeTruthy();
    // o card de MTTR não carrega valor algum
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("mostra o motivo quando o change failure rate não é derivável", async () => {
    getDoraMetricsMock.mockResolvedValue({
      ok: true,
      data: dora({
        totalProductionDeployments: 0,
        successfulProductionDeployments: 0,
        failedProductionDeployments: 0,
        deploymentFrequency: {
          status: "unavailable",
          reason: "nenhum deployment de produção com estado reconhecido",
        },
        changeFailureRate: {
          status: "unavailable",
          reason: "nenhum deployment de produção com estado reconhecido",
        },
      }),
    });

    render(<FlowScreen />);

    await waitFor(() =>
      expect(screen.getByText("Change Failure Rate")).toBeTruthy()
    );
    expect(
      screen.getAllByText(
        "nenhum deployment de produção com estado reconhecido"
      ).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("mostra o estado vazio quando o tenant não tem deployment de produção", async () => {
    getDoraMetricsMock.mockResolvedValue({
      ok: true,
      data: dora({
        hasProductionDeployments: false,
        totalProductionDeployments: 0,
        successfulProductionDeployments: 0,
        failedProductionDeployments: 0,
      }),
    });

    render(<FlowScreen />);

    await waitFor(() =>
      expect(screen.getByText("Sem deployments de produção")).toBeTruthy()
    );
    expect(screen.queryByText("Change Failure Rate")).toBeNull();
  });
});
