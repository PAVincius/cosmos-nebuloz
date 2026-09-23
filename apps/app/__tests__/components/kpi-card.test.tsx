// KpiCard (DESIGN.md do Cosmos, Components → KPI Card): só número conta e
// sai em pt-BR; string entra como veio. O kit lia "1.250.000" como decimal e
// mostrava "1", e o ECG do escuro rodava num gradiente que não cobria o traço.
import { KpiCard } from "@repo/design-system/cosmos/kit";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Sob reduced motion o valor final aparece direto, sem a contagem de 900ms.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

// O tema que o next-themes devolve; o servidor real não tem nenhum.
const tema = vi.hoisted(() => ({ atual: "dark" }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: tema.atual }),
}));

describe("KpiCard", () => {
  it("formata número em pt-BR, com milhar e as casas pedidas", () => {
    render(<KpiCard icon="dollar" label="Total alocado" value={1_250_000} />);
    render(<KpiCard decimals={1} icon="gauge" label="Confiança" value={3.7} />);
    expect(screen.getByText("1.250.000")).toBeTruthy();
    expect(screen.getByText("3,7")).toBeTruthy();
  });

  it("mostra string como veio, sem ler o ponto de milhar como decimal", () => {
    render(<KpiCard icon="dollar" label="Total alocado" value="1.250.000" />);
    expect(screen.getByText("1.250.000")).toBeTruthy();
  });

  it("estende o gradiente do ECG pelo viewBox, não pela caixa do traço", () => {
    render(<KpiCard icon="clock" label="Lead time" tone="blue" value={4} />);
    expect(
      document
        .getElementById("cosmos_sig_blue_clock")
        ?.getAttribute("gradientUnits")
    ).toBe("userSpaceOnUse");
  });

  it("hidrata no claro sem ficar com o fundo escuro do servidor", async () => {
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    const ui = <KpiCard icon="dollar" label="Total alocado" value={10} />;
    const raiz = document.createElement("div");
    raiz.innerHTML = renderToString(ui);
    tema.atual = "light";
    try {
      await act(async () => {
        hydrateRoot(raiz, ui);
      });
      // React não conserta atributo divergente na hidratação: se o cliente
      // lesse o claro já ali, o estilo escuro do servidor ficava no cartão. A
      // cor do valor é a prova porque é propriedade simples; o jsdom não
      // aplica var() nos atalhos background e border, que o navegador aplica.
      const valor = raiz.querySelector<HTMLElement>(".kpi .mono");
      expect(valor?.style.color).toBe("var(--ink)");
      expect(
        erros.mock.calls.some((c) => String(c[0]).includes("didn't match"))
      ).toBe(false);
    } finally {
      tema.atual = "dark";
      erros.mockRestore();
    }
  });
});
