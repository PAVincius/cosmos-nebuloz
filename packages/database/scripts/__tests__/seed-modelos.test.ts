import { describe, expect, it, vi } from "vitest";
import {
  CONTROL_PROFILES,
  MEASURE_MODELS,
  type SeedDb,
  seedControlProfile,
  seedMeasureModel,
} from "../seed-modelos.mts";

const FORMAS = [
  "CONVERSATIONAL",
  "ANALYSIS",
  "DOC_REVIEW",
  "TRIAGE",
  "REPORTING",
];

describe("dados dos 5 modelos de medição (SG-PO-01/04)", () => {
  it("um modelo por forma de trabalho", () => {
    expect(MEASURE_MODELS.map((m) => m.workForm)).toEqual(FORMAS);
  });

  it.each(
    MEASURE_MODELS
  )("$workForm: uma primária, ao menos uma guarda, adoção e valor", (m) => {
    const porPapel = (r: string) =>
      m.metrics.filter((x) => x.role === r).length;
    expect(porPapel("PRIMARY")).toBe(1);
    expect(porPapel("GUARD")).toBeGreaterThanOrEqual(1);
    expect(porPapel("ADOPTION")).toBe(1);
    expect(porPapel("VALUE")).toBe(1);
  });

  it.each(
    MEASURE_MODELS
  )("$workForm: janela de 4 semanas, ao menos 2 armadilhas, fórmula em toda métrica", (m) => {
    expect(m.sampleWindowWeeks).toBeGreaterThanOrEqual(4);
    expect(m.traps.length).toBeGreaterThanOrEqual(2);
    expect(m.counterfactual.length).toBeGreaterThan(0);
    expect(m.sources.length).toBeGreaterThan(0);
    for (const metric of m.metrics) {
      expect(metric.formula.trim().length).toBeGreaterThan(0);
    }
  });

  it("direção do Norte: primária de tempo/horas desce, de resolução sobe", () => {
    const prim = (f: string) =>
      MEASURE_MODELS.find((m) => m.workForm === f)?.metrics.find(
        (x) => x.role === "PRIMARY"
      )?.direction;
    expect(prim("CONVERSATIONAL")).toBe("UP");
    expect(prim("ANALYSIS")).toBe("UP");
    expect(prim("DOC_REVIEW")).toBe("DOWN");
    expect(prim("TRIAGE")).toBe("DOWN");
    expect(prim("REPORTING")).toBe("DOWN");
  });
});

describe("dados dos 5 perfis de controle (CH-PO-01)", () => {
  it("um perfil por forma de trabalho, com 4/3/3/3/3 controles", () => {
    expect(CONTROL_PROFILES.map((p) => p.workForm)).toEqual(FORMAS);
    expect(CONTROL_PROFILES.map((p) => p.controls.length)).toEqual([
      4, 3, 3, 3, 3,
    ]);
  });

  it("códigos únicos e com o prefixo do perfil", () => {
    const prefixo: Record<string, string> = {
      CONVERSATIONAL: "CV",
      ANALYSIS: "AN",
      DOC_REVIEW: "DR",
      TRIAGE: "TR",
      REPORTING: "RP",
    };
    const todos = CONTROL_PROFILES.flatMap((p) =>
      p.controls.map((c) => {
        expect(c.code.startsWith(`${prefixo[p.workForm]}-`)).toBe(true);
        return c.code;
      })
    );
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("o único controle não dispensável é o RIPD (CV-4), com classe mínima CONFIDENTIAL", () => {
    const naoDispensaveis = CONTROL_PROFILES.flatMap((p) =>
      p.controls.filter((c) => c.dispensable === false)
    );
    expect(naoDispensaveis.map((c) => c.code)).toEqual(["CV-4"]);
    expect(naoDispensaveis[0].minClass).toBe("CONFIDENTIAL");
  });

  it("todo controle tem evidência e critério de aceite escritos", () => {
    for (const p of CONTROL_PROFILES) {
      for (const c of p.controls) {
        expect(c.evidence.trim().length).toBeGreaterThan(0);
        expect(c.acceptanceCriteria.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("caminho de decisão do Norte por perfil", () => {
    expect(CONTROL_PROFILES.map((p) => p.decisionRole)).toEqual([
      "LEGAL",
      "COMPLIANCE",
      "SECURITY",
      "COMPLIANCE",
      "COMPLIANCE",
    ]);
  });
});

/** Db falso que registra tudo; qualquer método além de findUnique/create/
 *  createMany/$transaction não existe, então um update/upsert/delete quebraria. */
function makeDb(existing: { model?: boolean; version?: boolean } = {}) {
  const db = {
    signalMeasureModel: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existing.model ? { id: "m-0" } : null),
      create: vi.fn().mockResolvedValue({ id: "m-1" }),
    },
    signalMeasureModelVersion: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existing.version ? { id: "v-0" } : null),
      create: vi.fn().mockResolvedValue({ id: "v-1" }),
    },
    signalMeasureModelMetric: { createMany: vi.fn().mockResolvedValue({}) },
    charterControlProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existing.model ? { id: "p-0" } : null),
      create: vi.fn().mockResolvedValue({ id: "p-1" }),
    },
    charterControlProfileVersion: {
      findUnique: vi
        .fn()
        .mockResolvedValue(existing.version ? { id: "pv-0" } : null),
      create: vi.fn().mockResolvedValue({ id: "pv-1" }),
    },
    charterControlProfileControl: { createMany: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(
    async (fn: (tx: SeedDb) => Promise<unknown>) => fn(db as never)
  );
  return db;
}

describe("seedMeasureModel", () => {
  it("cria modelo, versão e métricas, com seq e sem nada de update", async () => {
    const db = makeDb();

    const r = await seedMeasureModel(db as never, MEASURE_MODELS[0]);

    expect(r).toEqual({ created: 1, skipped: 0 });
    expect(db.signalMeasureModel.create).toHaveBeenCalledTimes(1);
    const { data } = db.signalMeasureModelMetric.createMany.mock.calls[0][0];
    expect(data.map((d: { seq: number }) => d.seq)).toEqual([1, 2, 3, 4]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("segunda rodada: versão existente é pulada, nada é escrito", async () => {
    const db = makeDb({ model: true, version: true });

    const r = await seedMeasureModel(db as never, MEASURE_MODELS[0]);

    expect(r).toEqual({ created: 0, skipped: 1 });
    expect(db.signalMeasureModel.create).not.toHaveBeenCalled();
    expect(db.signalMeasureModelVersion.create).not.toHaveBeenCalled();
    expect(db.signalMeasureModelMetric.createMany).not.toHaveBeenCalled();
  });

  it("modelo existente com versão nova: reaproveita o modelo, só cria a versão", async () => {
    const db = makeDb({ model: true });

    await seedMeasureModel(db as never, MEASURE_MODELS[0]);

    expect(db.signalMeasureModel.create).not.toHaveBeenCalled();
    expect(db.signalMeasureModelVersion.create).toHaveBeenCalledTimes(1);
  });
});

describe("seedControlProfile", () => {
  it("cria a versão SEM assinaturas (rascunho)", async () => {
    const db = makeDb();

    const r = await seedControlProfile(db as never, CONTROL_PROFILES[0]);

    expect(r).toEqual({ created: 1, skipped: 0 });
    const { data } = db.charterControlProfileVersion.create.mock.calls[0][0];
    expect(data.legalSignedBy).toBeUndefined();
    expect(data.securitySignedBy).toBeUndefined();
    expect(data.legalSignedAt).toBeUndefined();
    expect(data.securitySignedAt).toBeUndefined();
  });

  it("grava dispensable=false só no RIPD", async () => {
    const db = makeDb();

    await seedControlProfile(db as never, CONTROL_PROFILES[0]);

    const { data } =
      db.charterControlProfileControl.createMany.mock.calls[0][0];
    const porCodigo = Object.fromEntries(
      data.map((d: { code: string; dispensable: boolean }) => [
        d.code,
        d.dispensable,
      ])
    );
    expect(porCodigo).toEqual({
      "CV-1": true,
      "CV-2": true,
      "CV-3": true,
      "CV-4": false,
    });
  });

  it("segunda rodada: versão existente é pulada, nada é escrito", async () => {
    const db = makeDb({ model: true, version: true });

    const r = await seedControlProfile(db as never, CONTROL_PROFILES[1]);

    expect(r).toEqual({ created: 0, skipped: 1 });
    expect(db.charterControlProfile.create).not.toHaveBeenCalled();
    expect(db.charterControlProfileVersion.create).not.toHaveBeenCalled();
    expect(db.charterControlProfileControl.createMany).not.toHaveBeenCalled();
  });
});
