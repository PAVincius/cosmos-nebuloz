import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  tenantModuleFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    tenantModule: { findMany: dbMocks.tenantModuleFindMany },
  },
  MeridianRole: {
    CONSULTANT: "CONSULTANT",
    REVIEWER: "REVIEWER",
    VIEWER: "VIEWER",
  },
  CharterRole: {
    COMPLIANCE: "COMPLIANCE",
    LEGAL: "LEGAL",
    SECURITY: "SECURITY",
    HR: "HR",
    REQUESTER: "REQUESTER",
    EXEC: "EXEC",
    AUDITOR: "AUDITOR",
  },
  ScaffoldRole: {
    TEAM_MEMBER: "TEAM_MEMBER",
    PROCESS_OWNER: "PROCESS_OWNER",
    TRANSFORMATION_LEAD: "TRANSFORMATION_LEAD",
    CONSULTANT: "CONSULTANT",
    ADMIN: "ADMIN",
  },
  SignalRole: {
    VIEWER: "VIEWER",
    OWNER: "OWNER",
    ANALYST: "ANALYST",
    ADMIN: "ADMIN",
  },
  MemberRole: {
    ADMIN: "ADMIN",
    STE: "STE",
    RTE: "RTE",
    SM: "SM",
    PO: "PO",
    DEV: "DEV",
    MEMBER: "MEMBER",
  },
}));

const rbacMocks = vi.hoisted(() => ({
  listModules: vi.fn(),
}));

vi.mock("@repo/rbac", () => ({
  listModules: rbacMocks.listModules,
}));

const authMocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: authMocks.requireTenantSession,
}));

vi.mock("next/headers", () => ({
  headers: authMocks.headers,
}));

import { listarProdutos } from "../../app/actions/produtos";

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.headers.mockResolvedValue(new Headers());
  authMocks.requireTenantSession.mockResolvedValue({ tenantId: "tenant-1" });
  dbMocks.tenantModuleFindMany.mockResolvedValue([]);
  rbacMocks.listModules.mockResolvedValue([]);
});

describe("listarProdutos — campo perfis", () => {
  it("popula perfis do Meridian a partir do MeridianRole", async () => {
    const resultado = await listarProdutos();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) {
      return;
    }
    const meridian = resultado.data.find((p) => p.modulo === "MERIDIAN");
    expect(meridian?.perfis).toEqual(["CONSULTANT", "REVIEWER", "VIEWER"]);
  });

  it("popula perfis do Charter a partir do CharterRole", async () => {
    const resultado = await listarProdutos();
    if (!resultado.ok) {
      return;
    }
    const charter = resultado.data.find((p) => p.modulo === "CHARTER");
    expect(charter?.perfis).toEqual([
      "COMPLIANCE",
      "LEGAL",
      "SECURITY",
      "HR",
      "REQUESTER",
      "EXEC",
      "AUDITOR",
    ]);
  });

  it("popula perfis do Scaffold a partir do ScaffoldRole", async () => {
    const resultado = await listarProdutos();
    if (!resultado.ok) {
      return;
    }
    const scaffold = resultado.data.find((p) => p.modulo === "SCAFFOLD");
    expect(scaffold?.perfis).toEqual([
      "TEAM_MEMBER",
      "PROCESS_OWNER",
      "TRANSFORMATION_LEAD",
      "CONSULTANT",
      "ADMIN",
    ]);
  });

  it("popula perfis do Signal a partir do SignalRole", async () => {
    const resultado = await listarProdutos();
    if (!resultado.ok) {
      return;
    }
    const signal = resultado.data.find((p) => p.modulo === "SIGNAL");
    expect(signal?.perfis).toEqual(["VIEWER", "OWNER", "ANALYST", "ADMIN"]);
  });

  it("popula perfis do Cosmos a partir do MemberRole", async () => {
    const resultado = await listarProdutos();
    if (!resultado.ok) {
      return;
    }
    const cosmos = resultado.data.find((p) => p.modulo === "COSMOS");
    expect(cosmos?.perfis).toEqual([
      "ADMIN",
      "STE",
      "RTE",
      "SM",
      "PO",
      "DEV",
      "MEMBER",
    ]);
  });

  it("todo produto do catálogo tem perfis não-vazio", async () => {
    const resultado = await listarProdutos();
    if (!resultado.ok) {
      return;
    }
    for (const produto of resultado.data) {
      expect(produto.perfis.length).toBeGreaterThan(0);
    }
  });
});
