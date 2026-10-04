import { beforeEach, describe, expect, it, vi } from "vitest";

// Entrada de pessoa no Signal (P1-c da QA). `setMemberRole` exige linha, e nada
// criava a linha: quem tinha o módulo mas nenhum papel caía em
// signal-indisponivel sem caminho de volta. Quem adiciona é o ADMIN do Signal,
// só a quem já é membro do MESMO tenant, sem autoalteração e com teto de papel.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
  invalidate: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/log", () => ({
  log: { error: h.logError, warn: vi.fn(), info: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@repo/rbac", () => ({
  SIGNAL_ROLE_LABEL: {
    VIEWER: "Leitor",
    OWNER: "Dono de iniciativa",
    ANALYST: "Analista",
    ADMIN: "Administrador",
  },
  invalidateSignalRoleCache: h.invalidate,
}));
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return { ...actual, logSignalAudit: h.logSignalAudit };
});

import {
  addSignalMember,
  listAddableMembers,
  setMemberRole,
} from "@/app/(signal)/actions/settings";
import { canAssignSignalRole } from "@/lib/signal/members";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_admin",
  signalRole: "ADMIN",
  user: { id: "usr_admin", name: "Bia", email: "b@x.test" },
};

type Fn = ReturnType<typeof vi.fn>;
let db: Record<string, Record<string, Fn> | Fn>;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.logSignalAudit.mockResolvedValue(undefined);
  db = {
    tenantMember: {
      findFirst: vi.fn().mockResolvedValue({
        userId: "usr_2",
        user: { name: "Caio", email: "c@x.test" },
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    signalMember: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "sm_1" }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("canAssignSignalRole — teto de papel", () => {
  it("ninguém atribui papel acima do próprio", () => {
    expect(canAssignSignalRole("ADMIN", "ADMIN")).toBe(true);
    expect(canAssignSignalRole("ANALYST", "ADMIN")).toBe(false);
    expect(canAssignSignalRole("ANALYST", "OWNER")).toBe(true);
    expect(canAssignSignalRole("OWNER", "ANALYST")).toBe(false);
    expect(canAssignSignalRole("VIEWER", "VIEWER")).toBe(true);
  });
});

describe("addSignalMember", () => {
  const INPUT = { userId: "usr_2", role: "ANALYST" as const };

  it("exige a permissão de gerenciar papéis do Signal", async () => {
    await addSignalMember(INPUT);
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.member.write"
    );
  });

  it("cria a linha no tenant do contexto, com quem criou", async () => {
    const res = await addSignalMember(INPUT);
    expect(res).toMatchObject({ ok: true, data: { role: "ANALYST" } });
    expect(
      (db.signalMember as Record<string, Fn>).create.mock.calls[0][0].data
    ).toMatchObject({
      tenantId: "tnt_1",
      userId: "usr_2",
      role: "ANALYST",
      updatedBy: "usr_admin",
    });
  });

  it("só a quem já é membro do MESMO tenant", async () => {
    (db.tenantMember as Record<string, Fn>).findFirst.mockResolvedValue(null);
    const res = await addSignalMember(INPUT);
    expect(res).toMatchObject({ ok: false, rule: "member.not-in-tenant" });
    expect(
      (db.signalMember as Record<string, Fn>).create
    ).not.toHaveBeenCalled();
    expect(
      (db.tenantMember as Record<string, Fn>).findFirst.mock.calls[0][0].where
    ).toEqual({ tenantId: "tnt_1", userId: "usr_2" });
  });

  it("quem já está no Signal muda de papel por setMemberRole, não por aqui", async () => {
    (db.signalMember as Record<string, Fn>).findUnique.mockResolvedValue({
      id: "sm_9",
      role: "VIEWER",
    });
    const res = await addSignalMember(INPUT);
    expect(res).toMatchObject({ ok: false, rule: "member.exists" });
    expect(
      (db.signalMember as Record<string, Fn>).create
    ).not.toHaveBeenCalled();
  });

  it("sem autoalteração", async () => {
    const res = await addSignalMember({ userId: "usr_admin", role: "ADMIN" });
    expect(res).toMatchObject({ ok: false, rule: "member.self" });
  });

  it("teto de papel: não atribui acima do seu", async () => {
    h.requireSignalPermissionContext.mockResolvedValue({
      ...CTX,
      signalRole: "ANALYST",
    });
    const res = await addSignalMember({ userId: "usr_2", role: "ADMIN" });
    expect(res).toMatchObject({ ok: false, rule: "member.role-ceiling" });
  });

  it("audita e invalida o cache de papel depois do commit", async () => {
    await addSignalMember(INPUT);
    expect(h.logSignalAudit).toHaveBeenCalledTimes(1);
    expect(h.logSignalAudit.mock.calls[0][2]).toMatchObject({
      action: "Pessoa adicionada ao Signal",
      entityType: "signal.member",
    });
    expect(h.invalidate).toHaveBeenCalledWith("tnt_1", "usr_2");
  });
});

describe("cache de papel é melhor-esforço", () => {
  it("falha ao invalidar não desfaz a adição: registra e segue", async () => {
    h.invalidate.mockRejectedValue(new Error("redis fora"));
    const res = await addSignalMember({ userId: "usr_2", role: "ANALYST" });
    expect(res).toMatchObject({ ok: true });
    expect(h.logError).toHaveBeenCalled();
  });
});

describe("setMemberRole — o papel novo vale na hora", () => {
  beforeEach(() => {
    (db.signalMember as Record<string, Fn>).findUnique.mockResolvedValue({
      id: "sm_2",
      role: "ADMIN",
      user: { name: "Caio", email: "c@x.test" },
    });
    (db.signalMember as Record<string, Fn>).update = vi
      .fn()
      .mockResolvedValue({ id: "sm_2" });
  });

  it("invalida o cache de papel de quem foi rebaixado, depois do commit", async () => {
    const res = await setMemberRole({ userId: "usr_2", role: "VIEWER" });

    expect(res).toMatchObject({ ok: true });
    expect(h.invalidate).toHaveBeenCalledTimes(1);
    expect(h.invalidate).toHaveBeenCalledWith("tnt_1", "usr_2");
    // Depois do commit: a invalidação não pode rodar antes de a linha gravar,
    // senão a leitura seguinte recoloca o papel antigo no cache.
    const updateOrder = (db.signalMember as Record<string, Fn>).update.mock
      .invocationCallOrder[0];
    expect(h.invalidate.mock.invocationCallOrder[0]).toBeGreaterThan(
      updateOrder
    );
  });

  it("não invalida quando a troca é recusada", async () => {
    (db.signalMember as Record<string, Fn>).findUnique.mockResolvedValue(null);

    const res = await setMemberRole({ userId: "usr_2", role: "VIEWER" });

    expect(res).toMatchObject({ ok: false, rule: "member.not-found" });
    expect(h.invalidate).not.toHaveBeenCalled();
  });

  it("falha ao invalidar não desfaz a troca: registra e segue", async () => {
    h.invalidate.mockRejectedValue(new Error("redis fora"));

    const res = await setMemberRole({ userId: "usr_2", role: "VIEWER" });

    expect(res).toMatchObject({ ok: true });
    expect(h.logError).toHaveBeenCalled();
  });
});

describe("listAddableMembers", () => {
  it("lista quem é do tenant e ainda não tem papel no Signal", async () => {
    (db.tenantMember as Record<string, Fn>).findMany.mockResolvedValue([
      { userId: "usr_2", user: { name: "Caio", email: "c@x.test" } },
      { userId: "usr_3", user: { name: "Dani", email: "d@x.test" } },
    ]);
    (db.signalMember as Record<string, Fn>).findMany.mockResolvedValue([
      { userId: "usr_3" },
    ]);
    const res = await listAddableMembers();
    if (!res.ok) throw new Error(res.error);
    expect(res.data.map((p) => p.userId)).toEqual(["usr_2"]);
    expect(
      (db.tenantMember as Record<string, Fn>).findMany.mock.calls[0][0].where
    ).toMatchObject({ tenantId: "tnt_1" });
  });
});
