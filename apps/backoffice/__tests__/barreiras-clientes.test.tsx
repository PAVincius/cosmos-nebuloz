/** @vitest-environment jsdom */
// barreiras-clientes.test.tsx — [P1] provisionar tenant e trocar papel de
// membro eram um clique (o `<select>` gravava no `onChange`, inclusive
// para/de ADMIN). Por item: gatilho não chama; alvo escrito; Confirmar chama
// com o payload; Voltar não chama — e, no papel, Voltar restaura o valor.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbaUsuarios } from "@/app/(staff)/clientes/[slug]/abas/usuarios";
import { NewClientForm } from "@/app/(staff)/clientes/novo/form";
import type { TenantMemberRow } from "@/app/actions/tenant-members";

const { provisionMock, roleMock, pushMock } = vi.hoisted(() => ({
  provisionMock: vi.fn(),
  pushMock: vi.fn(),
  roleMock: vi.fn(),
}));

vi.mock("@/app/actions/provisioning", () => ({
  provisionTenantAction: provisionMock,
}));

vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: roleMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

describe("Provisionar tenant", () => {
  beforeEach(() => {
    provisionMock.mockReset();
    provisionMock.mockResolvedValue({
      data: { ownerLinked: true, slug: "atlas-energia" },
      ok: true,
    });
    pushMock.mockReset();
  });

  function preencher() {
    render(<NewClientForm canWrite modulos={["COSMOS"]} />);
    fireEvent.change(screen.getByLabelText("Nome da organização"), {
      target: { value: "Atlas Energia" },
    });
    fireEvent.change(screen.getByLabelText("E-mail do responsável"), {
      target: { value: "dono@atlas.com.br" },
    });
  }

  it("o clique em Provisionar não chama a action e mostra o slug ao vivo", () => {
    preencher();

    fireEvent.click(screen.getByRole("button", { name: "Provisionar tenant" }));

    expect(provisionMock).not.toHaveBeenCalled();
    // O slug aparece no hint do campo e na barreira — o `mono` da barreira.
    expect(screen.getByText(/ganha acesso em segundos/)).toBeTruthy();
    expect(screen.getAllByText(/atlas-energia/).length).toBeGreaterThan(1);
  });

  it("Confirmar chama provisionTenantAction com o payload", async () => {
    preencher();

    fireEvent.click(screen.getByRole("button", { name: "Provisionar tenant" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(provisionMock).toHaveBeenCalledTimes(1));
    expect(provisionMock).toHaveBeenCalledWith({
      modules: [{ module: "COSMOS", status: "ACTIVE" }],
      name: "Atlas Energia",
      ownerEmail: "dono@atlas.com.br",
    });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/clientes/atlas-energia")
    );
  });

  it("Voltar não chama", () => {
    preencher();

    fireEvent.click(screen.getByRole("button", { name: "Provisionar tenant" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(provisionMock).not.toHaveBeenCalled();
  });

  it("com o formulário incompleto o gatilho fica desabilitado", () => {
    render(<NewClientForm canWrite modulos={["COSMOS"]} />);

    const gatilho = screen.getByRole("button", { name: "Provisionar tenant" });
    expect(gatilho.hasAttribute("disabled")).toBe(true);
  });

  it("sem permissão, usa a frase única do painel para somente leitura", () => {
    render(<NewClientForm canWrite={false} modulos={["COSMOS"]} />);

    // O `WriteButton` repete a mesma frase em `sr-only` para o leitor de tela;
    // aqui o que importa é o aviso visível do formulário.
    expect(
      screen.getByText(
        "Somente leitura: seu papel no back-office é MEMBER. Um ADMIN precisa fazer esta ação.",
        { selector: "span:not(.sr-only)" }
      )
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Provisionar tenant" })
        .hasAttribute("disabled")
    ).toBe(true);
  });
});

const MEMBRO: TenantMemberRow = {
  desde: "2026-09-01T00:00:00.000Z",
  email: "ana@atlas.com.br",
  id: "m-1",
  nome: "Ana",
  role: "DEV",
};

function montarUsuarios(membro: TenantMemberRow = MEMBRO) {
  return render(
    <AbaUsuarios canWrite membros={[membro]} slug="atlas-energia" />
  );
}

describe("Usuários — trocar papel", () => {
  beforeEach(() => {
    roleMock.mockReset();
    roleMock.mockResolvedValue({ data: { id: "m-1" }, ok: true });
  });

  it("mudar o select não grava: aparece a pergunta com nome e papel", () => {
    montarUsuarios();

    fireEvent.change(screen.getByLabelText("Papel de ana@atlas.com.br"), {
      target: { value: "ADMIN" },
    });

    expect(roleMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Trocar papel de Ana para ADMIN/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });

  it("Confirmar chama updateTenantMemberRoleAction com slug, membro e papel", async () => {
    montarUsuarios();

    fireEvent.change(screen.getByLabelText("Papel de ana@atlas.com.br"), {
      target: { value: "ADMIN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(roleMock).toHaveBeenCalledTimes(1));
    expect(roleMock).toHaveBeenCalledWith({
      memberId: "m-1",
      role: "ADMIN",
      slug: "atlas-energia",
    });
  });

  it("Voltar não chama e restaura o valor do select", () => {
    montarUsuarios();

    const select = screen.getByLabelText(
      "Papel de ana@atlas.com.br"
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "ADMIN" } });
    expect(select.value).toBe("ADMIN");

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(roleMock).not.toHaveBeenCalled();
    expect(select.value).toBe("DEV");
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
  });

  it("entrar ou sair de ADMIN é vermelho; entre os outros papéis, accent", () => {
    montarUsuarios();

    const select = screen.getByLabelText("Papel de ana@atlas.com.br");
    fireEvent.change(select, { target: { value: "ADMIN" } });
    let moldura = screen.getByText(/Trocar papel de Ana para ADMIN/)
      .parentElement as HTMLElement;
    expect(moldura.style.border).toContain("var(--red-rgb)");

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.change(select, { target: { value: "SM" } });
    moldura = screen.getByText(/Trocar papel de Ana para SM/)
      .parentElement as HTMLElement;
    expect(moldura.style.border).toContain("var(--accent-rgb)");
  });
});
