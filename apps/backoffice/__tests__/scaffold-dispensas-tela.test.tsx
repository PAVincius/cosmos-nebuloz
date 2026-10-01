/** @vitest-environment jsdom */
// Seção "Entregáveis dispensados" da supervisão do Scaffold (specs/017, FR-005
// e FR-006): motivo, via, trilha, cliente e quem/quando, sem nenhuma ação.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DispensasDaCarteira } from "@/app/(staff)/scaffold/dispensas";
import type { DispensaRow } from "@/app/actions/scaffold-dispensas";

function linha(over: Partial<DispensaRow> = {}): DispensaRow {
  return {
    id: "d1",
    code: "C1.1",
    title: "Política de uso",
    reason: "O módulo Charter não está contratado; dispensado pelo sistema.",
    via: "automatica",
    trackId: "trk1",
    trackCode: "TR-104",
    orgName: "Vanta Saúde",
    by: "Sistema",
    at: "2026-09-20T13:00:00.000Z",
    ...over,
  };
}

describe("DispensasDaCarteira", () => {
  it("mostra cliente, trilha, entregável, motivo e quem/quando", () => {
    render(
      <DispensasDaCarteira dados={{ items: [linha()], truncated: false }} />
    );

    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Vanta Saúde")).toBeTruthy();
    expect(within(tabela).getByText("TR-104")).toBeTruthy();
    expect(within(tabela).getByText("C1.1")).toBeTruthy();
    expect(within(tabela).getByText("Política de uso")).toBeTruthy();
    expect(within(tabela).getByText(/dispensado pelo sistema/)).toBeTruthy();
    expect(within(tabela).getByText("Sistema")).toBeTruthy();
    expect(within(tabela).getByText("20/09/2026 10:00")).toBeTruthy();
  });

  it("as três vias aparecem, cada uma com a sua palavra", () => {
    render(
      <DispensasDaCarteira
        dados={{
          items: [
            linha({ id: "a", via: "automatica" }),
            linha({ id: "o", via: "overlay" }),
            linha({ id: "m", via: "manual", by: "Camila Rocha" }),
          ],
          truncated: false,
        }}
      />
    );

    expect(screen.getByText("Automática")).toBeTruthy();
    expect(screen.getByText("Overlay")).toBeTruthy();
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText("Camila Rocha")).toBeTruthy();
  });

  it("é só leitura: nenhum botão, link ou campo", () => {
    render(
      <DispensasDaCarteira dados={{ items: [linha()], truncated: false }} />
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("vazio diz por que está vazio", () => {
    render(<DispensasDaCarteira dados={{ items: [], truncated: false }} />);

    expect(screen.getByText(/Nenhum entregável dispensado/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("avisa quando a lista foi cortada no teto", () => {
    render(
      <DispensasDaCarteira dados={{ items: [linha()], truncated: true }} />
    );

    expect(screen.getByText(/mais recentes/)).toBeTruthy();
  });
});
