/** @vitest-environment jsdom */
// modal-shell-focus.test.tsx — foco inicial e devolução do foco do ModalShell,
// casca compartilhada por Charter, Meridian, Scaffold e Signal. Ao abrir, o
// foco tem de estar dentro do diálogo (primeiro controle habilitado do corpo,
// ou o próprio diálogo); ao fechar, volta ao gatilho.
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ModalProvider,
  ModalShell,
  useModal,
} from "../../components/charter/modal";

function Gatilho({ children }: { children: ReactNode }) {
  const modal = useModal();
  return (
    <button
      onClick={() =>
        modal.open(
          <ModalShell onClose={modal.close} title="Detalhe">
            {children}
          </ModalShell>
        )
      }
      type="button"
    >
      abrir
    </button>
  );
}

function abrir(corpo: ReactNode) {
  render(
    <ModalProvider>
      <Gatilho>{corpo}</Gatilho>
    </ModalProvider>
  );
  // jsdom não foca no clique como o navegador; o gatilho é focado à mão.
  const gatilho = screen.getByText("abrir");
  gatilho.focus();
  fireEvent.click(gatilho);
  return gatilho;
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("ModalShell — foco inicial", () => {
  it("foca o primeiro controle do corpo", () => {
    abrir(<input aria-label="Nome" />);
    expect(document.activeElement).toBe(screen.getByLabelText("Nome"));
  });

  it("pula controle desabilitado e foca o primeiro habilitado", () => {
    abrir(
      <>
        <button disabled type="button">
          Indisponível
        </button>
        <input aria-label="Nome" />
      </>
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Nome"));
  });

  it("sem controle no corpo, foca o próprio diálogo", () => {
    abrir(<p>Só leitura</p>);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
    expect(dialog.getAttribute("tabindex")).toBe("-1");
  });

  it("foca link no corpo", () => {
    abrir(<a href="/x">Abrir evidência</a>);
    expect(document.activeElement).toBe(screen.getByText("Abrir evidência"));
  });

  it("nunca deixa o foco no body", () => {
    abrir(
      <button disabled type="button">
        Só desabilitado
      </button>
    );
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
      true
    );
  });
});

describe("ModalShell — devolução do foco", () => {
  it("Escape devolve o foco ao gatilho", () => {
    const gatilho = abrir(<input aria-label="Nome" />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });

  it("botão Fechar devolve o foco ao gatilho", () => {
    const gatilho = abrir(<p>Só leitura</p>);
    fireEvent.click(screen.getByTitle("Fechar"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(gatilho);
  });
});
