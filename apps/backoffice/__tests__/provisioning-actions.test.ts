import { describe, expect, it, vi } from "vitest";

// Mesma armadilha do clients-query.test.ts: o módulo importa requirePlatformStaff
// (que puxa @repo/auth/server, versão que quebra ao carregar) e @repo/database
// (que valida DATABASE_URL no import). Os mesmos mocks evitam os dois problemas.
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
}));
vi.mock("@repo/rbac", () => ({
  invalidateModuleCache: vi.fn(),
  invalidateSignalRoleCache: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

// Para o bloco de integração abaixo: troca só o requirePlatformStaff por um
// staff de leitura, mantendo o resto do módulo real — inclusive StaffAuthError,
// que o safeAction usa por `instanceof` para traduzir o erro em código "FORBIDDEN".
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

// As três funções de escrita do provisioning viram espiãs: é chamando
// `.not.toHaveBeenCalled()` nelas que a suíte prova que assertCanWrite barrou
// antes de qualquer efeito, não só que o Result voltou com ok: false.
vi.mock("@repo/provisioning", () => ({
  platformDb: { tenant: { findUnique: vi.fn(), findFirst: vi.fn() } },
  ProvisioningError: class ProvisioningError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  contractModule: vi.fn(),
  setModuleStatus: vi.fn(),
  bootstrapCharter: vi.fn(),
  bootstrapScaffold: vi.fn(),
  bootstrapSignal: vi.fn(),
  provisionTenant: vi.fn(),
}));

const {
  contractModuleAction,
  setModuleStatusAction,
  bootstrapCharterAction,
  bootstrapScaffoldAction,
  bootstrapSignalAction,
  provisionTenantAction,
} = await import("../app/actions/provisioning");
const { assertCanWrite, StaffAuthError } = await import("../lib/guard");
const {
  contractModule,
  setModuleStatus,
  bootstrapCharter,
  bootstrapScaffold,
  bootstrapSignal,
  provisionTenant,
} = await import("@repo/provisioning");
const { invalidateSignalRoleCache } = await import("@repo/rbac");
const { requirePlatformStaff } = await import("../lib/guard");
const { platformDb } = await import("@repo/provisioning");

describe("assertCanWrite", () => {
  it("deixa passar quem é ADMIN no tenant interno", () => {
    expect(() =>
      assertCanWrite({
        userId: "u",
        email: "a@b.c",
        name: null,
        canWrite: true,
      })
    ).not.toThrow();
  });

  it("barra quem só tem leitura — ver cliente não é contratar módulo", () => {
    expect(() =>
      assertCanWrite({
        userId: "u",
        email: "a@b.c",
        name: null,
        canWrite: false,
      })
    ).toThrow(StaffAuthError);
  });
});

describe("as actions de escrita barram staff de leitura", () => {
  it("contractModuleAction não escreve quando canWrite é false", async () => {
    const result = await contractModuleAction({
      slug: "vanta-saude",
      module: "CHARTER",
      status: "ACTIVE",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
    }
    expect(contractModule).not.toHaveBeenCalled();
  });

  it("setModuleStatusAction não escreve quando canWrite é false", async () => {
    const result = await setModuleStatusAction({
      slug: "vanta-saude",
      module: "CHARTER",
      status: "SUSPENDED",
    });

    expect(result.ok).toBe(false);
    expect(setModuleStatus).not.toHaveBeenCalled();
  });

  it("bootstrapCharterAction não escreve quando canWrite é false", async () => {
    const result = await bootstrapCharterAction({
      slug: "vanta-saude",
      complianceEmail: "ana@vanta.exemplo",
    });

    expect(result.ok).toBe(false);
    expect(bootstrapCharter).not.toHaveBeenCalled();
  });

  it("bootstrapScaffoldAction não escreve quando canWrite é false", async () => {
    const result = await bootstrapScaffoldAction({
      slug: "vanta-saude",
      adminEmail: "ana@vanta.exemplo",
    });

    expect(result.ok).toBe(false);
    expect(bootstrapScaffold).not.toHaveBeenCalled();
  });

  it("bootstrapSignalAction não escreve quando canWrite é false", async () => {
    const result = await bootstrapSignalAction({
      slug: "vanta-saude",
      adminEmail: "ana@vanta.exemplo",
    });

    expect(result.ok).toBe(false);
    expect(bootstrapSignal).not.toHaveBeenCalled();
  });

  it("provisionTenantAction não escreve quando canWrite é false", async () => {
    const result = await provisionTenantAction({
      name: "Vanta Saúde",
      ownerEmail: "ana@vanta.exemplo",
      modules: [{ module: "COSMOS", status: "ACTIVE" }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
    }
    expect(provisionTenant).not.toHaveBeenCalled();
  });
});

describe("bootstrapSignalAction com staff que escreve", () => {
  const writer = {
    userId: "u-staff",
    email: "s@n.ai",
    name: "Staff",
    canWrite: true,
  };

  it("bootstrapa o Signal do tenant do slug e invalida o cache de papel", async () => {
    vi.mocked(requirePlatformStaff).mockResolvedValueOnce(writer);
    vi.mocked(platformDb.tenant.findUnique).mockResolvedValueOnce({
      id: "t-1",
      isSystem: false,
    } as never);
    vi.mocked(bootstrapSignal).mockResolvedValueOnce({
      memberId: "sg-1",
      userId: "u-ana",
      created: true,
      role: "ADMIN",
    });

    const result = await bootstrapSignalAction({
      slug: "vanta-saude",
      adminEmail: "ana@vanta.exemplo",
    });

    expect(result).toMatchObject({
      ok: true,
      data: { created: true, role: "ADMIN" },
    });
    expect(vi.mocked(bootstrapSignal).mock.calls[0][1]).toMatchObject({
      tenantId: "t-1",
      adminEmail: "ana@vanta.exemplo",
      actorUserId: "u-staff",
    });
    expect(invalidateSignalRoleCache).toHaveBeenCalledWith("t-1", "u-ana");
  });

  it("cliente do sistema (tenant interno) não recebe bootstrap", async () => {
    vi.mocked(requirePlatformStaff).mockResolvedValueOnce(writer);
    vi.mocked(platformDb.tenant.findUnique).mockResolvedValueOnce({
      id: "t-sys",
      isSystem: true,
    } as never);

    const result = await bootstrapSignalAction({
      slug: "nebuloz",
      adminEmail: "ana@vanta.exemplo",
    });

    expect(result.ok).toBe(false);
  });
});
