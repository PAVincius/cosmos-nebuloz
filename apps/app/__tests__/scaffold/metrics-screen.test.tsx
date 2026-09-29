import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// SC-PM-04: a tela da consultora. Quatro números, e ao lado de cada um a
// definição de o que se mede.

const h = vi.hoisted(() => ({ getProductMetrics: vi.fn() }));

vi.mock("@/app/(scaffold)/actions/metrics", () => ({
  getProductMetrics: h.getProductMetrics,
}));

import MetricsScreen from "@/components/scaffold/screens/metrics";

const METRICS = {
  summaryCoverage: { withSummary: 3, started: 8, percent: 38 },
  reviewTime: { reviews: 5, averageHours: 10.5 },
  adjustmentRate: { adjustments: 1, decisions: 4, percent: 25 },
  catalogStarts: { fromCatalog: 3, total: 4, percent: 75 },
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getProductMetrics.mockResolvedValue({ ok: true, data: METRICS });
});

describe("Métricas do produto", () => {
  it("mostra as quatro métricas, cada uma com a definição", async () => {
    render(<MetricsScreen />);
    expect(
      await screen.findByRole("heading", { name: "Métricas do produto" })
    ).toBeDefined();

    expect(screen.getByText("Entregáveis com resumo")).toBeDefined();
    expect(
      screen.getByText(/3 de 8 entregáveis iniciados têm resumo/)
    ).toBeDefined();
    expect(screen.getByText("Tempo em revisão")).toBeDefined();
    expect(
      screen.getByText(/média entre enviar e decidir · 5 revisões/)
    ).toBeDefined();
    expect(screen.getByText("Taxa de ajuste")).toBeDefined();
    expect(screen.getByText(/1 pedido de ajuste em 4 decisões/)).toBeDefined();
    expect(screen.getByText("Trilhas pelo catálogo")).toBeDefined();
    expect(
      screen.getByText(/3 de 4 criadas sem lacuna do Meridian/)
    ).toBeDefined();
  });

  it("os valores saem legíveis: percentual e horas", async () => {
    render(<MetricsScreen />);
    await screen.findByText("Taxa de ajuste");
    for (const v of ["38%", "25%", "75%", "10,5 h"]) {
      expect(screen.getByText(v)).toBeDefined();
    }
  });

  it("sem dado, diz que falta dado em vez de mostrar zero", async () => {
    h.getProductMetrics.mockResolvedValue({
      ok: true,
      data: {
        summaryCoverage: { withSummary: 0, started: 0, percent: null },
        reviewTime: { reviews: 0, averageHours: null },
        adjustmentRate: { adjustments: 0, decisions: 0, percent: null },
        catalogStarts: { fromCatalog: 0, total: 0, percent: null },
      },
    });
    render(<MetricsScreen />);
    await screen.findByText("Taxa de ajuste");
    expect(screen.getAllByText("sem dado ainda").length).toBe(4);
    expect(screen.getAllByText("—").length).toBe(4);
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("singular quando é um só", async () => {
    h.getProductMetrics.mockResolvedValue({
      ok: true,
      data: {
        ...METRICS,
        reviewTime: { reviews: 1, averageHours: 2 },
        adjustmentRate: { adjustments: 1, decisions: 1, percent: 100 },
      },
    });
    render(<MetricsScreen />);
    expect(
      await screen.findByText(/média entre enviar e decidir · 1 revisão$/)
    ).toBeDefined();
    expect(screen.getByText(/1 pedido de ajuste em 1 decisão$/)).toBeDefined();
  });

  it("recusa de permissão vira tela de erro com tentar de novo", async () => {
    h.getProductMetrics.mockResolvedValueOnce({
      ok: false,
      error:
        "Requer papel Consultor ou Administrador — Ler as métricas de produto do Scaffold",
    });
    render(<MetricsScreen />);
    expect(await screen.findByText(/Requer papel/)).toBeDefined();
    h.getProductMetrics.mockResolvedValue({ ok: true, data: METRICS });
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    await waitFor(() =>
      expect(screen.getByText("Taxa de ajuste")).toBeDefined()
    );
  });
});
