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

  it("sem renderExtra, a lista fica exatamente como sempre foi", () => {
    render(<Palco />);
    expect(screen.queryByText(/extra de/)).toBeNull();
  });

  it("renderExtra anexa conteúdo por item, expandido e recolhido", () => {
    function PalcoComExtra({ inicial = null as string | null }) {
      const [sel, setSel] = useState<string | null>(inicial);
      return (
        <SeletorDeAcervo
          icone="book"
          itens={ITENS}
          onSelecionar={setSel}
          renderExtra={(id) => <span>extra de {id}</span>}
          selecionadoId={sel}
          titulo="Acervo"
          vazio="Acervo vazio."
        />
      );
    }

    render(<PalcoComExtra />);
    expect(screen.getByText("extra de a")).toBeTruthy();
    expect(screen.getByText("extra de b")).toBeTruthy();

    clicar(screen.getByText("Playbook de entrevista"));

    // Recolhida, só o item selecionado aparece — e o extra dele continua
    // visível, sem precisar clicar em "Trocar" para alcançá-lo de novo.
    expect(screen.queryByText("extra de a")).toBeNull();
    expect(screen.getByText("extra de b")).toBeTruthy();
  });

  it("na view recolhida, o extra do ativo anterior não vaza estado para o novo", () => {
    // `renderExtra` aqui é um campo com estado PRÓPRIO (useState), não um
    // <span> estático — um span não tem o que vazar. O troque de item é
    // direto (como um seletor rápido futuro faria), sem passar pelo botão
    // "Trocar": é isso que mantém a view recolhida montada nos dois ativos e
    // expõe a falta de `key` no slot de `renderExtra?.(selecionado.id)`.
    function CampoComEstado({ id }: { id: string }) {
      const [valor, setValor] = useState("");
      return (
        <input
          aria-label={`campo de ${id}`}
          onChange={(e) => setValor(e.target.value)}
          value={valor}
        />
      );
    }

    function PalcoComTrocaDireta() {
      const [sel, setSel] = useState<string>("a");
      return (
        <div>
          <button onClick={() => setSel("b")} type="button">
            Ir direto para b
          </button>
          <SeletorDeAcervo
            icone="book"
            itens={ITENS}
            onSelecionar={setSel}
            renderExtra={(id) => <CampoComEstado id={id} />}
            selecionadoId={sel}
            titulo="Acervo"
            vazio="Acervo vazio."
          />
        </div>
      );
    }

    render(<PalcoComTrocaDireta />);

    const campoA = screen.getByLabelText("campo de a") as HTMLInputElement;
    fireEvent.change(campoA, { target: { value: "digitado para a" } });
    expect(campoA.value).toBe("digitado para a");

    clicar(screen.getByRole("button", { name: "Ir direto para b" }));

    const campoB = screen.getByLabelText("campo de b") as HTMLInputElement;
    expect(campoB.value).toBe("");
  });
});
