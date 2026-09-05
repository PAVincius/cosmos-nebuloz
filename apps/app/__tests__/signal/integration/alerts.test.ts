import { beforeEach, describe, expect, it, vi } from "vitest";

// Alertas — US5.
//
// O que estes testes protegem: idempotência. `evaluateAlerts` roda de novo a
// cada avaliação, e reabrir um alerta que já estava aberto apagaria quem o
// reconheceu e quando. Do outro lado, um alerta que deixou de valer tem de
// FECHAR com nota — some sem explicação e o time desconfia da fila inteira.

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
  evaluateAlerts,
  listAlerts,
  setAlertState,
} from "@/app/(signal)/actions/alerts";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "ADMIN",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};

const WEEK = 7 * 24 * 60 * 60 * 1000;

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const settings = (over: Record<string, unknown> = {}) => ({
  adoptionBar: 60,
  lowAdoptionPct: 40,
  lowAdoptionWeeks: 8,
  weakRoi: "1.0",
  ...over,
});

/** Série semanal terminando agora, do mais recente para o mais antigo. */
function adoptionSeries(pcts: number[]) {
  const now = Date.now();
  return pcts.map((pct, i) => ({
    periodStart: new Date(now - (i + 1) * WEEK),
    periodEnd: new Date(now - i * WEEK),
    activeUsers: pct,
    licensedUsers: 100,
  }));
}

const initiative = (over: Record<string, unknown> = {}) => ({
  id: "in_1",
  code: "IN-014",
  name: "Copiloto de atendimento",
  adoption: adoptionSeries([72, 70, 68]),
  roiFormulas: [
    {
      entries: [
        { kind: "COST", total: "100000" },
        { kind: "RETURN", total: "230000" },
      ],
    },
  ],
  mappings: [
    {
      connection: { code: "CN-01", name: "Jira", health: "HEALTHY" },
    },
  ],
  alerts: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.nextCode.mockResolvedValue("AL-31");

  db = {
    signalSettings: { findUnique: vi.fn().mockResolvedValue(settings()) },
    signalInitiative: { findMany: vi.fn().mockResolvedValue([]) },
    signalAlert: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "al_1" }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  h.withTenantDb.mockImplementation(
    (_tenantId: string, fn: (d: Db) => unknown) => fn(db)
  );
});

describe("evaluateAlerts — as três regras", () => {
  it("abre LOW quando a adoção fica baixa a janela inteira", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        adoption: adoptionSeries([22, 25, 19, 30, 28, 24, 26, 21, 23]),
        roiFormulas: [],
      }),
    ]);

    const res = await evaluateAlerts();

    expect(res.ok).toBe(true);
    expect(db.signalAlert.create).toHaveBeenCalledTimes(1);
    expect(db.signalAlert.create.mock.calls[0][0].data.kind).toBe("LOW");
  });

  it("abre WEAK quando adotaram e o retorno não paga o custo", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        roiFormulas: [
          {
            entries: [
              { kind: "COST", total: "200000" },
              { kind: "RETURN", total: "80000" },
            ],
          },
        ],
      }),
    ]);

    await evaluateAlerts();

    expect(db.signalAlert.create.mock.calls[0][0].data.kind).toBe("WEAK");
  });

  it("abre STALE quando a fonte que alimenta a iniciativa parou", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        mappings: [
          { connection: { code: "CN-02", name: "Zendesk", health: "DOWN" } },
        ],
      }),
    ]);

    await evaluateAlerts();

    const created = db.signalAlert.create.mock.calls[0][0].data;
    expect(created.kind).toBe("STALE");
    expect(created.nextStep).toContain("CN-02");
  });

  it("lê os limiares do tenant, não constantes de código", async () => {
    // Barra de adoção em 90%: 72% deixa de ser "adotado" e vira LOW.
    db.signalSettings.findUnique.mockResolvedValue(
      settings({ lowAdoptionPct: 90, lowAdoptionWeeks: 2 })
    );
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({ roiFormulas: [] }),
    ]);

    await evaluateAlerts();

    expect(db.signalAlert.create.mock.calls[0][0].data.kind).toBe("LOW");
  });

  it("não abre nada quando está tudo em ordem", async () => {
    db.signalInitiative.findMany.mockResolvedValue([initiative()]);

    const res = await evaluateAlerts();

    expect(db.signalAlert.create).not.toHaveBeenCalled();
    expect(res.ok && res.data.opened).toBe(0);
  });

  it("só olha iniciativa ativa — encerrada não gera alerta", async () => {
    await evaluateAlerts();

    expect(db.signalInitiative.findMany.mock.calls[0][0].where.status).toBe(
      "ACTIVE"
    );
  });
});

describe("evaluateAlerts — idempotência", () => {
  it("não duplica alerta que já está aberto", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        mappings: [
          { connection: { code: "CN-02", name: "Zendesk", health: "DOWN" } },
        ],
        alerts: [{ id: "al_9", code: "AL-30", kind: "STALE" }],
      }),
    ]);

    const res = await evaluateAlerts();

    expect(db.signalAlert.create).not.toHaveBeenCalled();
    expect(res.ok && res.data.opened).toBe(0);
  });

  it("também respeita alerta já reconhecido — não reabre por cima", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        mappings: [
          { connection: { code: "CN-02", name: "Zendesk", health: "DOWN" } },
        ],
        alerts: [{ id: "al_9", code: "AL-30", kind: "STALE" }],
      }),
    ]);

    await evaluateAlerts();

    expect(db.signalAlert.update).not.toHaveBeenCalled();
  });

  it("busca alertas OPEN e ACKNOWLEDGED, não só OPEN", async () => {
    await evaluateAlerts();

    const select = db.signalInitiative.findMany.mock.calls[0][0].select;
    expect(select.alerts.where.state.in).toEqual(["OPEN", "ACKNOWLEDGED"]);
  });
});

describe("evaluateAlerts — resolução automática", () => {
  it("fecha o alerta cuja condição deixou de valer", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({ alerts: [{ id: "al_9", code: "AL-30", kind: "STALE" }] }),
    ]);

    const res = await evaluateAlerts();

    expect(db.signalAlert.update).toHaveBeenCalledTimes(1);
    expect(db.signalAlert.update.mock.calls[0][0].data.state).toBe("RESOLVED");
    expect(res.ok && res.data.resolved).toBe(1);
  });

  it("deixa nota dizendo por que fechou", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({ alerts: [{ id: "al_9", code: "AL-30", kind: "STALE" }] }),
    ]);

    await evaluateAlerts();

    expect(db.signalAlert.update.mock.calls[0][0].data.note).toContain(
      "deixou de valer"
    );
  });

  it("registra o fechamento como ato do sistema, não de pessoa", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({ alerts: [{ id: "al_9", code: "AL-30", kind: "STALE" }] }),
    ]);

    await evaluateAlerts();

    expect(h.logSignalSystemAudit).toHaveBeenCalled();
    expect(h.logSignalAudit).not.toHaveBeenCalled();
  });

  it("não fecha o que continua valendo", async () => {
    db.signalInitiative.findMany.mockResolvedValue([
      initiative({
        mappings: [
          { connection: { code: "CN-02", name: "Zendesk", health: "DOWN" } },
        ],
        alerts: [{ id: "al_9", code: "AL-30", kind: "STALE" }],
      }),
    ]);

    await evaluateAlerts();

    expect(db.signalAlert.update).not.toHaveBeenCalled();
  });
});

describe("setAlertState", () => {
  beforeEach(() => {
    db.signalAlert.findUnique.mockResolvedValue({
      id: "al_1",
      code: "AL-31",
      state: "OPEN",
      note: null,
      initiative: { code: "IN-014" },
    });
  });

  it("recusa resolver sem dizer o que foi feito", async () => {
    const res = await setAlertState({ code: "AL-31", state: "RESOLVED" });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.rule).toBe("alert.resolve.note");
    expect(db.signalAlert.update).not.toHaveBeenCalled();
  });

  it("resolve com nota e grava quem resolveu", async () => {
    const res = await setAlertState({
      code: "AL-31",
      state: "RESOLVED",
      note: "Reautorizamos o Zendesk; o sync voltou na quinta.",
    });

    expect(res.ok).toBe(true);
    const data = db.signalAlert.update.mock.calls[0][0].data;
    expect(data.resolvedById).toBe("usr_1");
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("reconhecer não exige nota — reconhecer não é resolver", async () => {
    const res = await setAlertState({ code: "AL-31", state: "ACKNOWLEDGED" });

    expect(res.ok).toBe(true);
    expect(db.signalAlert.update.mock.calls[0][0].data.resolvedAt).toBeNull();
  });

  it("recusa alerta de outra organização", async () => {
    db.signalAlert.findUnique.mockResolvedValue(null);

    const res = await setAlertState({ code: "AL-99", state: "ACKNOWLEDGED" });

    expect(res.ok === false && res.rule).toBe("alert.not-found");
  });
});

describe("listAlerts", () => {
  it("põe decisão antes de atenção, independente da data", async () => {
    const base = {
      state: "OPEN",
      initiative: { code: "IN-014", name: "Copiloto" },
      owner: null,
      resolvedBy: null,
      resolvedAt: null,
      what: "",
      nextStep: "",
      note: null,
    };
    db.signalAlert.findMany.mockResolvedValue([
      {
        ...base,
        code: "AL-30",
        kind: "STALE",
        raisedAt: new Date("2026-09-01"),
      },
      {
        ...base,
        code: "AL-29",
        kind: "WEAK",
        raisedAt: new Date("2026-07-01"),
      },
    ]);

    const res = await listAlerts();

    expect(res.ok && res.data.map((a) => a.code)).toEqual(["AL-29", "AL-30"]);
  });

  it("carrega a pergunta que o alerta faz, não só o rótulo", async () => {
    db.signalAlert.findMany.mockResolvedValue([
      {
        code: "AL-29",
        kind: "WEAK",
        state: "OPEN",
        initiative: { code: "IN-014", name: "Copiloto" },
        owner: null,
        resolvedBy: null,
        resolvedAt: null,
        raisedAt: new Date(),
        what: "",
        nextStep: "",
        note: null,
      },
    ]);

    const res = await listAlerts();

    expect(res.ok && res.data[0].question).toContain("Continua ou para?");
  });
});
