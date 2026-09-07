/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type ItemDoAcervo,
  SeletorDeAcervo,
} from "../components/seletor-de-acervo";

const ITENS: ItemDoAcervo[] = [
  { id: "a", titulo: "Readiness Scorecard", detalhe: "ACELERADOR · v4" },
  { id: "b", titulo: "Playbook de entrevista", detalhe: "PLAYBOOK · v2" },
];

/** Envolve o seletor com o estado de seleção que a tela real mantém. */
function Palco({ inicial = null }: { inicial?: string | null }) {
  const [sel, setSel] = useState<string | null>(inicial);
  return (
    <SeletorDeAcervo
      icone="book"
      itens={ITENS}
      onSelecionar={setSel}
      selecionadoId={sel}
      titulo="Acervo"
      vazio="Acervo vazio."
    />
  );
}

const clicar = (el: HTMLElement) => fireEvent.click(el);

describe("SeletorDeAcervo", () => {
  it("sem seleção, lista todos os itens e não oferece trocar", () => {
    render(<Palco />);
    expect(screen.getByText("Readiness Scorecard")).toBeTruthy();
    expect(screen.getByText("Playbook de entrevista")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Trocar" })).toBeNull();
  });

  it("selecionar recolhe a lista para o item escolhido", () => {
    render(<Palco />);
    clicar(screen.getByText("Playbook de entrevista"));

    // O outro item some — é isso que devolve a tela ao conteúdo.
    expect(screen.queryByText("Readiness Scorecard")).toBeNull();
    expect(screen.getByText("Playbook de entrevista")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trocar" })).toBeTruthy();
  });

  it("Trocar reabre a lista inteira sem perder a seleção", () => {
    render(<Palco inicial="b" />);
    clicar(screen.getByRole("button", { name: "Trocar" }));

    expect(screen.getByText("Readiness Scorecard")).toBeTruthy();
    const escolhido = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Playbook de entrevista"));
    expect(escolhido?.getAttribute("aria-pressed")).toBe("true");
  });

  it("já entra recolhida quando a tela abre com item selecionado", () => {
    render(<Palco inicial="a" />);
    expect(screen.queryByText("Playbook de entrevista")).toBeNull();
    expect(screen.getByRole("button", { name: "Trocar" })).toBeTruthy();
  });

  it("formulário aberto mantém a lista visível, mesmo com seleção", () => {
    render(
      <SeletorDeAcervo
        formulario={<div>campos de criação</div>}
        icone="book"
        itens={ITENS}
        onSelecionar={vi.fn()}
        selecionadoId="a"
        titulo="Acervo"
        vazio="Acervo vazio."
      />
    );

    // O item recém-criado precisa aparecer na lista; recolher esconderia o
    // resultado da própria ação.
    expect(screen.getByText("campos de criação")).toBeTruthy();
    expect(screen.getByText("Playbook de entrevista")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Trocar" })).toBeNull();
  });

  it("acervo vazio mostra o texto da tela, não uma lista em branco", () => {
    render(
      <SeletorDeAcervo
        icone="book"
        itens={[]}
        onSelecionar={vi.fn()}
        selecionadoId={null}
        titulo="Acervo"
        vazio="Acervo vazio. É aqui que fica o que dá para reusar."
      />
    );
    expect(
      screen.getByText("Acervo vazio. É aqui que fica o que dá para reusar.")
    ).toBeTruthy();
  });
});
