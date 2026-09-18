/** @vitest-environment jsdom */
// fila-de-gates-dialogo.test.tsx — a travessia da fila de gates para dentro do
// cliente é um diálogo de verdade, não um `div role="dialog"`.
//
// O modal artesanal tinha `role`/`aria-modal` e nada mais: sem foco inicial,
// sem trap, sem Esc. Quem navega por teclado (persona Sam) caía atrás do
// backdrop e não achava o campo do motivo. O que se prova aqui:
//
// 1. O diálogo tem nome (o título) e descrição (a frase "Até aqui você viu
//    apenas metadado…") — é o que o leitor de tela anuncia ao abrir.
// 2. O foco nasce no campo do motivo.
// 3. Tab no último controle volta ao primeiro (trap do Radix).
// 4. Escape fecha.
// 5. "Voltar" vem antes do primário, e o mecanismo (motivo ≥ 12, action com
//    trackId + motivo) continua o mesmo.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilaDeGates } from "@/app/(staff)/scaffold/fila-de-gates";
import type { QueueEntry } from "@/app/actions/scaffold-supervision";

const { enterTenantContextMock } = vi.hoisted(() => ({
  enterTenantContextMock: vi.fn(),
}));

vi.mock("@/app/actions/scaffold-supervision", () => ({
  enterTenantContext: enterTenantContextMock,
}));

const ENTRADA: QueueEntry = {
  ageDays: 3,
  ageLabel: "3 d",
  criteriaMet: 2,
  criteriaTotal: 4,
  kind: "sign-off",
  orgName: "Acme Saúde",
  phase: "PILOT",
  phaseInstanceId: "pi-1",
  trackCode: "TRK-42",
  trackId: "trk-42",
};

function abrir() {
  render(<FilaDeGates iniciais={[ENTRADA]} />);
  fireEvent.click(screen.getByRole("button", { name: "Entrar no cliente" }));
  return screen.getByRole("dialog");
}

describe("FilaDeGates — diálogo de travessia", () => {
  beforeEach(() => {
    enterTenantContextMock.mockReset();
  });

  it("o diálogo tem nome e descrição — o leitor de tela anuncia os dois", () => {
    abrir();

    expect(
      screen.getByRole("dialog", {
        description: /Até aqui você viu apenas metadado/,
        name: /Entrar no cliente Acme Saúde/,
      })
    ).toBeTruthy();
  });

  it("o foco nasce no campo do motivo", () => {
    abrir();

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Por que precisa entrar" })
    );
  });

  it("Tab no último controle volta ao primeiro — o foco não escapa", () => {
    const dialogo = abrir();
    const controles = Array.from(
      dialogo.querySelectorAll<HTMLElement>("button, textarea")
    ).filter((el) => !el.hasAttribute("disabled"));
    const ultimo = controles.at(-1) as HTMLElement;
    const primeiro = controles[0];

    ultimo.focus();
    fireEvent.keyDown(ultimo, { key: "Tab" });

    expect(document.activeElement).toBe(primeiro);
    expect(dialogo.contains(document.activeElement)).toBe(true);
  });

  it("Escape fecha sem entrar", () => {
    abrir();

    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "Escape",
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(enterTenantContextMock).not.toHaveBeenCalled();
  });

  it("'Voltar' vem antes do primário e fecha", () => {
    const dialogo = abrir();
    const nomes = Array.from(dialogo.querySelectorAll("button")).map(
      (b) => b.textContent?.trim() ?? ""
    );

    expect(nomes.indexOf("Voltar")).toBeGreaterThanOrEqual(0);
    expect(nomes.indexOf("Voltar")).toBeLessThan(
      nomes.indexOf("Registrar e entrar")
    );

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("o primário só libera com motivo de 12+ caracteres e chama a action com trackId e motivo", async () => {
    enterTenantContextMock.mockResolvedValue({
      data: { destination: "/x" },
      ok: true,
    });
    abrir();
    const primario = screen.getByRole("button", { name: "Registrar e entrar" });
    const motivo = screen.getByRole("textbox", {
      name: "Por que precisa entrar",
    });

    expect(primario.hasAttribute("disabled")).toBe(true);
    fireEvent.change(motivo, { target: { value: "curto" } });
    expect(primario.hasAttribute("disabled")).toBe(true);
    fireEvent.change(motivo, {
      target: { value: "revisar o log do piloto" },
    });
    expect(primario.hasAttribute("disabled")).toBe(false);

    fireEvent.click(primario);

    expect(enterTenantContextMock).toHaveBeenCalledWith({
      rationale: "revisar o log do piloto",
      trackId: "trk-42",
    });
  });
});
