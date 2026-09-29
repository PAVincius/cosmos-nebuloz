import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Tela de papéis de adoção (Crivo F5): oferecia Administrador e Consultor a quem
// é Consultor (o servidor nega) e o Salvar seguia habilitado depois da recusa.

const h = vi.hoisted(() => ({
  listScaffoldMembers: vi.fn(),
  assignScaffoldRole: vi.fn(),
}));

vi.mock("@/app/(scaffold)/actions/memberships", () => ({
  listScaffoldMembers: h.listScaffoldMembers,
  assignScaffoldRole: h.assignScaffoldRole,
}));

import MembersScreen from "@/components/scaffold/screens/members";

const BELOW = [
  "TEAM_MEMBER",
  "PROCESS_OWNER",
  "TRANSFORMATION_LEAD",
  "SPONSOR",
  "TEAM_LEAD",
];

const rows = () => [
  {
    userId: "clx000000000000000000ana01",
    name: "Ana",
    email: "ana@x.com",
    role: "TEAM_MEMBER",
    assignable: BELOW,
    lockedReason: null,
  },
  {
    userId: "clx000000000000000000adm01",
    name: "Beto Admin",
    email: "beto@x.com",
    role: "ADMIN",
    assignable: [],
    lockedReason:
      "Só um administrador altera o papel de administrador ou de consultor.",
  },
  {
    userId: "clx0000000000000000000eu01",
    name: "Eu Mesma",
    email: "eu@x.com",
    role: "CONSULTANT",
    assignable: [],
    lockedReason: "Ninguém altera o próprio papel.",
  },
  {
    userId: "clx000000000000000000sem01",
    name: "Sem Papel",
    email: "sem@x.com",
    role: null,
    assignable: BELOW,
    lockedReason: null,
  },
];

const optionsOf = (name: string) =>
  [
    ...(
      screen.getByLabelText(`Papel de adoção de ${name}`) as HTMLSelectElement
    ).options,
  ].map((o) => o.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  h.listScaffoldMembers.mockResolvedValue({ ok: true, data: rows() });
  h.assignScaffoldRole.mockResolvedValue({ ok: true, data: {} });
});

describe("tela de papéis de adoção", () => {
  it("oferece só os papéis que o ator pode atribuir, com os dois papéis de leitura", async () => {
    render(<MembersScreen />);
    await screen.findByText("Ana");
    const opts = optionsOf("Ana");
    expect(opts).toEqual([
      "Membro do time",
      "Dono do processo",
      "Líder de transformação",
      "Patrocinador (só leitura)",
      "Líder do time (só leitura)",
    ]);
    expect(opts).not.toContain("Administrador");
    expect(opts).not.toContain("Consultor");
  });

  it("linha travada não tem seletor nem Salvar, e diz por quê", async () => {
    render(<MembersScreen />);
    await screen.findByText("Beto Admin");
    expect(screen.queryByLabelText("Papel de adoção de Beto Admin")).toBeNull();
    expect(screen.queryByLabelText("Papel de adoção de Eu Mesma")).toBeNull();
    expect(screen.getByText(/só um administrador altera/i)).toBeDefined();
    expect(screen.getByText("Ninguém altera o próprio papel.")).toBeDefined();
    // O papel atual continua visível, por extenso.
    expect(screen.getByText("Administrador")).toBeDefined();
  });

  it("pessoa sem papel: escolhe um dos permitidos", async () => {
    render(<MembersScreen />);
    await screen.findByText("Sem Papel");
    expect(optionsOf("Sem Papel")).not.toContain("Administrador");
    expect(optionsOf("Sem Papel")).toContain("Dono do processo");
  });

  it("Salvar só habilita quando o papel muda, e manda o escolhido", async () => {
    render(<MembersScreen />);
    await screen.findByText("Ana");
    const anaSave = () =>
      screen.getAllByRole("button", { name: "Salvar" })[0] as HTMLButtonElement;
    expect(anaSave().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Papel de adoção de Ana"), {
      target: { value: "PROCESS_OWNER" },
    });
    expect(anaSave().disabled).toBe(false);
    fireEvent.click(anaSave());
    await waitFor(() =>
      expect(h.assignScaffoldRole).toHaveBeenCalledWith({
        userId: "clx000000000000000000ana01",
        role: "PROCESS_OWNER",
      })
    );
  });

  it("depois da recusa, Salvar volta a desabilitar até a escolha mudar", async () => {
    h.assignScaffoldRole.mockResolvedValue({
      ok: false,
      error: "Seu papel não pode conceder nem retirar este papel.",
      code: "ROLE_ASSIGNMENT_FORBIDDEN",
    });
    render(<MembersScreen />);
    await screen.findByText("Ana");
    const save = () =>
      screen.getAllByRole("button", { name: "Salvar" })[0] as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText("Papel de adoção de Ana"), {
      target: { value: "SPONSOR" },
    });
    fireEvent.click(save());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("não pode conceder");
    await waitFor(() => expect(save().disabled).toBe(true));

    // Outra escolha reabilita.
    fireEvent.change(screen.getByLabelText("Papel de adoção de Ana"), {
      target: { value: "TEAM_LEAD" },
    });
    expect(save().disabled).toBe(false);
    // E o aviso da tentativa anterior sai de cena.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falha ao carregar continua sendo tela de erro com tentar de novo", async () => {
    h.listScaffoldMembers.mockResolvedValue({ ok: false, error: "Sem acesso" });
    render(<MembersScreen />);
    expect(await screen.findByText(/Sem acesso/)).toBeDefined();
  });
});
