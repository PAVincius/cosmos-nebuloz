/** @vitest-environment jsdom */
// disclosure-panel.test.tsx — painéis explicativos estáticos deixam de abrir
// por padrão nas telas de operação (crítica de design, onda 5a). O estado
// vive em localStorage por painel (`charter.panel.<id>`) para sobreviver a
// navegação — sem isso, quem abre "Pacote de evidência" uma vez teria de
// reabrir a cada visita.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DisclosurePanel } from "../../components/charter/disclosure-panel";

beforeEach(() => {
  window.localStorage.clear();
});

describe("DisclosurePanel", () => {
  it("fecha por padrão — aria-expanded=false e conteúdo hidden", () => {
    render(
      <DisclosurePanel id="teste-fechado" title="Painel de teste">
        <p>Conteúdo do painel</p>
      </DisclosurePanel>
    );

    const button = screen.getByRole("button", { name: "Painel de teste" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen
        .getByText("Conteúdo do painel")
        .parentElement?.hasAttribute("hidden")
    ).toBe(true);
  });

  it("clique abre o painel e grava o estado no localStorage", () => {
    render(
      <DisclosurePanel id="teste-abrir" title="Painel de teste">
        <p>Conteúdo do painel</p>
      </DisclosurePanel>
    );

    fireEvent.click(screen.getByRole("button", { name: "Painel de teste" }));

    expect(
      screen
        .getByRole("button", { name: "Painel de teste" })
        .getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByText("Conteúdo do painel")
        .parentElement?.hasAttribute("hidden")
    ).toBe(false);
    expect(window.localStorage.getItem("charter.panel.teste-abrir")).toBe("1");
  });

  it("valor gravado '1' reabre o painel no próximo render", () => {
    window.localStorage.setItem("charter.panel.teste-persistido", "1");

    render(
      <DisclosurePanel id="teste-persistido" title="Painel de teste">
        <p>Conteúdo do painel</p>
      </DisclosurePanel>
    );

    expect(
      screen
        .getByRole("button", { name: "Painel de teste" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("respeita defaultOpen quando não há valor salvo", () => {
    render(
      <DisclosurePanel defaultOpen id="teste-default" title="Painel de teste">
        <p>Conteúdo do painel</p>
      </DisclosurePanel>
    );

    expect(
      screen
        .getByRole("button", { name: "Painel de teste" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });
});
