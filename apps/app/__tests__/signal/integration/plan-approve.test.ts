import { beforeEach, describe, expect, it, vi } from "vitest";

// SG-PO-03 / SG-PO-05 — aprovar métrica PROPOSED no plano.
//   • sem baseline assinado: Proposta -> Sem fonte;
//   • COM baseline assinado: congela na hora (o consumidor de
//     signal/baseline.frozen já passou e não vai rodar de novo para ela).
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

import { approvePlanMetric } from "@/app/(signal)/actions/plan";

const CTX = {
  tenantId: "tnt_1",
  userId: "usr_1",
  signalRole: "OWNER",
  user: { id: "usr_1", name: "Marina", email: "m@vanta.test" },
};
const INPUT = { initiativeCode: "IN-014", metricId: "pm_1" };

type Db = Record<string, Record<string, ReturnType<typeof vi.fn>>>;
let db: Db;

const metric = (over: Record<string, unknown> = {}) => ({
  id: "pm_1",
  state: "PROPOSED",
  version: 1,
  baselineDimensionKey: "TIME",
  baselineValue: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.requireSignalPermissionContext.mockResolvedValue(CTX);
  h.requireInitiativeOwnership.mockReturnValue(undefined);
  h.logSignalAudit.mockResolvedValue(undefined);

  db = {
    signalInitiative: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "ini_1", code: "IN-014", ownerId: "usr_1" }),
    },
    signalPlanMetric: {
      findFirst: vi.fn().mockResolvedValue(metric()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    signalBaseline: { findFirst: vi.fn().mockResolvedValue(null) },
    signalPlanMetricEvent: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  h.withTenantDb.mockImplementation((_t: string, fn: (d: unknown) => unknown) =>
    fn(db)
  );
});

describe("approvePlanMetric", () => {
  it("exige signal.initiative.write e ser dono da iniciativa", async () => {
    await approvePlanMetric(INPUT);

    expect(h.requireSignalPermissionContext).toHaveBeenCalledWith(
      "signal.initiative.write"
    );
    expect(h.requireInitiativeOwnership).toHaveBeenCalled();
  });

  it("sem baseline assinado: Proposta -> Sem fonte, com evento APPROVE do ator", async () => {
    const r = await approvePlanMetric(INPUT);

    expect(r).toEqual({ ok: true, data: { state: "NO_SOURCE" } });
    expect(db.signalPlanMetric?.updateMany).toHaveBeenCalledWith({
      where: { id: "pm_1", tenantId: "tnt_1", state: "PROPOSED" },
      data: { state: "NO_SOURCE", version: { increment: 1 } },
    });
    const events = db.signalPlanMetricEvent!.createMany!.mock.calls[0][0].data;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "APPROVE",
      actorId: "usr_1",
      fromState: "PROPOSED",
      toState: "NO_SOURCE",
    });
  });

  it("COM baseline assinado: congela na hora, com o valor da dimensão", async () => {
    db.signalBaseline!.findFirst = vi.fn().mockResolvedValue({
      id: "b_1",
      dimensions: [{ key: "TIME", numericValue: "46" }],
    });

    const r = await approvePlanMetric(INPUT);

    expect(r).toEqual({ ok: true, data: { state: "FROZEN" } });
    expect(db.signalPlanMetric?.updateMany).toHaveBeenCalledWith({
      where: { id: "pm_1", tenantId: "tnt_1", state: "PROPOSED" },
      data: {
        state: "FROZEN",
        baselineValue: "46",
        version: { increment: 1 },
      },
    });
  });

  it("congelar na aprovação registra DOIS eventos: APPROVE (ator) e FREEZE (sistema)", async () => {
    db.signalBaseline!.findFirst = vi.fn().mockResolvedValue({
      id: "b_1",
      dimensions: [{ key: "TIME", numericValue: "46" }],
    });

    await approvePlanMetric(INPUT);

    const events = db.signalPlanMetricEvent!.createMany!.mock.calls[0][0].data;
    expect(events.map((e: { action: string }) => e.action)).toEqual([
      "APPROVE",
      "FREEZE",
    ]);
    expect(events[0]).toMatchObject({ actorId: "usr_1", toState: "NO_SOURCE" });
    expect(events[1]).toMatchObject({
      actorId: null,
      fromState: "NO_SOURCE",
      toState: "FROZEN",
    });
  });

  it("só lê baseline ASSINADO desta iniciativa e tenant, o mais recente", async () => {
    await approvePlanMetric(INPUT);

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
    db.signalBaseline!.findFirst = vi.fn().mockResolvedValue({
      id: "b_1",
      dimensions: [{ key: "TIME", numericValue: null }],
    });

    await approvePlanMetric(INPUT);

    expect(
      db.signalPlanMetric?.updateMany.mock.calls[0][0].data.baselineValue
    ).toBe("12");
  });

  it("só aprova métrica PROPOSED", async () => {
    db.signalPlanMetric!.findFirst = vi
      .fn()
      .mockResolvedValue(metric({ state: "MEASURING" }));

    const r = await approvePlanMetric(INPUT);

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetric?.updateMany).not.toHaveBeenCalled();
  });

  it("métrica de outra iniciativa ou tenant não existe", async () => {
    db.signalPlanMetric!.findFirst = vi.fn().mockResolvedValue(null);

    const r = await approvePlanMetric(INPUT);

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetric?.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pm_1", tenantId: "tnt_1", initiativeId: "ini_1" },
      })
    );
  });

  it("se a métrica mudou no meio (count 0), falha sem gravar evento", async () => {
    db.signalPlanMetric!.updateMany = vi.fn().mockResolvedValue({ count: 0 });

    const r = await approvePlanMetric(INPUT);

    expect(r.ok).toBe(false);
    expect(db.signalPlanMetricEvent?.createMany).not.toHaveBeenCalled();
    expect(h.logSignalAudit).not.toHaveBeenCalled();
  });

  it("audita a aprovação", async () => {
    await approvePlanMetric(INPUT);

    expect(h.logSignalAudit).toHaveBeenCalledWith(
      db,
      CTX,
      expect.objectContaining({
        entityType: "signal.planmetric",
        entityId: "pm_1",
      })
    );
  });
});

describe("aprovar respeita quem decide (SG-PO-03)", () => {
  it("ADMIN não aprova métrica proposta", async () => {
    h.requireSignalPermissionContext.mockResolvedValue({
      ...CTX,
      signalRole: "ADMIN",
    });
    const res = await approvePlanMetric({
      initiativeCode: "IN-014",
      metricId: "pm_1",
    });
    expect(res).toMatchObject({ ok: false, rule: "plan.role.denied" });
    expect(db.signalPlanMetric.updateMany).not.toHaveBeenCalled();
  });
});
