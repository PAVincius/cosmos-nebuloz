import { beforeEach, describe, expect, it, vi } from "vitest";

// Benchmark do Meridian na ficha do cliente (specs/012): a action é a única
// porta do back-office para ligar/desligar. O escritor de @repo/provisioning
// NÃO checa papel — quem barra staff de leitura é esta action.

vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@repo/database", () => ({
  database: { tenantMember: { findFirst: vi.fn() } },
  withTenantDb: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  assertDentroDoLimite: vi.fn(async () => {}),
  RateLimitError: class RateLimitError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));
vi.mock("@/lib/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guard")>();
  return { ...actual, requirePlatformStaff: vi.fn() };
});
vi.mock("@repo/provisioning", () => ({
  platformDb: {
    tenant: { findUnique: vi.fn() },
    meridianBenchmarkEnablement: { findUnique: vi.fn() },
  },
  ProvisioningError: class ProvisioningError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  setMeridianBenchmarkEnablement: vi.fn(),
}));

const { getMeridianBenchmark, setMeridianBenchmarkAction } = await import(
  "../app/actions/meridian-benchmark"
);
const { requirePlatformStaff } = await import("../lib/guard");
const { revalidatePath } = await import("next/cache");
const { platformDb, ProvisioningError, setMeridianBenchmarkEnablement } =
  await import("@repo/provisioning");

const staff = (canWrite: boolean) => ({
  userId: "staff-1",
  email: "s@nebuloz.ai",
  name: "Staff",
  canWrite,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformStaff).mockResolvedValue(staff(true));
  vi.mocked(platformDb.tenant.findUnique).mockResolvedValue({
    id: "t1",
    isSystem: false,
    isInternalTenant: false,
  } as never);
});

describe("setMeridianBenchmarkAction", () => {
  it("staff de leitura é barrado antes de qualquer escrita", async () => {
    vi.mocked(requirePlatformStaff).mockResolvedValue(staff(false));

    const r = await setMeridianBenchmarkAction({
      slug: "vanta-saude",
      enabled: true,
      agreementRef: "ADT-1",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("FORBIDDEN");
    }
    expect(setMeridianBenchmarkEnablement).not.toHaveBeenCalled();
  });

  it("liga com a referência, ator e tenant resolvido pelo slug", async () => {
    const r = await setMeridianBenchmarkAction({
      slug: "vanta-saude",
      enabled: true,
      agreementRef: "ADT-2026-014",
    });

    expect(r.ok).toBe(true);
    expect(setMeridianBenchmarkEnablement).toHaveBeenCalledWith(platformDb, {
      tenantId: "t1",
      enabled: true,
      agreementRef: "ADT-2026-014",
      actorUserId: "staff-1",
      actorName: "Staff",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/clientes/vanta-saude");
  });

  it("desliga sem exigir referência", async () => {
    const r = await setMeridianBenchmarkAction({
      slug: "vanta-saude",
      enabled: false,
    });

    expect(r.ok).toBe(true);
    expect(setMeridianBenchmarkEnablement).toHaveBeenCalledWith(
      platformDb,
      expect.objectContaining({ enabled: false, agreementRef: null })
    );
  });

  it("devolve a mensagem clara quando o escritor exige o aditivo", async () => {
    vi.mocked(setMeridianBenchmarkEnablement).mockRejectedValue(
      new ProvisioningError(
        "BENCHMARK_AGREEMENT_REQUIRED",
        "Informe a referência do aditivo contratual (DPA §2.1) para ligar o benchmark deste cliente."
      )
    );

    const r = await setMeridianBenchmarkAction({
      slug: "vanta-saude",
      enabled: true,
      agreementRef: "  ",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/referência do aditivo/);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("recusa referência longa demais sem chegar ao escritor", async () => {
    const r = await setMeridianBenchmarkAction({
      slug: "vanta-saude",
      enabled: true,
      agreementRef: "x".repeat(201),
    });

    expect(r.ok).toBe(false);
    expect(setMeridianBenchmarkEnablement).not.toHaveBeenCalled();
  });

  it("cliente inexistente ou de sistema não liga nada", async () => {
    vi.mocked(platformDb.tenant.findUnique).mockResolvedValue(null);

    const r = await setMeridianBenchmarkAction({
      slug: "nao-existe",
      enabled: true,
      agreementRef: "ADT-1",
    });

    expect(r.ok).toBe(false);
    expect(setMeridianBenchmarkEnablement).not.toHaveBeenCalled();
  });
});

describe("getMeridianBenchmark", () => {
  it("sem linha na tabela o estado é desligado, sem referência", async () => {
    vi.mocked(
      platformDb.meridianBenchmarkEnablement.findUnique
    ).mockResolvedValue(null);

    const r = await getMeridianBenchmark("vanta-saude");

    expect(r).toEqual({
      ok: true,
      data: {
        enabled: false,
        agreementRef: null,
        updatedAt: null,
        isInternalTenant: false,
      },
    });
  });

  it("com linha devolve estado, referência e data em ISO", async () => {
    vi.mocked(
      platformDb.meridianBenchmarkEnablement.findUnique
    ).mockResolvedValue({
      enabled: true,
      agreementRef: "ADT-2026-014",
      updatedAt: new Date("2026-09-29T12:00:00Z"),
    } as never);

    const r = await getMeridianBenchmark("vanta-saude");

    expect(r.ok && r.data).toMatchObject({
      enabled: true,
      agreementRef: "ADT-2026-014",
      updatedAt: "2026-09-29T12:00:00.000Z",
    });
  });
});
