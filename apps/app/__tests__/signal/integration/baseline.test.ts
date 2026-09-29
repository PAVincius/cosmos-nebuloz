import { beforeEach, describe, expect, it, vi } from "vitest";

// Baseline — US1.
//
// A invariante central: assinado é imutável. Um baseline que muda depois de
// assinado invalida retroativamente todo ganho já reportado contra ele — é o
// equivalente a mover a trave depois do gol.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  requireInitiativeOwnership: vi.fn(),
  withTenantDb: vi.fn(),
  logSignalAudit: vi.fn(),
  revalidatePath: vi.fn(),
  emit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: h.emit,
}));
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
  return { ...actual, logSignalAudit: h.logSignalAudit };
});

import { draftBaseline, signBaseline } from "@/app/(signal)/actions/baseline";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

/** As cinco dimensões obrigatórias, todas com fonte declarada. */
const FULL_DIMS = [
  {
    key: "TIME",
    label: "Tempo por caso",
    value: "46 min",
    sourceLabel: "Jira",
  },
  {
    key: "COST",
    label: "Custo por caso",
    value: "R$ 64",
    sourceLabel: "Sheets",
  },
  { key: "THROUGHPUT", label: "Volume", value: "340/sem", sourceLabel: "Jira" },
  {
    key: "QUALITY",
    label: "Retrabalho",
    value: "8,2%",
    sourceLabel: "Zendesk",
  },
  { key: "USER_BASE", label: "Base", value: "18", sourceLabel: "Diretório" },
];

const DRAFT_INPUT = {
  initiativeCode: "IN-014",
  windowLabel: "4 semanas · mai/2026",
  windowStart: "2026-05-01",
  windowEnd: "2026-05-29",
  dimensions: FULL_DIMS,
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.requireInitiativeOwnership.mockReturnValue(undefined);
  h.logSignalAudit.mockResolvedValue(undefined);
  h.emit.mockResolvedValue(undefined);

  db = {
    signalInitiative: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "ini_1", code: "IN-014", ownerId: "usr_1" }),
    },
    signalBaseline: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "b_1", version: 1 }),
      update: vi.fn().mockResolvedValue({ id: "b_1" }),
    },
    signalBaselineDimension: { deleteMany: vi.fn().mockResolvedValue({}) },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("rascunho", () => {
  it("cria a v1 quando não há baseline nenhum", async () => {
    const res = await draftBaseline(DRAFT_INPUT);
    expect(res.ok).toBe(true);
    expect(db.signalBaseline?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 1 }),
      })
    );
  });

  it("sobrescreve o rascunho aberto em vez de abrir versão nova", async () => {
    // Corrigir digitação não deveria virar versão. A lista de versões é a prova
    // de que a régua não mudou no meio do jogo — encher de ruído a inutiliza.
    db.signalBaseline!.findFirst = vi
      .fn()
      .mockResolvedValue({ id: "b_1", version: 1, signedAt: null });
    const res = await draftBaseline(DRAFT_INPUT);
    expect(res.ok).toBe(true);
    expect(db.signalBaseline?.update).toHaveBeenCalled();
    expect(db.signalBaseline?.create).not.toHaveBeenCalled();
  });

  it("abre versão nova quando a anterior já está assinada", async () => {
    db.signalBaseline!.findFirst = vi
      .fn()
      .mockResolvedValue({ id: "b_1", version: 1, signedAt: new Date() });
    db.signalBaseline!.create = vi
      .fn()
      .mockResolvedValue({ id: "b_2", version: 2 });
    const res = await draftBaseline(DRAFT_INPUT);
    expect(res.ok && res.data.version).toBe(2);
    expect(db.signalBaseline?.update).not.toHaveBeenCalled();
  });

  it("recusa janela que termina antes de começar", async () => {
    const res = await draftBaseline({
      ...DRAFT_INPUT,
      windowStart: "2026-05-29",
      windowEnd: "2026-05-01",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("baseline.window");
    }
  });

  it("checa a posse antes de gravar", async () => {
    h.requireInitiativeOwnership.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });
    const res = await draftBaseline(DRAFT_INPUT);
    expect(res.ok).toBe(false);
    expect(db.signalBaseline?.create).not.toHaveBeenCalled();
  });

  it("recusa dimensão sem fonte já no schema", async () => {
    const res = await draftBaseline({
      ...DRAFT_INPUT,
      dimensions: [
        { key: "TIME", label: "Tempo", value: "46 min", sourceLabel: "" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(db.signalBaseline?.create).not.toHaveBeenCalled();
  });
});

describe("assinatura", () => {
  const withDims = (dims: typeof FULL_DIMS) => {
    db.signalBaseline!.findUnique = vi.fn().mockResolvedValue({
      id: "b_1",
      version: 1,
      signedAt: null,
      windowLabel: "4 semanas · mai/2026",
      dimensions: dims,
    });
  };

  it("congela com as cinco dimensões presentes", async () => {
    withDims(FULL_DIMS);
    const res = await signBaseline({ initiativeCode: "IN-014", version: 1 });
    expect(res.ok).toBe(true);
    expect(db.signalBaseline?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signedById: "usr_1",
          signedAt: expect.any(Date),
        }),
      })
    );
  });

  it("anuncia o baseline congelado (X-04), só depois de assinar", async () => {
    db.signalInitiative!.findUnique = vi.fn().mockResolvedValue({
      id: "ini_1",
      code: "IN-014",
      ownerId: "usr_1",
      scaffoldTrackId: "trk_1",
    });
    withDims(FULL_DIMS);

    await signBaseline({ initiativeCode: "IN-014", version: 1 });

    expect(h.emit).toHaveBeenCalledTimes(1);
    const [key, data] = h.emit.mock.calls[0];
    expect(key).toBe("signalBaselineFrozen");
    expect(data).toMatchObject({
      tenantId: "tnt_1",
      initiativeId: "ini_1",
      initiativeCode: "IN-014",
      baselineId: "b_1",
      version: 1,
      scaffoldTrackId: "trk_1",
    });
  });

  it("iniciativa sem trilha do Scaffold emite scaffoldTrackId nulo", async () => {
    withDims(FULL_DIMS);

    await signBaseline({ initiativeCode: "IN-014", version: 1 });

    expect(h.emit.mock.calls[0][1].scaffoldTrackId).toBeNull();
  });

  it("baseline recusado não emite nada", async () => {
    withDims(FULL_DIMS.filter((d) => d.key !== "QUALITY"));

    await signBaseline({ initiativeCode: "IN-014", version: 1 });

    expect(h.emit).not.toHaveBeenCalled();
  });

  it("recusa com dimensão obrigatória faltando e NOMEIA quais", async () => {
    withDims(FULL_DIMS.filter((d) => d.key !== "QUALITY" && d.key !== "COST"));
    const res = await signBaseline({ initiativeCode: "IN-014", version: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("baseline.dimensions.incomplete");
      expect(res.error).toContain("Custo");
      expect(res.error).toContain("Qualidade");
    }
    expect(db.signalBaseline?.update).not.toHaveBeenCalled();
  });

  it("recusa dimensão com fonte em branco", async () => {
    withDims(
      FULL_DIMS.map((d) =>
        d.key === "COST" ? { ...d, sourceLabel: "   " } : d
      )
    );
    const res = await signBaseline({ initiativeCode: "IN-014", version: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("baseline.source.required");
    }
  });

  it("baseline assinado é IMUTÁVEL — reassinar é recusado", async () => {
    db.signalBaseline!.findUnique = vi.fn().mockResolvedValue({
      id: "b_1",
      version: 1,
      signedAt: new Date("2026-06-18"),
      dimensions: FULL_DIMS,
    });
    const res = await signBaseline({ initiativeCode: "IN-014", version: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("baseline.already-signed");
      expect(res.error).toContain("versão nova");
    }
    expect(db.signalBaseline?.update).not.toHaveBeenCalled();
  });

  it("versão inexistente é recusada com a mensagem certa", async () => {
    db.signalBaseline!.findUnique = vi.fn().mockResolvedValue(null);
    const res = await signBaseline({ initiativeCode: "IN-014", version: 9 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("baseline.not-found");
    }
  });

  it("grava a trilha com a data de assinatura", async () => {
    withDims(FULL_DIMS);
    await signBaseline({ initiativeCode: "IN-014", version: 1 });
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({ action: "Baseline assinado" })
    );
  });

  it("exige a permissão de baseline", async () => {
    withDims(FULL_DIMS);
    await signBaseline({ initiativeCode: "IN-014", version: 1 });
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.baseline.write"
    );
  });
});
