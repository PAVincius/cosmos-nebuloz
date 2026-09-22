// clientes-busca-action.test.ts — a busca de clientes da paleta (Ctrl/⌘+K).
// Só leitura, com teto: a paleta mostra poucos, e a carteira inteira não
// atravessa a rede a cada tecla.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesma armadilha das outras suítes de action: o guard puxa
// @repo/auth/server e @repo/database no import.
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
  platformDb: { tenant: { findMany } },
  ProvisioningError: class ProvisioningError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guard")>();
  return {
    ...actual,
    requirePlatformStaff: vi.fn(async () => ({
      canWrite: false,
      email: "a@b.c",
      name: null,
      userId: "u",
    })),
  };
});

const { buscarClientes } = await import("../app/actions/clientes-busca");
const { requirePlatformStaff, StaffAuthError } = await import("@/lib/guard");

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([{ name: "Acme", slug: "acme" }]);
});

describe("buscarClientes", () => {
  it("exige staff e devolve nome e slug", async () => {
    const res = await buscarClientes("acm");

    expect(requirePlatformStaff).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ data: [{ name: "Acme", slug: "acme" }], ok: true });
  });

  it("procura no nome (sem caixa) e no slug, fora o tenant interno, com teto", async () => {
    await buscarClientes("  AcMe ");

    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      isSystem: false,
      OR: [
        { name: { contains: "AcMe", mode: "insensitive" } },
        { slug: { contains: "acme" } },
      ],
    });
    expect(args.select).toEqual({ name: true, slug: true });
    expect(args.take).toBeGreaterThan(0);
    expect(args.take).toBeLessThanOrEqual(10);
  });

  it("menos de 2 letras não vai ao banco", async () => {
    const res = await buscarClientes(" a ");

    expect(res.ok).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("sem staff, recusa sem ler", async () => {
    vi.mocked(requirePlatformStaff).mockRejectedValueOnce(
      new StaffAuthError("FORBIDDEN", "Esta conta não é da equipe da Nebuloz.")
    );

    const res = await buscarClientes("acme");

    expect(res).toMatchObject({ code: "FORBIDDEN", ok: false });
    expect(findMany).not.toHaveBeenCalled();
  });
});
