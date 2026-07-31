import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const findFirst = vi.fn();

vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const { requirePlatformStaff, SYSTEM_TENANT_ID } = await import("../lib/guard");

describe("requirePlatformStaff", () => {
  beforeEach(() => {
    getSession.mockReset();
    findFirst.mockReset();
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
});
