import { beforeEach, describe, expect, it, vi } from "vitest";

// SG-PO-05 — aprovar uma proposta numa iniciativa que JÁ TEM baseline assinado
// congela a métrica na hora. O consumidor de signal/baseline.frozen só pega
// métrica que existia quando o baseline foi assinado; uma proposta aprovada
// depois nunca o veria.
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
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: vi.fn(),
}));
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

import { approveMetric, pauseMetric } from "@/app/(signal)/actions/plan-flow";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "OWNER",
  user: { id: "usr_1", name: "Paula", email: "p@vanta.test" },
};

const metric = (over: Record<string, unknown> = {}) => ({
  id: "pm_1",
  tenantId: "tnt_1",
  initiativeId: "ini_1",
  role: "GUARD",
  name: "Tempo",
  formula: "f",
  direction: "DOWN",
  state: "PROPOSED",
  version: 1,
  baselineDimensionKey: "TIME",
  baselineValue: null,
  initiative: {
    id: "ini_1",
    code: "IN-014",
    ownerId: "usr_1",
    scaffoldTrackId: null,
  },
  ...over,
});

type Fn = ReturnType<typeof vi.fn>;
type Db = Record<string, Record<string, Fn>>;
let db: Db;

const signed = (dims: { key: string; numericValue: unknown }[]) =>
  vi.fn().mockResolvedValue({ dimensions: dims });

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.logSignalAudit.mockResolvedValue(undefined);
  db = {
    signalPlanMetric: {
      findFirst: vi.fn().mockResolvedValue(metric()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    signalBaseline: { findFirst: vi.fn().mockResolvedValue(null) },
    signalPlanMetricEvent: { create: vi.fn().mockResolvedValue({ id: "ev" }) },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("aprovar métrica proposta (SG-PO-05)", () => {
  it("sem baseline assinado: Proposta -> Sem fonte, um evento APPROVE", async () => {
    const r = await approveMetric({ id: "pm_1" });

    expect(r).toEqual({ ok: true, data: { state: "NO_SOURCE" } });
    expect(db.signalPlanMetric?.updateMany.mock.calls[0][0].data).toEqual({
      state: "NO_SOURCE",
    });
    expect(db.signalPlanMetricEvent?.create).toHaveBeenCalledTimes(1);
  });

  it("COM baseline assinado: congela na hora, com o valor da dimensão", async () => {
    db.signalBaseline!.findFirst = signed([
      { key: "TIME", numericValue: "46" },
    ]);

    const r = await approveMetric({ id: "pm_1" });

    expect(r).toEqual({ ok: true, data: { state: "FROZEN" } });
    expect(db.signalPlanMetric?.updateMany.mock.calls[0][0].data).toEqual({
      state: "FROZEN",
      baselineValue: "46",
      version: { increment: 1 },
    });
  });

  it("congelar na aprovação grava APPROVE (do ator) e FREEZE (do sistema)", async () => {
    db.signalBaseline!.findFirst = signed([
      { key: "TIME", numericValue: "46" },
    ]);

    await approveMetric({ id: "pm_1" });

    const events = db.signalPlanMetricEvent!.create.mock.calls.map(
      (c) => c[0].data
    );
    expect(events.map((e: { action: string }) => e.action)).toEqual([
      "APPROVE",
      "FREEZE",
    ]);
    expect(events[0]).toMatchObject({ actorId: "usr_1", toState: "NO_SOURCE" });
    expect(events[1]).toMatchObject({
      actorId: null,
      fromState: "NO_SOURCE",
      toState: "FROZEN",
      version: 2,
    });
  });

  it("só lê baseline ASSINADO desta iniciativa e tenant, o mais recente", async () => {
    await approveMetric({ id: "pm_1" });

    expect(db.signalBaseline?.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tnt_1",
          initiativeId: "ini_1",
          signedAt: { not: null },
        },
        orderBy: { version: "desc" },
      })
    );
  });

  it("não apaga baselineValue que a métrica já tinha (dimensão sem valor)", async () => {
    db.signalPlanMetric!.findFirst = vi
      .fn()
      .mockResolvedValue(metric({ baselineValue: "12" }));
    db.signalBaseline!.findFirst = signed([
      { key: "TIME", numericValue: null },
    ]);

    await approveMetric({ id: "pm_1" });

    expect(
      db.signalPlanMetric?.updateMany.mock.calls[0][0].data.baselineValue
    ).toBe("12");
  });

  it("congelada sem nenhum valor diz isso no evento", async () => {
    db.signalBaseline!.findFirst = signed([
      { key: "OUTRA", numericValue: "1" },
    ]);

    await approveMetric({ id: "pm_1" });

    const freeze = db.signalPlanMetricEvent!.create.mock.calls[1][0].data;
    expect(freeze.comment).toMatch(/sem valor de baseline/i);
  });

  it("corrida (count 0) não grava evento nenhum", async () => {
    db.signalBaseline!.findFirst = signed([
      { key: "TIME", numericValue: "46" },
    ]);
    db.signalPlanMetric!.updateMany = vi.fn().mockResolvedValue({ count: 0 });

    const r = await approveMetric({ id: "pm_1" });

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetricEvent?.create).not.toHaveBeenCalled();
  });

  // ── Casos que existiam em plan-approve.test.ts (approvePlanMetric descartada) ──

  it("exige signal.initiative.write e ser dono da iniciativa", async () => {
    await approveMetric({ id: "pm_1" });

    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.initiative.write"
    );
    expect(h.requireInitiativeOwnership).toHaveBeenCalled();
  });

  it("só aprova métrica PROPOSED", async () => {
    db.signalPlanMetric!.findFirst = vi
      .fn()
      .mockResolvedValue(metric({ state: "MEASURING" }));

    const r = await approveMetric({ id: "pm_1" });

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetric?.updateMany).not.toHaveBeenCalled();
    expect(db.signalPlanMetricEvent?.create).not.toHaveBeenCalled();
  });

  it("métrica de outra iniciativa ou tenant não existe (procurada pelo tenant do contexto)", async () => {
    db.signalPlanMetric!.findFirst = vi.fn().mockResolvedValue(null);

    const r = await approveMetric({ id: "pm_de_outro_tenant" });

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetric?.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pm_de_outro_tenant", tenantId: "tnt_1" },
      })
    );
    expect(db.signalPlanMetric?.updateMany).not.toHaveBeenCalled();
  });

  it("audita a aprovação; congelada na hora, o rótulo diz que congelou", async () => {
    await approveMetric({ id: "pm_1" });
    expect(h.logSignalAudit).toHaveBeenLastCalledWith(
      db,
      CTX,
      expect.objectContaining({
        action: "Métrica aprovada no plano",
        entityType: "signal.planmetric",
        entityId: "pm_1",
      })
    );

    db.signalBaseline!.findFirst = signed([
      { key: "TIME", numericValue: "46" },
    ]);
    await approveMetric({ id: "pm_1" });
    expect(h.logSignalAudit).toHaveBeenLastCalledWith(
      db,
      CTX,
      expect.objectContaining({ action: "Métrica aprovada e congelada" })
    );
  });

  it("ADMIN não aprova métrica proposta (SG-PO-03)", async () => {
    h.requireSignalPermissionContext.mockResolvedValue({
      ...CTX,
      signalRole: "ADMIN",
    });

    const r = await approveMetric({ id: "pm_1" });

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetric?.updateMany).not.toHaveBeenCalled();
  });

  it("outras transições (pausar) não consultam baseline", async () => {
    // pausar exige comentário e métrica em Medindo: só confirma que o baseline
    // não é lido fora da aprovação.
    db.signalPlanMetric!.findFirst = vi
      .fn()
      .mockResolvedValue(metric({ state: "MEASURING" }));

    await pauseMetric({ id: "pm_1", comment: "Fonte em manutenção." });

    expect(db.signalBaseline?.findFirst).not.toHaveBeenCalled();
  });
});
