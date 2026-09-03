import { beforeEach, describe, expect, it, vi } from "vitest";

// Mapeamento — US4.
//
// Versionado, nunca sobrescrito: as observações que a versão anterior produziu
// continuam apontando para ela, e é isso que torna a evidência rastreável até a
// regra que a gerou. Sobrescrever apagaria a resposta a "com qual conta o board
// viu 4,2×?".

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
  nextCode: vi.fn(),
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
  };
});
vi.mock("@/app/(signal)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/(signal)/actions/_shared")
  >("../../../app/(signal)/actions/_shared");
  return { ...actual, nextCode: h.nextCode, logSignalAudit: h.logSignalAudit };
});

import { setMappingState, upsertMapping } from "@/app/(signal)/actions/mapping";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ANALYST",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

const INPUT = {
  connectionCode: "CN-01",
  initiativeCode: "IN-014",
  eventKey: "jira.issue.transitioned → Done",
  metricLabel: "Horas economizadas",
  transform: "sum(time_in_status) ÷ 60",
  unit: "horas",
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.nextCode.mockResolvedValue("MP-01");
  h.logSignalAudit.mockResolvedValue(undefined);

  db = {
    signalConnection: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "cn_1", code: "CN-01", health: "HEALTHY" }),
    },
    signalInitiative: {
      findUnique: vi.fn().mockResolvedValue({ id: "ini_1" }),
    },
    signalMetricMapping: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "mp_1" }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("versionamento", () => {
  it("primeiro mapeamento nasce v1", async () => {
    const res = await upsertMapping(INPUT);
    expect(res.ok && res.data.version).toBe(1);
  });

  it("edição CRIA versão nova, nunca sobrescreve", async () => {
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "mp_old",
      version: 3,
      transform: "sum(time_in_status)",
      state: "ACTIVE",
    });
    const res = await upsertMapping({ ...INPUT, code: "MP-01" });
    expect(res.ok && res.data.version).toBe(4);
    expect(db.signalMetricMapping?.create).toHaveBeenCalled();
    // A anterior fica: as observações dela apontam para ela.
    expect(db.signalMetricMapping?.update).not.toHaveBeenCalled();
  });

  it("registra a mudança de transformação na trilha", async () => {
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "mp_old",
      version: 1,
      transform: "count(*)",
      state: "ACTIVE",
    });
    await upsertMapping({ ...INPUT, code: "MP-01" });
    const entry = h.logSignalAudit.mock.calls[0]?.[2];
    expect(entry.diff).toContainEqual(["Versão", "v1", "v2"]);
    expect(entry.diff).toContainEqual([
      "Transformação",
      "count(*)",
      "sum(time_in_status) ÷ 60",
    ]);
  });

  it("não polui a trilha quando a transformação não mudou", async () => {
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "mp_old",
      version: 1,
      transform: INPUT.transform,
      state: "ACTIVE",
    });
    await upsertMapping({ ...INPUT, code: "MP-01" });
    const entry = h.logSignalAudit.mock.calls[0]?.[2];
    expect(entry.diff).toEqual([["Versão", "v1", "v2"]]);
  });
});

describe("estado derivado da fonte", () => {
  it("versão nova nasce QUEBRADA se a fonte está caída", async () => {
    // Copiar o estado da versão anterior faria o mapeamento novo nascer verde
    // sobre uma fonte morta.
    db.signalConnection!.findUnique = vi
      .fn()
      .mockResolvedValue({ id: "cn_1", code: "CN-02", health: "DOWN" });
    await upsertMapping(INPUT);
    expect(db.signalMetricMapping?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "BROKEN" }),
      })
    );
  });

  it("nasce ativa sobre fonte saudável", async () => {
    await upsertMapping(INPUT);
    expect(db.signalMetricMapping?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "ACTIVE" }),
      })
    );
  });
});

describe("mapeamento sem iniciativa", () => {
  it("aceita nulo — custo de licença vale para todas", async () => {
    const res = await upsertMapping({ ...INPUT, initiativeCode: null });
    expect(res.ok).toBe(true);
    expect(db.signalInitiative?.findUnique).not.toHaveBeenCalled();
    expect(db.signalMetricMapping?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ initiativeId: null }),
      })
    );
  });
});

describe("referências inexistentes", () => {
  it("conexão inexistente é recusada com a regra nomeada", async () => {
    db.signalConnection!.findUnique = vi.fn().mockResolvedValue(null);
    const res = await upsertMapping(INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("connection.not-found");
    }
  });

  it("iniciativa inexistente também", async () => {
    db.signalInitiative!.findUnique = vi.fn().mockResolvedValue(null);
    const res = await upsertMapping(INPUT);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("initiative.not-found");
    }
  });
});

describe("contestação", () => {
  beforeEach(() => {
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "mp_1",
      code: "MP-05",
      version: 2,
      state: "ACTIVE",
      metricLabel: "Receita incremental",
      connection: { health: "HEALTHY" },
    });
  });

  it("exige o motivo — contestar sem dizer o quê não transfere informação", async () => {
    const res = await setMappingState({ code: "MP-05", state: "REVIEW" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("mapping.review.note");
    }
    expect(db.signalMetricMapping?.update).not.toHaveBeenCalled();
  });

  it("aceita com motivo e registra na trilha", async () => {
    const res = await setMappingState({
      code: "MP-05",
      state: "REVIEW",
      note: "Pricing mudou no mesmo trimestre — atribuição contaminada.",
    });
    expect(res.ok).toBe(true);
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({ action: "Mapeamento contestado" })
    );
  });

  it("sair de REVIEW devolve o estado à SAÚDE DA FONTE, não a ACTIVE cego", async () => {
    // A contestação pode ter sido resolvida enquanto a fonte caía.
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "mp_1",
      code: "MP-05",
      version: 2,
      state: "REVIEW",
      metricLabel: "Receita incremental",
      connection: { health: "DOWN" },
    });
    await setMappingState({ code: "MP-05", state: "ACTIVE" });
    expect(db.signalMetricMapping?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "BROKEN" }),
      })
    );
  });

  it("mapeamento inexistente é recusado", async () => {
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue(null);
    const res = await setMappingState({ code: "MP-99", state: "ACTIVE" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("mapping.not-found");
    }
  });
});

describe("permissão", () => {
  it("mapear exige signal.mapping.write", async () => {
    await upsertMapping(INPUT);
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.mapping.write"
    );
  });
});
