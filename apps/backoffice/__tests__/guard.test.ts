import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findFirst = vi.fn();
const assertDentroDoLimite = vi.fn();

vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("../lib/rate-limit", () => ({
  assertDentroDoLimite,
  RateLimitError: class extends Error {},
}));

const { requirePlatformStaff, SYSTEM_TENANT_ID } = await import("../lib/guard");

describe("requirePlatformStaff", () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
    assertDentroDoLimite.mockReset();
  });

  it("nega quem não tem sessão", async () => {
    getSession.mockResolvedValue(null);

    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("nega usuário de tenant cliente — membership no cliente não é staff", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-cliente", email: "ana@vanta.exemplo", name: "Ana" },
    });
    findFirst.mockResolvedValue(null);

    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // A consulta tem que ser pelo tenant interno, não por "algum" tenant.
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-cliente", tenantId: SYSTEM_TENANT_ID },
      select: { role: true },
    });
  });

  it("aceita membro do tenant interno", async () => {
    getSession.mockResolvedValue({
      user: {
        id: "user-staff",
        email: "vini@nebuloz.exemplo",
        name: "Vinícius",
      },
    });
    findFirst.mockResolvedValue({ role: "ADMIN" });

    const staff = await requirePlatformStaff();

    expect(staff).toEqual({
      userId: "user-staff",
      email: "vini@nebuloz.exemplo",
      name: "Vinícius",
      canWrite: true,
    });
  });

  it("membro não-ADMIN entra, mas só lê", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-staff", email: "leitor@nebuloz.exemplo", name: null },
    });
    findFirst.mockResolvedValue({ role: "MEMBER" });

    const staff = await requirePlatformStaff();

    expect(staff.canWrite).toBe(false);
  });
  it("aplica o teto de requisição, com a identidade como chave", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-staff", email: "v@n.com", name: "V" },
    });
    findFirst.mockResolvedValue({ role: "ADMIN" });

    await requirePlatformStaff();

    expect(assertDentroDoLimite).toHaveBeenCalledWith("staff", "user-staff");
  });

  it("o teto vem antes da consulta de membership", async () => {
    // Quem já autenticou mas não é da equipe também para no teto, em vez de
    // bater no banco a cada tentativa.
    getSession.mockResolvedValue({
      user: { id: "user-x", email: "x@n.com", name: null },
    });
    assertDentroDoLimite.mockRejectedValue(new Error("estourou"));

    await expect(requirePlatformStaff()).rejects.toThrow("estourou");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("sessão ausente não gasta cota — não há identidade para cobrar", async () => {
    getSession.mockResolvedValue(null);

    await expect(requirePlatformStaff()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(assertDentroDoLimite).not.toHaveBeenCalled();
  });
});
