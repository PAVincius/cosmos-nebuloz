import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromoteConfirm } from "@/components/meridian/screens/promote-confirm";
import { RationaleHint } from "@/components/meridian/screens/rationale-hint";

afterEach(cleanup);

describe("A1 — RationaleHint diz o mínimo de caracteres", () => {
  it("rationale vazio: informa o mínimo e quantos faltam", () => {
    render(<RationaleHint length={0} min={20} />);
    expect(screen.getByText(/mínimo de 20 caracteres/i)).toBeTruthy();
    expect(screen.getByText(/faltam 20/i)).toBeTruthy();
  });

  it("rationale curto: mostra quantos faltam", () => {
    render(<RationaleHint length={8} min={20} />);
    expect(screen.getByText(/faltam 12/i)).toBeTruthy();
  });

  it("rationale suficiente: não cobra mais caracteres", () => {
    render(<RationaleHint length={20} min={20} />);
    expect(screen.queryByText(/faltam/i)).toBeNull();
    expect(screen.getByText(/mínimo atingido/i)).toBeTruthy();
  });
});

describe("A2 — PromoteConfirm exige confirmação e destino", () => {
  const setup = (defaultProduct: "COSMOS" | "SCAFFOLD") => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <PromoteConfirm
        busy={false}
        defaultProduct={defaultProduct}
        gapCode="G-11"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    return { onConfirm, onCancel };
  };

  it("não grava ao renderizar e mostra o gap e o destino pré-escolhido", () => {
    const { onConfirm } = setup("COSMOS");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/G-11/)).toBeTruthy();
    expect((screen.getByLabelText(/Cosmos/) as HTMLInputElement).checked).toBe(
      true
    );
  });

  it("confirmar envia o destino pré-escolhido", () => {
    const { onConfirm } = setup("SCAFFOLD");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("SCAFFOLD");
  });

  it("trocar o destino antes de confirmar envia o destino trocado", () => {
    const { onConfirm } = setup("COSMOS");
    fireEvent.click(screen.getByLabelText(/Scaffold/));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/ }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("SCAFFOLD");
  });

  it("cancelar não grava", () => {
    const { onConfirm, onCancel } = setup("COSMOS");
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
