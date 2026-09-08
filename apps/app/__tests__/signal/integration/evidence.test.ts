import { beforeEach, describe, expect, it, vi } from "vitest";

// Evidência — US2 (manual) e US4 (por mapeamento).
//
// A invariante que estes testes protegem: NENHUMA observação sem origem
// rastreável. É a diferença entre evidência e opinião com aparência de dado, e é
// checada em dois lugares de propósito — no schema (para o formulário avisar
// antes) e no domínio (porque a action é chamável de qualquer lugar).

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  requireInitiativeOwnership: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  nextCode: vi.fn(),
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
  return { ...actual, logSignalAudit: h.logSignalAudit, nextCode: h.nextCode };
});

import { recordObservation } from "@/app/(signal)/actions/evidence";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ANALYST",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

const MANUAL = {
  initiativeCode: "IN-014",
  metricLabel: "Horas economizadas",
  value: "1.870 h",
  windowStart: "2026-06-01",
  windowEnd: "2026-07-09",
  transform: "sum(time_in_status) ÷ 60",
  source: "MANUAL" as const,
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.requireInitiativeOwnership.mockReturnValue(undefined);
  h.logSignalAudit.mockResolvedValue(undefined);
  h.nextCode.mockResolvedValue("EV-8841");

  db = {
    signalInitiative: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "ini_1", code: "IN-014", ownerId: "usr_1" }),
    },
    signalMetricMapping: { findFirst: vi.fn().mockResolvedValue(null) },
    signalMetricObservation: {
      create: vi.fn().mockResolvedValue({ id: "obs_1", code: "EV-8841" }),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("origem rastreável — a invariante", () => {
  it("aceita entrada manual COM transformação declarada", async () => {
    const res = await recordObservation(MANUAL);
    expect(res.ok).toBe(true);
    expect(db.signalMetricObservation?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transform: "sum(time_in_status) ÷ 60",
          source: "MANUAL",
          recordedById: "usr_1",
        }),
      })
    );
  });

  it("RECUSA entrada sem mapeamento e sem transformação", async () => {
    const res = await recordObservation({
      ...MANUAL,
      transform: undefined,
    });
    expect(res.ok).toBe(false);
    expect(db.signalMetricObservation?.create).not.toHaveBeenCalled();
  });

  it("recusa transformação só com espaços", async () => {
    const res = await recordObservation({ ...MANUAL, transform: "   " });
    expect(res.ok).toBe(false);
    expect(db.signalMetricObservation?.create).not.toHaveBeenCalled();
  });

  it("aceita observação de mapeamento SEM transformação no input", async () => {
    // Quando vem de fonte, a transformação é a do mapeamento — o usuário não
    // precisa (nem deve) reescrevê-la.
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "map_1",
      transform: "count(reopened) × custo_retrabalho",
      connection: { name: "Zendesk" },
    });
    const res = await recordObservation({
      ...MANUAL,
      transform: undefined,
      mappingCode: "MP-02",
      source: "SYNC",
    });
    expect(res.ok).toBe(true);
    expect(db.signalMetricObservation?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mappingId: "map_1",
          connectionLabel: "Zendesk",
          transform: "count(reopened) × custo_retrabalho",
        }),
      })
    );
  });

  it("a transformação do MAPEAMENTO vence a informada no input", async () => {
    // Deixar o usuário sobrescrevê-la faria a evidência divergir da regra que a
    // produziu — e a evidência existe justamente para provar a regra.
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "map_1",
      transform: "regra oficial do mapeamento",
      connection: { name: "Jira" },
    });
    await recordObservation({
      ...MANUAL,
      mappingCode: "MP-01",
      transform: "conta que eu inventei",
    });
    expect(db.signalMetricObservation?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transform: "regra oficial do mapeamento",
        }),
      })
    );
  });

  it("mapeamento inexistente é recusado", async () => {
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue(null);
    const res = await recordObservation({ ...MANUAL, mappingCode: "MP-99" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("evidence.mapping.not-found");
    }
  });
});

describe("autoria", () => {
  it("entrada manual carrega o autor", async () => {
    await recordObservation(MANUAL);
    expect(
      db.signalMetricObservation?.create.mock.calls[0]?.[0]?.data.recordedById
    ).toBe("usr_1");
  });

  it("sync NÃO é atribuído a pessoa nenhuma", async () => {
    // Observação automática com autor humano daria resposta errada à primeira
    // pergunta do auditor.
    db.signalMetricMapping!.findFirst = vi.fn().mockResolvedValue({
      id: "map_1",
      transform: "t",
      connection: { name: "Jira" },
    });
    await recordObservation({
      ...MANUAL,
      mappingCode: "MP-01",
      source: "SYNC",
    });
    expect(
      db.signalMetricObservation?.create.mock.calls[0]?.[0]?.data.recordedById
    ).toBeNull();
  });
});

describe("validação e guards", () => {
  it("recusa janela invertida", async () => {
    const res = await recordObservation({
      ...MANUAL,
      windowStart: "2026-07-09",
      windowEnd: "2026-06-01",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("evidence.window");
    }
  });

  it("checa a posse da iniciativa", async () => {
    h.requireInitiativeOwnership.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
    const res = await recordObservation(MANUAL);
    expect(res.ok).toBe(false);
    expect(db.signalMetricObservation?.create).not.toHaveBeenCalled();
  });

  it("exige a permissão de evidência", async () => {
    await recordObservation(MANUAL);
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.evidence.write"
    );
  });

  it("emite código sequencial e grava a trilha", async () => {
    const res = await recordObservation(MANUAL);
    expect(res.ok && res.data.code).toBe("EV-8841");
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({ action: "Observação registrada" })
    );
  });

  it("não existe caminho de update — corrigir é lançar outra", async () => {
    // A série congelada é o que permite dizer "em 04 de julho o número era este".
    const actions = await import("@/app/(signal)/actions/evidence");
    expect(Object.keys(actions)).not.toContain("updateObservation");
    expect(Object.keys(actions)).not.toContain("deleteObservation");
  });
});
