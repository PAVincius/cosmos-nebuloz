/** @vitest-environment jsdom */
// clientes-novo-form.test.tsx — heurística 7 (eficiência): o formulário de
// provisionar é um `<form>` de verdade. Enter num campo leva à barreira (não
// pula por cima dela: provisionar chega ao cliente em segundos e não tem
// desfazer), e o botão de provisionar é o submit do formulário.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewClientForm } from "@/app/(staff)/clientes/novo/form";

const { provisionMock } = vi.hoisted(() => ({ provisionMock: vi.fn() }));

vi.mock("@/app/actions/provisioning", () => ({
  provisionTenantAction: provisionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function preencher() {
  render(<NewClientForm canWrite modulos={["COSMOS"]} />);
  fireEvent.change(screen.getByLabelText("Nome da organização"), {
    target: { value: "Atlas Energia" },
  });
  fireEvent.change(screen.getByLabelText("E-mail do responsável"), {
    target: { value: "dono@atlas.com.br" },
  });
  return screen.getByRole("form", { name: /Provisionar/ });
}

beforeEach(() => {
  provisionMock.mockReset();
  provisionMock.mockResolvedValue({
    data: { ownerLinked: true, slug: "atlas-energia" },
    ok: true,
  });
});

describe("NewClientForm — <form>", () => {
  it("os campos vivem num <form> e o botão de provisionar é o submit", () => {
    const form = preencher();

    expect(screen.getByLabelText("Nome da organização").closest("form")).toBe(
      form
    );
    expect(
      screen
        .getByRole("button", { name: "Provisionar tenant" })
        .getAttribute("type")
    ).toBe("submit");
  });

  it("submeter (Enter) abre a barreira com o alvo, sem chamar a action", () => {
    const form = preencher();

    fireEvent.submit(form);

    expect(provisionMock).not.toHaveBeenCalled();
    expect(screen.getByText(/ganha acesso em segundos/)).toBeTruthy();
    expect(screen.getAllByText(/atlas-energia/).length).toBeGreaterThan(1);
  });

  it("da barreira aberta por Enter, Confirmar chama a action uma vez", async () => {
    const form = preencher();

    fireEvent.submit(form);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(provisionMock).toHaveBeenCalledTimes(1));
  });

  it("Voltar fecha a barreira e devolve o botão de provisionar", () => {
    const form = preencher();

    fireEvent.submit(form);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByText(/ganha acesso em segundos/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Provisionar tenant" })
    ).toBeTruthy();
  });

  it("com o formulário incompleto, submeter não abre a barreira", () => {
    render(<NewClientForm canWrite modulos={["COSMOS"]} />);

    fireEvent.submit(screen.getByRole("form", { name: /Provisionar/ }));

    expect(screen.queryByText(/ganha acesso em segundos/)).toBeNull();
  });
});
