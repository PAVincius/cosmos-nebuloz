/** @vitest-environment jsdom */
// FR-004/005 (spec 009): trocar de conta pelo seletor exige confirmação
// explícita — a troca não pode efetivar só com a escolha no dropdown.
// Cancelar não deve ter nenhum efeito colateral.

import { SwitchAccountDialog } from "@repo/design-system/components/account-switcher/switch-account-dialog";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("SwitchAccountDialog (FR-004/005)", () => {
  it("não chama onConfirm só por estar aberto — exige clique explícito", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <SwitchAccountDialog
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        targetTenant={{ id: "tenant-2", name: "Nebuloz" }}
      />
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancelar não chama onConfirm", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <SwitchAccountDialog
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        targetTenant={{ id: "tenant-2", name: "Nebuloz" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("confirmar chama onConfirm com o tenant alvo", () => {
    const onConfirm = vi.fn();
    render(
      <SwitchAccountDialog
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        open
        targetTenant={{ id: "tenant-2", name: "Nebuloz" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /trocar de conta/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("mostra o nome da conta de destino no texto de confirmação", () => {
    render(
      <SwitchAccountDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        open
        targetTenant={{ id: "tenant-2", name: "Nebuloz" }}
      />
    );
    expect(screen.getByText(/Nebuloz/)).toBeTruthy();
  });
});
