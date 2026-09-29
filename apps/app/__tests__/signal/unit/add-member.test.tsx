import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Adicionar pessoa ao Signal (P1-c). Sem este caminho, quem tinha o módulo mas
// nenhum papel caía em signal-indisponivel. A tela só oferece quem é da
// organização e ainda não tem papel, e quem não administra papéis nem vê o card.

const h = vi.hoisted(() => ({
  listAddableMembers: vi.fn(),
  addSignalMember: vi.fn(),
}));

vi.mock("@/app/(signal)/actions/settings", () => ({
  listAddableMembers: h.listAddableMembers,
  addSignalMember: h.addSignalMember,
}));
vi.mock("@/components/signal/base", async () => {
  const primitives = await vi.importActual<
    typeof import("@/components/charter/base")
  >("../../../components/charter/base");
  const data = await vi.importActual<
    typeof import("@/components/charter/use-charter-data")
  >("../../../components/charter/use-charter-data");
  return { ...primitives, useSignalData: data.useCharterData };
});

import { AddMemberCard } from "@/components/signal/add-member";

beforeEach(() => {
  vi.clearAllMocks();
  h.listAddableMembers.mockResolvedValue({
    ok: true,
    data: [
      { userId: "u2", name: "Caio", email: "c@x.test" },
      { userId: "u3", name: "Dani", email: "d@x.test" },
    ],
  });
});

describe("AddMemberCard", () => {
  it("oferece só quem é da organização e ainda não tem papel", async () => {
    render(<AddMemberCard onAdded={vi.fn()} />);
    const select = (await screen.findByLabelText(
      "Pessoa da organização"
    )) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      "Escolha a pessoa",
      "Caio · c@x.test",
      "Dani · d@x.test",
    ]);
  });

  it("os papéis usam o nome completo (Dono de iniciativa)", async () => {
    render(<AddMemberCard onAdded={vi.fn()} />);
    const role = (await screen.findByLabelText(
      "Papel no Signal"
    )) as HTMLSelectElement;
    expect(Array.from(role.options).map((o) => o.text)).toContain(
      "Dono de iniciativa"
    );
  });

  it("adicionar fica desabilitado até escolher a pessoa; depois chama a action", async () => {
    h.addSignalMember.mockResolvedValue({ ok: true, data: { role: "VIEWER" } });
    const onAdded = vi.fn();
    render(<AddMemberCard onAdded={onAdded} />);
    const btn = (await screen.findByRole("button", {
      name: "Adicionar ao Signal",
    })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Pessoa da organização"), {
      target: { value: "u2" },
    });
    await waitFor(() => expect(btn.disabled).toBe(false));
    fireEvent.click(btn);
    await waitFor(() =>
      expect(h.addSignalMember).toHaveBeenCalledWith({
        userId: "u2",
        role: "VIEWER",
      })
    );
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
  });

  it("recusa do servidor aparece na tela", async () => {
    h.addSignalMember.mockResolvedValue({
      ok: false,
      error: "Esta pessoa já está no Signal.",
    });
    render(<AddMemberCard onAdded={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Pessoa da organização"), {
      target: { value: "u2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar ao Signal" })
    );
    expect(await screen.findByText(/já está no Signal/)).toBeDefined();
  });

  it("quem não administra papéis não vê o card", async () => {
    h.listAddableMembers.mockResolvedValue({
      ok: false,
      error: "Seu papel não permite.",
    });
    const { container } = render(<AddMemberCard onAdded={vi.fn()} />);
    await waitFor(() => expect(h.listAddableMembers).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("todos já têm papel: diz isso, sem lista vazia muda", async () => {
    h.listAddableMembers.mockResolvedValue({ ok: true, data: [] });
    render(<AddMemberCard onAdded={vi.fn()} />);
    expect(
      await screen.findByText(/Todas as pessoas da organização já têm papel/)
    ).toBeDefined();
  });
});
