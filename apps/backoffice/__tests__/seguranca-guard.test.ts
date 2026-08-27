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

  it("a recusa por falta de 2FA se identifica, para a tela oferecer o botão certo", async () => {
    // Sem o motivo, esta recusa chega à tela como qualquer outro FORBIDDEN, e a
    // única ação oferecida vira "entrar com outra conta" — que manda a pessoa
    // para o mesmo lugar de novo.
    await expect(requirePlatformStaff()).rejects.toMatchObject({
      motivo: "SEM_SEGUNDO_FATOR",
    });
  });

  // Regressão do laço fechado: o guard exigia `session.twoFactorVerified`, um
  // campo que o better-auth 1.6.26 não escreve em lugar nenhum — `verifyTotp`
  // fecha o desafio com `createSession(userId, false, ...)`, sessão comum. Todo
  // staff com 2FA ligado batia num "saia e entre de novo" que o login seguinte
  // reproduzia. O verde de antes vinha de um mock que fabricava o campo; por
  // isso a sessão aqui é a que a lib realmente entrega.
  it("sessão sem carimbo nenhum passa — é a que a lib entrega após o TOTP", async () => {
    userFindUnique.mockResolvedValue({ twoFactorEnabled: true });
    getSession.mockResolvedValue(STAFF_SEM_2FA);

    await expect(requirePlatformStaff()).resolves.toMatchObject({
      email: "ana@nebuloz.ai",
    });
  });

  it("não é da equipe NÃO ganha o motivo — a saída dela é outra", async () => {
    findFirst.mockResolvedValue(null);

    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "FORBIDDEN",
      motivo: undefined,
    });
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
