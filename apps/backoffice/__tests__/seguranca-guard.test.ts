import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findFirst = vi.fn();
const userFindUnique = vi.fn();
const assertDentroDoLimite = vi.fn();

vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantMember: { findFirst },
    user: { findUnique: userFindUnique },
  },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("../lib/rate-limit", () => ({
  assertDentroDoLimite,
  RateLimitError: class extends Error {},
}));

const { requirePlatformStaff, requirePlatformStaffSemSegundoFator } =
  await import("../lib/guard");

/**
 * O beco, em asserção.
 *
 * O painel exige 2FA e a tela onde se cadastra 2FA fica no painel. Se
 * `/seguranca` passar a usar o guard cheio — porque alguém moveu a rota para
 * dentro do grupo `(staff)`, ou trocou a chamada por engano — quem precisa da
 * tela deixa de alcançá-la, e a única saída volta a ser SQL.
 *
 * Este arquivo falha nesse dia.
 */

const STAFF_SEM_2FA = {
  user: { id: "u-1", email: "ana@nebuloz.ai", name: "Ana" },
  session: {},
};

describe("guard de /seguranca", () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
    userFindUnique.mockReset();
    assertDentroDoLimite.mockReset();

    getSession.mockResolvedValue(STAFF_SEM_2FA);
    findFirst.mockResolvedValue({ role: "ADMIN" });
    userFindUnique.mockResolvedValue({ twoFactorEnabled: false });
  });

  it("deixa entrar staff SEM segundo fator — é o ponto da rota", async () => {
    const staff = await requirePlatformStaffSemSegundoFator();

    expect(staff.email).toBe("ana@nebuloz.ai");
    expect(staff.canWrite).toBe(true);
  });

  it("o guard cheio recusa esse MESMO staff", async () => {
    // Mesma sessão, mesmo membership. A diferença é só o segundo fator — e é
    // por isso que a rota de cadastro precisa da versão sem ele.
    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("a recusa aponta para onde cadastrar", async () => {
    // Mensagem que manda a pessoa ao "seu perfil" é o beco: o painel não tem
    // perfil, e o app é outro domínio.
    await expect(requirePlatformStaff()).rejects.toThrow(/\/seguranca/);
  });

  it("ainda exige sessão", async () => {
    getSession.mockResolvedValue(null);

    await expect(requirePlatformStaffSemSegundoFator()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("ainda exige ser da equipe — não é porta dos fundos", async () => {
    findFirst.mockResolvedValue(null);

    await expect(requirePlatformStaffSemSegundoFator()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("ainda passa pelo teto de requisição", async () => {
    await requirePlatformStaffSemSegundoFator();

    expect(assertDentroDoLimite).toHaveBeenCalledWith("staff", "u-1");
  });

  it("não consulta twoFactorEnabled — nem para registrar", async () => {
    await requirePlatformStaffSemSegundoFator();

    expect(userFindUnique).not.toHaveBeenCalled();
  });
});
