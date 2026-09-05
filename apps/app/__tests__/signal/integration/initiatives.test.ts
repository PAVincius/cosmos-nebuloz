import { beforeEach, describe, expect, it, vi } from "vitest";

// Iniciativas — US1.
//
// O que estes testes protegem, além do caminho feliz: que a permissão NÃO
// substitua a posse, que transição inválida devolva 409 com o que destravar,
// que ativar sem baseline devolva 422 com a regra nomeada, e que toda escrita
// deixe rastro na mesma transação.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  requireInitiativeOwnership: vi.fn(),
  withTenantDb: vi.fn(),
  nextCode: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
// Só as FUNÇÕES do guard são mockadas (elas carregam `@repo/auth/server`, que
// explode no ambiente de teste). As classes de erro vêm das reais: `signalAction`
// as classifica por `instanceof`, e uma cópia local passaria despercebida pelo
// wrapper — o `rule` chegaria vazio na tela sem nenhum teste reclamar.
vi.mock("@/lib/signal/guards", async () => {
  const errors = await vi.importActual<typeof import("@/lib/signal/errors")>(
    "../../../lib/signal/errors"
  );
  return {
    ...errors,
    requireSignalPermissionContext: h.requireSignalPermissionContext,
    requireInitiativeOwnership: h.requireInitiativeOwnership,
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return { ...actual, nextCode: h.nextCode, logSignalAudit: h.logSignalAudit };
});

import {
  createInitiative,
  listInitiatives,
  transitionInitiative,
  updateInitiative,
} from "@/app/(signal)/actions/initiatives";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

const OWNER_ID = "cl00000000000000000000000";

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const initiativeRow = (over: Record<string, unknown> = {}) => ({
  id: "ini_1",
  code: "IN-014",
  name: "Triagem assistida",
  businessUnit: "Operações",
  category: "PRODUCTIVITY",
  status: "DRAFT",
  ownerId: OWNER_ID,
  hypothesis: "Se a triagem priorizar por critério econômico, o tempo cai 20%.",
  expectedValue: null,
  startedAt: null,
  baselines: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.requireInitiativeOwnership.mockReturnValue(undefined);
  h.nextCode.mockResolvedValue("IN-001");
  h.logSignalAudit.mockResolvedValue(undefined);

  db = {
    signalSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    signalInitiative: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(initiativeRow()),
      create: vi.fn().mockResolvedValue(initiativeRow({ code: "IN-001" })),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve(initiativeRow(data as Record<string, unknown>))
        ),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("criação", () => {
  it("emite código sequencial e nasce em rascunho", async () => {
    const res = await createInitiative({
      name: "Triagem assistida",
      businessUnit: "Operações",
      category: "PRODUCTIVITY",
      ownerId: OWNER_ID,
      hypothesis: "Se a triagem priorizar por critério econômico, o tempo cai.",
    });

    expect(res.ok).toBe(true);
    expect(db.signalInitiative?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFT", code: "IN-001" }),
      })
    );
  });

  it("grava a trilha na mesma transação da escrita", async () => {
    await createInitiative({
      name: "Triagem",
      businessUnit: "Ops",
      category: "PRODUCTIVITY",
      ownerId: OWNER_ID,
      hypothesis: "Se a triagem priorizar por critério econômico, o tempo cai.",
    });
    // Mesmo `db` do create: a trilha participa da transação. Se ela falhar, a
    // escrita inteira cai junto.
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({ action: "Iniciativa criada" })
    );
  });

  it("recusa hipótese curta demais para ser falseável", async () => {
    const res = await createInitiative({
      name: "X",
      businessUnit: "Ops",
      category: "PRODUCTIVITY",
      ownerId: OWNER_ID,
      hypothesis: "vai melhorar",
    });
    expect(res.ok).toBe(false);
    expect(db.signalInitiative?.create).not.toHaveBeenCalled();
  });

  it("exige a permissão de escrita, não só leitura", async () => {
    await createInitiative({
      name: "Triagem",
      businessUnit: "Ops",
      category: "PRODUCTIVITY",
      ownerId: OWNER_ID,
      hypothesis: "Se a triagem priorizar por critério econômico, o tempo cai.",
    });
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.initiative.write"
    );
  });
});

describe("edição", () => {
  it("checa a POSSE depois da permissão — permissão não substitui dono", async () => {
    await updateInitiative({ code: "IN-014", name: "Novo nome" });
    expect(h.requireInitiativeOwnership).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ code: "IN-014", ownerId: OWNER_ID })
    );
  });

  it("propaga a negativa de posse e não escreve", async () => {
    h.requireInitiativeOwnership.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
    const res = await updateInitiative({ code: "IN-014", name: "Novo nome" });
    expect(res.ok).toBe(false);
    expect(db.signalInitiative?.update).not.toHaveBeenCalled();
  });

  it("não grava trilha quando nada mudou de fato", async () => {
    db.signalInitiative!.update = vi
      .fn()
      .mockResolvedValue(initiativeRow({ name: "Triagem assistida" }));
    await updateInitiative({ code: "IN-014", name: "Triagem assistida" });
    expect(h.logSignalAudit).not.toHaveBeenCalled();
  });

  it("código inexistente devolve 'não encontrada', nunca 'sem permissão'", async () => {
    // A segunda resposta já revelaria que a iniciativa existe em outro tenant.
    db.signalInitiative!.findUnique = vi.fn().mockResolvedValue(null);
    const res = await updateInitiative({ code: "IN-999", name: "X" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("não encontrada");
      expect(res.error).not.toContain("permiss");
    }
  });
});

describe("transição de estado", () => {
  it("ativar sem baseline assinado devolve a regra nomeada", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(initiativeRow({ status: "DRAFT", baselines: [] }));
    const res = await transitionInitiative({ code: "IN-014", to: "ACTIVE" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("baseline");
    }
    expect(db.signalInitiative?.update).not.toHaveBeenCalled();
  });

  it("ativar com baseline assinado passa e marca startedAt", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(
        initiativeRow({ status: "DRAFT", baselines: [{ id: "b1" }] })
      );
    const res = await transitionInitiative({ code: "IN-014", to: "ACTIVE" });
    expect(res.ok).toBe(true);
    expect(db.signalInitiative?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          startedAt: expect.any(Date),
        }),
      })
    );
  });

  it("encerrar sem motivo devolve a regra nomeada", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(initiativeRow({ status: "ACTIVE" }));
    const res = await transitionInitiative({ code: "IN-014", to: "CLOSED" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("motivo");
    }
  });

  it("encerrar com motivo grava quem, quando e por quê", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(initiativeRow({ status: "ACTIVE" }));
    const reason =
      "Adoção nunca passou de 31% e caiu por 6 meses. Licenças realocadas.";
    const res = await transitionInitiative({
      code: "IN-014",
      to: "CLOSED",
      reason,
    });
    expect(res.ok).toBe(true);
    expect(db.signalInitiative?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CLOSED",
          closedById: "usr_1",
          closureReason: reason,
          closedAt: expect.any(Date),
        }),
      })
    );
  });

  it("encerrar exige a permissão de encerrar, que é de ADMIN", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(initiativeRow({ status: "ACTIVE" }));
    await transitionInitiative({
      code: "IN-014",
      to: "CLOSED",
      reason: "Adoção nunca passou de 31% e caiu por seis meses seguidos.",
    });
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.initiative.close"
    );
  });

  it("reabrir encerrada é conflito de estado, com o que destravar", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(initiativeRow({ status: "CLOSED" }));
    const res = await transitionInitiative({ code: "IN-014", to: "ACTIVE" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/não dá para ir/i);
    }
  });

  it("transicionar para o mesmo estado é recusado", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(initiativeRow({ status: "ACTIVE" }));
    const res = await transitionInitiative({ code: "IN-014", to: "ACTIVE" });
    expect(res.ok).toBe(false);
  });

  it("registra de → para na trilha", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(
        initiativeRow({ status: "DRAFT", baselines: [{ id: "b1" }] })
      );
    await transitionInitiative({ code: "IN-014", to: "ACTIVE" });
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({
        diff: [["Status", "Rascunho", "Ativa"]],
      })
    );
  });
});

describe("lista", () => {
  it("calcula veredito por linha a partir de adoção e ROI derivados", async () => {
    db.signalInitiative!.findMany = vi.fn().mockResolvedValue([
      {
        code: "IN-021",
        name: "Copiloto N1",
        businessUnit: "Atendimento",
        category: "PRODUCTIVITY",
        status: "ACTIVE",
        owner: { id: "u", name: "Bruno", email: null },
        roiFormulas: [
          {
            version: 2,
            entries: [
              { kind: "RETURN", total: 215_980 },
              { kind: "COST", total: 240_000 },
            ],
          },
        ],
        adoption: [{ activeUsers: 52, licensedUsers: 62 }],
        confidenceScores: [],
        baselines: [{ version: 1 }],
      },
    ]);

    const res = await listInitiatives({});
    expect(res.ok).toBe(true);
    if (res.ok) {
      const row = res.data[0];
      // 84% de adoção com 0,9× — o quadrante que dá nome ao produto.
      expect(row?.verdict).toBe("VANITY");
      expect(row?.verdictAction).toBe("Investigar método");
      // A versão da fórmula viaja junto do múltiplo, sempre.
      expect(row?.formulaVersion).toBe(2);
      expect(row?.multiple).toBeCloseTo(0.8999, 3);
    }
  });

  it("usa os limiares do tenant quando existem", async () => {
    db.signalSettings!.findUnique = vi
      .fn()
      .mockResolvedValue({ adoptionBar: 60, valueBar: 2.0 });
    db.signalInitiative!.findMany = vi.fn().mockResolvedValue([
      {
        code: "IN-035",
        name: "Propostas",
        businessUnit: "Comercial",
        category: "REVENUE",
        status: "ACTIVE",
        owner: { id: "u", name: "Marina", email: null },
        roiFormulas: [
          {
            version: 2,
            entries: [
              { kind: "RETURN", total: 172_680 },
              { kind: "COST", total: 96_000 },
            ],
          },
        ],
        adoption: [{ activeUsers: 17, licensedUsers: 24 }],
        confidenceScores: [],
        baselines: [],
      },
    ]);

    const res = await listInitiatives({});
    // 1,8× é PROVEN com régua 1,5 e VANITY com régua 2,0. Mesma linha, outro
    // veredito — a régua é do tenant, não do código.
    expect(res.ok && res.data[0]?.verdict).toBe("VANITY");
  });

  it("exige só leitura", async () => {
    await listInitiatives({});
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.read"
    );
  });
});
