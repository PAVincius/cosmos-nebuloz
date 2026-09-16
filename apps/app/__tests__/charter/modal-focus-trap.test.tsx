/** @vitest-environment jsdom */
// modal-focus-trap.test.tsx — crítica de a11y (Sam, só teclado): o dialog do
// Charter tem aria-modal="true" + role="dialog" mas Tab escapava do diálogo
// para a página atrás. Trap mínimo: Tab no último foco do dialog volta ao
// primeiro; Shift+Tab no primeiro vai ao último.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModalProvider, useModal } from "../../components/charter/modal";

function Harness() {
  const { open } = useModal();
  return (
    <button
      onClick={() =>
        open(
          // biome-ignore lint/a11y/useSemanticElements: dialog mínimo pro teste do trap — o teor real vem do ModalShell
          <div aria-label="Teste" aria-modal="true" role="dialog">
            <button type="button">Primeiro</button>
            <button type="button">Segundo</button>
          </div>
        )
      }
      type="button"
    >
      Abrir modal
    </button>
  );
}

describe("ModalHost — trap de foco", () => {
  it("Tab no último foco do dialog volta ao primeiro", async () => {
    render(
      <ModalProvider>
        <Harness />
      </ModalProvider>
    );
    fireEvent.click(screen.getByText("Abrir modal"));

    const primeiro = await screen.findByText("Primeiro");
    const segundo = screen.getByText("Segundo");
    segundo.focus();
    expect(document.activeElement).toBe(segundo);

    fireEvent.keyDown(segundo, { key: "Tab" });

    expect(document.activeElement).toBe(primeiro);
  });

  it("Shift+Tab no primeiro foco do dialog vai ao último", async () => {
    render(
      <ModalProvider>
        <Harness />
      </ModalProvider>
    );
    fireEvent.click(screen.getByText("Abrir modal"));

    const primeiro = await screen.findByText("Primeiro");
    const segundo = screen.getByText("Segundo");
    primeiro.focus();
    expect(document.activeElement).toBe(primeiro);

    fireEvent.keyDown(primeiro, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(segundo);
  });
});
