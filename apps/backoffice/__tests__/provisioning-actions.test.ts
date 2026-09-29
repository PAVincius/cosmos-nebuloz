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
  provisionTenant: vi.fn(),
}));

const {
  contractModuleAction,
  setModuleStatusAction,
  bootstrapCharterAction,
  bootstrapScaffoldAction,
  provisionTenantAction,
} = await import("../app/actions/provisioning");
const { assertCanWrite, StaffAuthError } = await import("../lib/guard");
const {
  contractModule,
  setModuleStatus,
  bootstrapCharter,
  bootstrapScaffold,
  provisionTenant,
} = await import("@repo/provisioning");

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
