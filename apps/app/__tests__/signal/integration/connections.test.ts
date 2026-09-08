import { beforeEach, describe, expect, it, vi } from "vitest";

// Conexões — US4.
//
// O que estes testes protegem: que a queda de uma fonte PROPAGUE inteira, na
// mesma transação. Uma janela em que o painel mostra a fonte vermelha e o
// número dela verde é pior do que não mostrar nada — sugere que alguém já
// conferiu.

const h = vi.hoisted(() => ({
  requireSignalPermissionContext: vi.fn(),
  withTenantDb: vi.fn(),
  nextCode: vi.fn(),
  logSignalAudit: vi.fn(),
  logSignalSystemAudit: vi.fn(),
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
  return {
    ...actual,
    nextCode: h.nextCode,
    logSignalAudit: h.logSignalAudit,
    logSignalSystemAudit: h.logSignalSystemAudit,
  };
});

import {
  recomputeHealth,
  recordSync,
} from "@/app/(signal)/actions/connections";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const connection = (over: Record<string, unknown> = {}) => ({
  id: "cn_1",
  code: "CN-02",
  name: "Zendesk",
  health: "HEALTHY",
  lastSyncAt: new Date("2026-07-09T11:00:00Z"),
  expectedFreqMinutes: 15,
  errorMessage: null,
  rowsLabel: "1,2 mi eventos",
  ...over,
});

const mapping = (over: Record<string, unknown> = {}) => ({
  id: "mp_1",
  state: "ACTIVE",
  metricLabel: "Retrabalho evitado",
  initiativeId: "ini_1",
  initiative: { id: "ini_1", code: "IN-014" },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.nextCode.mockResolvedValue("AL-01");
  h.logSignalAudit.mockResolvedValue(undefined);
  h.logSignalSystemAudit.mockResolvedValue(undefined);

  db = {
    signalConnection: {
      findUnique: vi.fn().mockResolvedValue(connection()),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    signalSettings: {
      findUnique: vi.fn().mockResolvedValue({ staleHours: 48 }),
    },
    signalMetricMapping: {
      findMany: vi.fn().mockResolvedValue([mapping()]),
      update: vi.fn().mockResolvedValue({}),
    },
    signalMetricObservation: { updateMany: vi.fn().mockResolvedValue({}) },
    signalAlert: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "al_1" }),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("sync com falha", () => {
  const fail = () =>
    recordSync({
      code: "CN-02",
      ok: false,
      error: "OAuth revogado. Reautorizar em Zendesk Admin → Apps.",
    });

  it("marca a conexão como DOWN", async () => {
    const res = await fail();
    expect(res.ok && res.data.health).toBe("DOWN");
    expect(db.signalConnection?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ health: "DOWN" }),
      })
    );
  });

  it("quebra os mapeamentos da fonte", async () => {
    await fail();
    expect(db.signalMetricMapping?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { state: "BROKEN" },
      })
    );
  });

  it("congela as observações ABERTAS, com ressalva legível", async () => {
    await fail();
    const call = db.signalMetricObservation?.updateMany.mock.calls[0]?.[0];
    // Só as abertas: a data do primeiro congelamento é o que responde "até
    // quando este número valeu".
    expect(call.where).toMatchObject({ frozenAt: null });
    expect(call.data.flag).toContain("Congelada");
    expect(call.data.frozenAt).toBeInstanceOf(Date);
  });

  it("abre alerta de dado parado como ato do SISTEMA", async () => {
    await fail();
    expect(db.signalAlert?.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "STALE", state: "OPEN" }),
      })
    );
    // Um job registrou o sync; atribuir o alerta a uma pessoa daria a resposta
    // errada a "quem decidiu isso?".
    expect(h.logSignalSystemAudit).toHaveBeenCalled();
  });

  it("o alerta traz o CONSERTO, não só o sintoma", async () => {
    await fail();
    const data = db.signalAlert?.create.mock.calls[0]?.[0]?.data;
    expect(data.nextStep).toContain("Reconectar");
    expect(data.nextStep).toContain("CN-02");
  });

  it("grava o impacto nomeando métrica e iniciativa", async () => {
    await fail();
    const data = db.signalConnection?.update.mock.calls[0]?.[0]?.data;
    expect(data.impactNote).toContain("Retrabalho evitado (IN-014)");
  });

  it("não duplica alerta quando já existe um aberto", async () => {
    db.signalAlert!.findFirst = vi.fn().mockResolvedValue({ id: "al_old" });
    await fail();
    expect(db.signalAlert?.create).not.toHaveBeenCalled();
  });

  it("recusa falha sem mensagem de conserto", async () => {
    const res = await recordSync({ code: "CN-02", ok: false });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.rule).toBe("connection.error.required");
    }
    expect(db.signalConnection?.update).not.toHaveBeenCalled();
  });

  it("tudo acontece no MESMO db da transação", async () => {
    await fail();
    // Mapeamento, observação, alerta e conexão saem do mesmo cliente: se um
    // falhar, nenhum persiste.
    expect(h.withTenantDb).toHaveBeenCalledTimes(1);
    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({ action: "Falha de sync registrada" })
    );
  });
});

describe("sync com sucesso", () => {
  it("volta a saudável e reativa os mapeamentos", async () => {
    db.signalConnection!.findUnique = vi
      .fn()
      .mockResolvedValue(connection({ health: "DOWN", errorMessage: "x" }));
    db.signalMetricMapping!.findMany = vi
      .fn()
      .mockResolvedValue([mapping({ state: "BROKEN" })]);

    const res = await recordSync({
      code: "CN-02",
      ok: true,
      rowsLabel: "1,3 mi eventos",
    });
    expect(res.ok && res.data.health).toBe("HEALTHY");
    expect(db.signalMetricMapping?.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: "ACTIVE" } })
    );
  });

  it("NÃO descongela observações já congeladas", async () => {
    db.signalConnection!.findUnique = vi
      .fn()
      .mockResolvedValue(connection({ health: "DOWN", errorMessage: "x" }));
    await recordSync({ code: "CN-02", ok: true });
    // O congelamento é histórico: "em 04 de julho este número era este".
    // Reabri-lo reescreveria a série.
    expect(db.signalMetricObservation?.updateMany).not.toHaveBeenCalled();
  });

  it("não reabre contestação humana", async () => {
    db.signalMetricMapping!.findMany = vi
      .fn()
      .mockResolvedValue([mapping({ state: "REVIEW" })]);
    await recordSync({ code: "CN-02", ok: true });
    // Fonte voltar não encerra uma contestação de método.
    expect(db.signalMetricMapping?.update).not.toHaveBeenCalled();
  });

  it("limpa o erro e atualiza o rótulo de linhas", async () => {
    await recordSync({ code: "CN-02", ok: true, rowsLabel: "48 mi linhas" });
    const data = db.signalConnection?.update.mock.calls[0]?.[0]?.data;
    expect(data.errorMessage).toBeNull();
    expect(data.rowsLabel).toBe("48 mi linhas");
  });
});

describe("recomputeHealth", () => {
  it("marca atrasada a fonte que passou do prazo sem ninguém tentar sincronizar", async () => {
    // STALE é condição de TEMPO: nenhum evento acontece quando o prazo passa.
    // Sem a varredura, planilha abandonada fica verde para sempre.
    db.signalConnection!.findMany = vi.fn().mockResolvedValue([
      connection({
        health: "HEALTHY",
        lastSyncAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ]);
    const res = await recomputeHealth();
    expect(res.ok && res.data.changed).toBe(1);
    expect(db.signalConnection?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ health: "STALE" }),
      })
    );
  });

  it("não mexe no que já está no estado certo", async () => {
    // `recomputeHealth` mede contra o relógio real, então a fonte "em dia"
    // precisa de um sync recente de verdade — data fixa do passado seria STALE.
    db.signalConnection!.findMany = vi
      .fn()
      .mockResolvedValue([
        connection({ health: "HEALTHY", lastSyncAt: new Date() }),
      ]);
    const res = await recomputeHealth();
    expect(res.ok && res.data.changed).toBe(0);
    expect(db.signalConnection?.update).not.toHaveBeenCalled();
  });

  it("fonte manual não é marcada atrasada por relógio", async () => {
    db.signalConnection!.findMany = vi.fn().mockResolvedValue([
      connection({
        health: "HEALTHY",
        expectedFreqMinutes: null,
        lastSyncAt: new Date("2025-01-01T00:00:00Z"),
      }),
    ]);
    const res = await recomputeHealth();
    expect(res.ok && res.data.changed).toBe(0);
  });

  it("exige permissão de conexão, que é de ADMIN", async () => {
    await recomputeHealth();
    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.connection.write"
    );
  });
});
