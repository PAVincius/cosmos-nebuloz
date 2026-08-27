import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findFirst: vi.fn(),
  userFindUnique: vi.fn(),
  // O `redirect` do Next não retorna: ele lança e o framework intercepta.
  // Simular retorno normal esconderia justamente o defeito que este módulo
  // existe para evitar — seguir renderizando depois de mandar logar.
  redirectToSignIn: vi.fn(() => {
    throw new Error("NEXT_REDIRECT;/sign-in");
  }),
}));

vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: mocks.getSession } },
  redirectToSignIn: mocks.redirectToSignIn,
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findFirst: mocks.findFirst },
    user: { findUnique: mocks.userFindUnique },
  },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { resolveStaffAccess } = await import("../lib/staff-access");

describe("resolveStaffAccess", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.findFirst.mockReset();
    mocks.userFindUnique.mockReset();
    mocks.userFindUnique.mockResolvedValue({ twoFactorEnabled: true });
    // `mockClear`, não `mockReset`: reset apagaria o throw que imita o redirect.
    mocks.redirectToSignIn.mockClear();
  });

  it("sem sessão, manda logar", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(resolveStaffAccess()).rejects.toThrow(
      "NEXT_REDIRECT;/sign-in"
    );
    expect(mocks.redirectToSignIn).toHaveBeenCalledTimes(1);
  });

  it("sessão válida de quem não é staff é recusada sem voltar ao login", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-cliente", email: "ana@vanta.exemplo", name: "Ana" },
      session: { id: "sess-1" },
    });
    mocks.findFirst.mockResolvedValue(null);

    const access = await resolveStaffAccess();

    // Mandar logar de novo quem já está logado fecha o laço: entra, é recusado,
    // volta para o login, entra de novo. A recusa tem que ser dita na tela.
    expect(mocks.redirectToSignIn).not.toHaveBeenCalled();
    expect(access).toEqual({
      status: "forbidden",
      message: "Esta conta não é da equipe da Nebuloz.",
    });
  });

  it("staff ADMIN passa e pode escrever", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "user-staff",
        email: "vini@nebuloz.exemplo",
        name: "Vinícius",
      },
      session: { id: "sess-1" },
    });
    mocks.findFirst.mockResolvedValue({ role: "ADMIN" });

    const access = await resolveStaffAccess();

    expect(mocks.redirectToSignIn).not.toHaveBeenCalled();
    expect(access).toEqual({
      status: "ok",
      staff: {
        userId: "user-staff",
        email: "vini@nebuloz.exemplo",
        name: "Vinícius",
        canWrite: true,
      },
    });
  });

  it("staff sem ADMIN entra, mas só para ler", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-leitor", email: "leitor@nebuloz.exemplo", name: null },
      session: { id: "sess-1" },
    });
    mocks.findFirst.mockResolvedValue({ role: "MEMBER" });

    const access = await resolveStaffAccess();

    expect(access.status).toBe("ok");
    expect(access.status === "ok" && access.staff.canWrite).toBe(false);
  });
});
