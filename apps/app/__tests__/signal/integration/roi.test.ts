import { beforeEach, describe, expect, it, vi } from "vitest";

// Fórmula de ROI — US2.
//
// A invariante central: versionar NUNCA sobrescreve. A versão anterior fica como
// SUPERSEDED e continua ali, porque é ela que sustenta o número do relatório do
// trimestre passado. Um `update` no lugar de um `create` apagaria a resposta a
// "por que o número mudou?".

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  requireInitiativeOwnership: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
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
  return { ...actual, logSignalAudit: h.logSignalAudit };
});

import { getRoi, versionRoiFormula } from "@/app/(signal)/actions/roi";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ANALYST",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

/** Fórmula mínima válida: pelo menos um retorno e um custo. */
const VALID_ENTRIES = [
  {
    kind: "RETURN" as const,
    label: "Horas economizadas",
    total: 157_080,
    sourceLabel: "Jira · tempo em fila",
  },
  {
    kind: "COST" as const,
    label: "Licenças de IA",
    total: 96_000,
    sourceLabel: "Planilha de custos",
  },
];

const INPUT = {
  initiativeCode: "IN-014",
  horizonMonths: 12,
  entries: VALID_ENTRIES,
  assumptions: [
    {
      label: "Custo-hora do analista",
      value: "R$ 84",
      note: "folha + encargos ÷ 1.760 h",
    },
  ],
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const signedInitiative = (over: Record<string, unknown> = {}) => ({
  id: "ini_1",
  code: "IN-014",
  name: "Triagem assistida",
  ownerId: "usr_1",
  baselines: [{ id: "b1" }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.requireInitiativeOwnership.mockReturnValue(undefined);
  h.logSignalAudit.mockResolvedValue(undefined);

  db = {
    signalInitiative: {
      findUnique: vi.fn().mockResolvedValue(signedInitiative()),
    },
    signalRoiFormula: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "f_1", version: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("versionar fórmula", () => {
  it("cria a v1 e devolve o múltiplo calculado", async () => {
    const res = await versionRoiFormula(INPUT);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.version).toBe(1);
      expect(res.data.multiple).toBeCloseTo(157_080 / 96_000, 6);
    }
  });

  it("NÃO sobrescreve: cria versão nova e marca a anterior SUPERSEDED", async () => {
    db.signalRoiFormula!.findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "f_1", version: 2 }) // ativa atual
      .mockResolvedValueOnce({ version: 2 }); // maior versão
    db.signalRoiFormula!.create = vi
      .fn()
      .mockResolvedValue({ id: "f_2", version: 3 });

    const res = await versionRoiFormula(INPUT);
    expect(res.ok).toBe(true);
    expect(db.signalRoiFormula?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "f_1" },
        data: { state: "SUPERSEDED" },
      })
    );
    expect(db.signalRoiFormula?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 3, state: "ACTIVE" }),
      })
    );
  });

  it("supersede e cria na MESMA transação — nunca duas ativas ao mesmo tempo", async () => {
    db.signalRoiFormula!.findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "f_1", version: 1 })
      .mockResolvedValueOnce({ version: 1 });
    await versionRoiFormula(INPUT);
    // Mesmo `db`: se a criação falhar, o supersede cai junto e a fórmula ativa
    // continua sendo a antiga.
    expect(h.withTenantDb).toHaveBeenCalledTimes(1);
    expect(db.signalRoiFormula?.update).toHaveBeenCalled();
    expect(db.signalRoiFormula?.create).toHaveBeenCalled();
  });

  it("recusa versionar sem baseline assinado", async () => {
    db.signalInitiative!.findUnique = vi
      .fn()
      .mockResolvedValue(signedInitiative({ baselines: [] }));
    const res = await versionRoiFormula(INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("roi.baseline.required");
    }
    expect(db.signalRoiFormula?.create).not.toHaveBeenCalled();
  });

  it("recusa fórmula só com retorno — retorno sem custo não é múltiplo", async () => {
    const res = await versionRoiFormula({
      ...INPUT,
      entries: [VALID_ENTRIES[0] as (typeof VALID_ENTRIES)[0]],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("roi.cost.required");
    }
  });

  it("recusa premissa sem nota — número sem defesa não sustenta comitê", async () => {
    const res = await versionRoiFormula({
      ...INPUT,
      assumptions: [{ label: "Custo-hora", value: "R$ 84", note: "" }],
    });
    expect(res.ok).toBe(false);
    expect(db.signalRoiFormula?.create).not.toHaveBeenCalled();
  });

  it("checa a posse antes de gravar", async () => {
    h.requireInitiativeOwnership.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
    const res = await versionRoiFormula(INPUT);
    expect(res.ok).toBe(false);
    expect(db.signalRoiFormula?.create).not.toHaveBeenCalled();
  });

  it("exige a permissão de fórmula, não a de iniciativa", async () => {
    await versionRoiFormula(INPUT);
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.formula.write"
    );
  });

  it("registra de → para na trilha", async () => {
    db.signalRoiFormula!.findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: "f_1", version: 2 })
      .mockResolvedValueOnce({ version: 2 });
    db.signalRoiFormula!.create = vi
      .fn()
      .mockResolvedValue({ id: "f_2", version: 3 });
    await versionRoiFormula(INPUT);
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({ diff: [["Versão", "v2", "v3"]] })
    );
  });
});

describe("leitura", () => {
  it("devolve a fórmula ATIVA e a lista de versões", async () => {
    db.signalRoiFormula!.findMany = vi.fn().mockResolvedValue([
      {
        version: 3,
        state: "ACTIVE",
        changedAt: new Date("2026-07-09"),
        horizonMonths: 12,
        entries: [
          {
            kind: "RETURN",
            label: "Horas",
            total: 157_080,
            quantityLabel: null,
            unitLabel: null,
            sourceLabel: "Jira",
          },
          {
            kind: "COST",
            label: "Licenças",
            total: 96_000,
            quantityLabel: null,
            unitLabel: null,
            sourceLabel: "Sheets",
          },
        ],
        assumptions: [],
      },
      {
        version: 2,
        state: "SUPERSEDED",
        changedAt: new Date("2026-06-01"),
        horizonMonths: 12,
        entries: [],
        assumptions: [],
      },
    ]);

    const res = await getRoi({ initiativeCode: "IN-014" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.version).toBe(3);
      expect(res.data.multiple).toBeCloseTo(157_080 / 96_000, 6);
      // A versão superada continua listada: é a resposta a "mudou por quê?".
      expect(res.data.versions).toHaveLength(2);
      expect(res.data.versions[1]).toMatchObject({
        version: 2,
        state: "SUPERSEDED",
      });
    }
  });

  it("iniciativa sem fórmula devolve versão nula e múltiplo zero", async () => {
    const res = await getRoi({ initiativeCode: "IN-042" });
    expect(res.ok && res.data.version).toBeNull();
    expect(res.ok && res.data.multiple).toBe(0);
  });

  it("código inexistente devolve 'não encontrada'", async () => {
    db.signalInitiative!.findUnique = vi.fn().mockResolvedValue(null);
    const res = await getRoi({ initiativeCode: "IN-999" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("initiative.not-found");
    }
  });
});
