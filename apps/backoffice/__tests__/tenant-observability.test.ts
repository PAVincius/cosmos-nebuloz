// tenant-observability.test.ts — abas Integrações (FR-4.4) e Audit (FR-4.9).
//
// As duas são leitura pura, mas carregam dois invariantes que valem teste:
//
// 1. NFR-1.7 — credencial de integração é write-only. Depois de salva, **nunca**
//    volta ao cliente. Uma action que faz `select` sem enumerar campos devolve
//    `config` inteiro, com token dentro, para o browser. O teste existe para
//    quebrar no dia em que alguém trocar o select por um findMany solto.
//
// 2. FR-4.4.2 — erro precisa da mensagem concreta ("token expirado — reautorize
//    o OAuth"), nunca só do status. Status sozinho não diz a ninguém o que
//    consertar.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  tenantFindFirst: vi.fn(),
  integrationFindMany: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: { findFirst: mocks.tenantFindFirst },
    integration: { findMany: mocks.integrationFindMany },
    auditLog: { findMany: mocks.auditFindMany },
  },
}));

import {
  listTenantAudit,
  listTenantIntegrations,
} from "../app/actions/tenant-observability";

const tenant = { id: "t-1", slug: "vanta-saude", name: "Vanta Saúde" };
const staff = {
  userId: "u-1",
  name: "Vinícius",
  email: "v@nebuloz.com",
  canWrite: false,
};

function resetarMocks() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
}

describe("listTenantIntegrations", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue(staff);
    mocks.tenantFindFirst.mockResolvedValue(tenant);
  });

  it("NUNCA devolve a credencial ao cliente (NFR-1.7)", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "github",
        name: "GitHub",
        status: "ACTIVE",
        lastSyncAt: new Date("2026-08-01T00:00:00.000Z"),
        syncLogs: [],
      },
    ]);

    const res = await listTenantIntegrations("vanta-saude");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    // Nem no objeto, nem serializado: um campo aninhado escaparia da primeira
    // checagem e chegaria ao browser do mesmo jeito.
    const serializado = JSON.stringify(res.data);
    expect(serializado).not.toContain("config");
    expect(serializado).not.toContain("token");
    expect(serializado).not.toContain("apiKey");

    // O select precisa enumerar campos — `findMany` sem select devolve tudo.
    const args = mocks.integrationFindMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.config).toBeUndefined();
  });

  it("erro carrega a mensagem concreta do último sync, não só o status (FR-4.4.2)", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "github",
        name: "GitHub",
        status: "ERROR",
        lastSyncAt: new Date("2026-08-01T00:00:00.000Z"),
        syncLogs: [
          {
            status: "error",
            errors: { message: "Token expirado — reautorize o OAuth." },
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      },
    ]);

    const res = await listTenantIntegrations("vanta-saude");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data[0].mensagem).toContain("Token expirado");
  });

  it("a mensagem vai à tela sem o segredo que o provedor ecoou", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "github",
        name: "GitHub",
        status: "ERROR",
        lastSyncAt: new Date("2026-08-01T00:00:00.000Z"),
        syncLogs: [
          {
            status: "error",
            errors: {
              message:
                "401 em https://bot:s3nh4@api.github.com — Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789",
            },
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      },
    ]);

    const res = await listTenantIntegrations("vanta-saude");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data[0].mensagem).toContain("401");
    expect(res.data[0].mensagem).not.toContain("s3nh4");
    expect(res.data[0].mensagem).not.toContain("ghp_abcdefghij");
  });

  it("erro sem log não inventa causa — diz que não há detalhe", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "jira",
        name: "Jira",
        status: "ERROR",
        lastSyncAt: null,
        syncLogs: [],
      },
    ]);

    const res = await listTenantIntegrations("vanta-saude");

    if (!res.ok) {
      return;
    }
    // Inventar uma causa plausível é pior que admitir que não se sabe: manda o
    // operador consertar a coisa errada.
    expect(res.data[0].mensagem).toBeTruthy();
    expect(res.data[0].mensagem).not.toContain("Token");
  });

  it("integração saudável não carrega mensagem de erro", async () => {
    mocks.integrationFindMany.mockResolvedValue([
      {
        id: "i-1",
        source: "linear",
        name: "Linear",
        status: "ACTIVE",
        lastSyncAt: new Date("2026-08-01T00:00:00.000Z"),
        syncLogs: [],
      },
    ]);

    const res = await listTenantIntegrations("vanta-saude");

    if (!res.ok) {
      return;
    }
    expect(res.data[0].mensagem).toBeNull();
  });

  it("recusa slug inexistente", async () => {
    mocks.tenantFindFirst.mockResolvedValue(null);

    const res = await listTenantIntegrations("nao-existe");

    expect(res.ok).toBe(false);
    expect(mocks.integrationFindMany).not.toHaveBeenCalled();
  });
});

describe("listTenantAudit", () => {
  beforeEach(() => {
    resetarMocks();
    mocks.requirePlatformStaff.mockResolvedValue(staff);
    mocks.tenantFindFirst.mockResolvedValue(tenant);
  });

  it("devolve o diff campo-a-campo quando existe (FR-4.9)", async () => {
    mocks.auditFindMany.mockResolvedValue([
      {
        id: "a-1",
        action: "updated",
        entityType: "tenant_member",
        entityId: "tm-1",
        diff: [["role", "ADMIN", "MEMBER"]],
        metadata: { target: "vanta-saude · ana@vanta.com", actorName: "Vini" },
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    const res = await listTenantAudit("vanta-saude");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data[0].diff).toEqual([["role", "ADMIN", "MEMBER"]]);
    expect(res.data[0].semDiff).toBe(false);
  });

  it("marca explicitamente o evento que não tem diff — criação não tem antes", async () => {
    mocks.auditFindMany.mockResolvedValue([
      {
        id: "a-2",
        action: "created",
        entityType: "tenant",
        entityId: "t-1",
        diff: null,
        metadata: { target: "vanta-saude" },
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    const res = await listTenantAudit("vanta-saude");

    if (!res.ok) {
      return;
    }
    // "sem diff" precisa ser afirmação, não ausência silenciosa: linha que não
    // expande sem explicar parece linha quebrada.
    expect(res.data[0].semDiff).toBe(true);
    expect(res.data[0].diff).toBeNull();
  });

  it("mais recentes primeiro e escopado ao tenant", async () => {
    mocks.auditFindMany.mockResolvedValue([]);

    await listTenantAudit("vanta-saude");

    const args = mocks.auditFindMany.mock.calls[0][0];
    expect(args.where.tenantId).toBe("t-1");
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });
});
