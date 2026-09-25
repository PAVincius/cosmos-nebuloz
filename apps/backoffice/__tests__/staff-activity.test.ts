import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesma armadilha das outras suítes: o módulo importa requirePlatformStaff,
// que puxa @repo/auth/server (quebra ao carregar) e @repo/database (valida
// DATABASE_URL no import). Os mesmos mocks evitam os dois problemas.
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const findMany = vi.fn();

vi.mock("@repo/provisioning", () => ({
  platformDb: { auditLog: { findMany } },
  ProvisioningError: class ProvisioningError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Troca só o requirePlatformStaff por um staff falso, mantendo o resto do
// módulo real — inclusive StaffAuthError, que o safeAction usa por
// `instanceof` para traduzir o erro em código "FORBIDDEN".
vi.mock("@/lib/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guard")>();
  return {
    ...actual,
    requirePlatformStaff: vi.fn(async () => ({
      userId: "u",
      email: "a@b.c",
      name: null,
      canWrite: false,
    })),
  };
});

const { listStaffActivity } = await import("../app/actions/clients");
const { requirePlatformStaff } = await import("@/lib/guard");

describe("listStaffActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it("filtra por platformStaff — sem isso a trilha mostraria ato de cliente", async () => {
    await listStaffActivity();

    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      metadata: { path: ["platformStaff"], equals: true },
    });
  });

  it("tem teto de resultados — trilha sem limite derruba a tela um dia", async () => {
    await listStaffActivity();
    expect(findMany.mock.calls[0][0].take).toBe(100);

    await listStaffActivity(10);
    expect(findMany.mock.calls[1][0].take).toBe(10);
  });

  it("exige staff — trilha é dado sensível", async () => {
    await listStaffActivity();
    expect(requirePlatformStaff).toHaveBeenCalled();
  });

  it("mapeia target e actorName do metadata, com fallback quando faltam", async () => {
    findMany.mockResolvedValue([
      {
        id: "a1",
        action: "module.contracted",
        metadata: { target: "vanta-saude · CHARTER", actorName: "Vinícius" },
        createdAt: new Date("2026-07-31T12:00:00Z"),
        tenant: { slug: "vanta-saude", isSystem: false },
      },
      {
        id: "a2",
        action: "tenant.provisioned",
        metadata: {},
        createdAt: new Date("2026-07-31T12:05:00Z"),
        tenant: { slug: "vanta-saude", isSystem: false },
      },
    ]);

    const result = await listStaffActivity();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]).toMatchObject({
        action: "module.contracted",
        target: "vanta-saude · CHARTER",
        actorName: "Vinícius",
      });
      expect(result.data[1]).toMatchObject({ target: "—", actorName: null });
    }
  });

  // Ato de staff é gravado no tenant do cliente (`logPlatformAudit`): o slug
  // dele é a saída da linha para o detalhe. O tenant interno não tem
  // detalhe de cliente — lá, a linha não vira link.
  it("traz o slug do cliente citado, e nulo no tenant interno", async () => {
    findMany.mockResolvedValue([
      {
        id: "a1",
        action: "module.contracted",
        metadata: { target: "vanta-saude · CHARTER" },
        createdAt: new Date("2026-07-31T12:00:00Z"),
        tenant: { slug: "vanta-saude", isSystem: false },
      },
      {
        id: "a2",
        action: "created",
        metadata: { target: "P-0001 · Atlas" },
        createdAt: new Date("2026-07-31T12:05:00Z"),
        tenant: { slug: "nebuloz", isSystem: true },
      },
    ]);

    const result = await listStaffActivity();

    expect(findMany.mock.calls[0][0].select.tenant).toEqual({
      select: { slug: true, isSystem: true },
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(result.data[0].clienteSlug).toBe("vanta-saude");
    expect(result.data[1].clienteSlug).toBeNull();
  });
});
