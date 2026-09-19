/** @vitest-environment jsdom */
// pergunta-descartar.test.tsx — a pergunta antes de jogar fora um rascunho.
//
// Ela aparece no lugar de algo que a pessoa acabou de clicar (outro item da
// lista, o X do diálogo, o seletor de período), e quem navega por teclado
// perdia o lugar: o foco ficava onde estava, fora da pergunta. Mesmo padrão
// da `ConfirmarAcao`: ao montar, o foco vai para "Voltar" (a saída vem
// primeiro); ao desmontar, volta para quem tinha o foco antes.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PerguntaDescartar } from "@/components/pergunta-descartar";

function Tela({ perguntando }: { perguntando: boolean }) {
  return (
    <>
      <button type="button">Gatilho</button>
      {perguntando ? (
        <PerguntaDescartar
          nome="Playbook Um"
          onDescartar={vi.fn()}
          onVoltar={vi.fn()}
        />
      ) : null}
    </>
  );
}

describe("PerguntaDescartar — foco", () => {
  it("ao abrir, o foco está em Voltar", () => {
    const { rerender } = render(<Tela perguntando={false} />);
    screen.getByRole("button", { name: "Gatilho" }).focus();

    rerender(<Tela perguntando />);

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Voltar" })
    );
  });

  it("ao fechar, o foco volta ao gatilho", () => {
    const { rerender } = render(<Tela perguntando={false} />);
    screen.getByRole("button", { name: "Gatilho" }).focus();
    rerender(<Tela perguntando />);
    const voltar = screen.getByRole("button", { name: "Voltar" });
    voltar.focus();

    fireEvent.click(voltar);
    rerender(<Tela perguntando={false} />);

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Gatilho" })
    );
  });

  it("é um group nomeado pela pergunta e descrito pela explicação", () => {
    render(<Tela perguntando />);

    const grupo = screen.getByRole("group", { name: /Playbook Um/ });
    const descricao = (grupo.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    expect(descricao).toMatch(/ainda não salvou some/);
  });
});
