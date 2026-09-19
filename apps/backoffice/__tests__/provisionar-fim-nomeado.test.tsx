/** @vitest-environment jsdom */
// provisionar-fim-nomeado.test.tsx — crítica rodada 3, persona Riley:
// com o cartão "sem dono" na tela o formulário seguia submetível e o servidor
// sufixava o slug — nasciam dois clientes. E o caminho feliz redirecionava
// mudo: a operação mais importante do painel terminava sem uma frase.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewClientForm } from "@/app/(staff)/clientes/novo/form";

const { provisionMock, pushMock } = vi.hoisted(() => ({
  provisionMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/app/actions/provisioning", () => ({
  provisionTenantAction: provisionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

function preencherEConfirmar() {
  render(<NewClientForm canWrite modulos={["COSMOS"]} />);
  fireEvent.change(screen.getByLabelText("Nome da organização"), {
    target: { value: "Atlas Energia" },
  });
  fireEvent.change(screen.getByLabelText("E-mail do responsável"), {
    target: { value: "dono@atlas.com.br" },
  });
  fireEvent.submit(screen.getByRole("form", { name: /Provisionar/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
}

beforeEach(() => {
  provisionMock.mockReset();
  pushMock.mockReset();
});

describe("provisionar — fim nomeado e sem segundo cliente", () => {
  it("caminho feliz redireciona com ?criado=1 para o detalhe dizer o nome", async () => {
    provisionMock.mockResolvedValue({
      data: { ownerLinked: true, slug: "atlas-energia" },
      ok: true,
    });
    preencherEConfirmar();
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/clientes/atlas-energia?criado=1")
    );
  });

  it("com o cartão 'sem dono' na tela, o submit fica desabilitado e não provisiona de novo", async () => {
    provisionMock.mockResolvedValue({
      data: { ownerLinked: false, slug: "atlas-energia" },
      ok: true,
    });
    preencherEConfirmar();
    await screen.findByText(/ainda não tem conta/);

    const submit = screen.getByRole("button", { name: /Provisionar cliente/ });
    expect(submit.hasAttribute("disabled")).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: /Provisionar/ }));
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(provisionMock).toHaveBeenCalledTimes(1);
  });
});
