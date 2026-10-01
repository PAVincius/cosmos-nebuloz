import { beforeEach, describe, expect, it, vi } from "vitest";

// Dispensa visível (specs/017, PR 3, FR-005/FR-006): a fila de supervisão lista
// todo entregável dispensado de qualquer trilha, com motivo, trilha, cliente e
// quem/quando, por qualquer via (automática, overlay ou manual). É só leitura e
// o tenant sai do servidor: nada aqui aceita tenantId do chamador.

const h = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  instanceFindMany: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: h.requireStaff,
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  RateLimitError: class extends Error {},
}));
vi.mock("@repo/provisioning", () => ({
  ProvisioningError: class extends Error {},
  platformDb: {
    scaffoldDeliverableInstance: { findMany: h.instanceFindMany },
    auditLog: { findMany: h.auditFindMany },
  },
}));

import { listDispensedDeliverables } from "@/app/actions/scaffold-dispensas";

const CRIADA_EM = new Date("2026-09-20T10:00:00Z");
const DISPENSADA_EM = new Date("2026-10-02T15:30:00Z");

function instancia(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    tenantId: "tenant-vanta",
    code: "C1.1",
    title: "Política de uso",
    dispensedReason:
      "O módulo Charter não está contratado por esta organização; dispensado pelo sistema.",
    createdAt: CRIADA_EM,
    track: { id: "trk1", code: "TR-104", tenant: { name: "Vanta Saúde" } },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireStaff.mockResolvedValue({
    userId: "u1",
    name: "Marina",
    email: "m@nebuloz.com",
    canWrite: false,
  });
  h.instanceFindMany.mockResolvedValue([instancia()]);
  h.auditFindMany.mockResolvedValue([]);
});

describe("listDispensedDeliverables", () => {
  it("é só leitura: o módulo não exporta nenhuma escrita", async () => {
    const acoes = await import("@/app/actions/scaffold-dispensas");
    expect(Object.keys(acoes)).toEqual(["listDispensedDeliverables"]);
  });

  it("exige staff, de leitura basta, e não lê nada sem ele", async () => {
    h.requireStaff.mockRejectedValue(new Error("sem sessão"));

    const r = await listDispensedDeliverables();

    expect(r.ok).toBe(false);
    expect(h.instanceFindMany).not.toHaveBeenCalled();
  });

  it("consulta só dispensados de clientes, nunca o tenant interno", async () => {
    await listDispensedDeliverables();

    const args = h.instanceFindMany.mock.calls[0][0];
    expect(args.where).toEqual({
      dispensedReason: { not: null },
      track: { tenant: { isSystem: false } },
    });
  });

  it("dispensa automática: motivo, trilha, cliente, 'Sistema' e a data de criação", async () => {
    const r = await listDispensedDeliverables();

    expect(r).toEqual({
      ok: true,
      data: {
        items: [
          {
            id: "d1",
            code: "C1.1",
            title: "Política de uso",
            reason:
              "O módulo Charter não está contratado por esta organização; dispensado pelo sistema.",
            via: "automatica",
            trackId: "trk1",
            trackCode: "TR-104",
            orgName: "Vanta Saúde",
            by: "Sistema",
            at: CRIADA_EM.toISOString(),
          },
        ],
        truncated: false,
      },
    });
  });

  it("dispensa por overlay é reconhecida pelo prefixo e também aparece", async () => {
    h.instanceFindMany.mockResolvedValue([
      instancia({
        id: "d2",
        dispensedReason: "Dispensado pelo overlay do cliente: já tem o termo",
      }),
    ]);

    const r = await listDispensedDeliverables();

    expect(r.ok && r.data.items[0]).toMatchObject({
      via: "overlay",
      by: "Sistema",
    });
  });

  it("dispensa manual: quem e quando vêm da auditoria", async () => {
    h.auditFindMany.mockResolvedValue([
      {
        entityId: "d1",
        createdAt: DISPENSADA_EM,
        metadata: { actorName: "Camila Rocha", note: "texto livre" },
      },
    ]);

    const r = await listDispensedDeliverables();

    expect(r.ok && r.data.items[0]).toMatchObject({
      via: "manual",
      by: "Camila Rocha",
      at: DISPENSADA_EM.toISOString(),
    });
    // A auditoria é buscada só para as instâncias listadas, no tenant delas.
    const args = h.auditFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      tenantId: { in: ["tenant-vanta"] },
      entityType: "scaffold.deliverable",
      entityId: { in: ["d1"] },
      action: { startsWith: "scaffold.deliverable.dispens" },
    });
  });

  it("manual sem nome na auditoria não inventa ninguém", async () => {
    h.auditFindMany.mockResolvedValue([
      { entityId: "d1", createdAt: DISPENSADA_EM, metadata: null },
    ]);

    const r = await listDispensedDeliverables();

    expect(r.ok && r.data.items[0].by).toBe("—");
  });

  it("vários registros da mesma instância: vale o mais recente", async () => {
    h.auditFindMany.mockResolvedValue([
      {
        entityId: "d1",
        createdAt: DISPENSADA_EM,
        metadata: { actorName: "Camila Rocha" },
      },
      {
        entityId: "d1",
        createdAt: new Date("2026-09-25T00:00:00Z"),
        metadata: { actorName: "Outra Pessoa" },
      },
    ]);

    const r = await listDispensedDeliverables();

    expect(r.ok && r.data.items[0].by).toBe("Camila Rocha");
  });

  it("do mais recente para o mais antigo", async () => {
    h.instanceFindMany.mockResolvedValue([
      instancia({ id: "velho", createdAt: new Date("2026-08-01T00:00:00Z") }),
      instancia({ id: "novo", createdAt: new Date("2026-09-29T00:00:00Z") }),
    ]);

    const r = await listDispensedDeliverables();

    expect(r.ok && r.data.items.map((i) => i.id)).toEqual(["novo", "velho"]);
  });

  it("devolve só campos de triagem, sem ids de tenant nem nada a mais", async () => {
    const r = await listDispensedDeliverables();

    expect(r.ok && Object.keys(r.data.items[0]).sort()).toEqual(
      [
        "at",
        "by",
        "code",
        "id",
        "orgName",
        "reason",
        "title",
        "trackCode",
        "trackId",
        "via",
      ].sort()
    );
  });

  it("sem dispensados a lista é vazia e a auditoria nem é consultada", async () => {
    h.instanceFindMany.mockResolvedValue([]);

    const r = await listDispensedDeliverables();

    expect(r).toEqual({ ok: true, data: { items: [], truncated: false } });
    expect(h.auditFindMany).not.toHaveBeenCalled();
  });
});
