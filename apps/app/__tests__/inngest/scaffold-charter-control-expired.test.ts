import { beforeEach, describe, expect, it, vi } from "vitest";

// CH-PM-03 — charter/control.expired chega ao Scaffold. O gate da SCALE já lê os
// controles no fechamento (G-CHARTER); o consumidor só ANTECIPA o aviso:
//   • SCALE em GATE_READY  -> BLOCKED, com auditoria e o motivo;
//   • SCALE ainda em OPEN/REOPENED (passos pendentes) -> só auditoria de aviso;
//   • SCALE já FECHADA (CLOSED/OBSERVING) -> só auditoria: reabrir é ato humano
//     com comentário (SG-07), o sistema nunca reabre sozinho.
// OPEN -> BLOCKED não existe na máquina de fase, e o consumidor respeita a máquina.
const h = vi.hoisted(() => ({
  registryFindMany: vi.fn(),
  phaseFindFirst: vi.fn(),
  phaseUpdateMany: vi.fn(),
  auditCreate: vi.fn(),
  withTenantDb: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      config: unknown,
      handler: (ctx: unknown) => Promise<unknown>
    ) => ({ config, handler }),
  },
}));
vi.mock("@repo/database", () => ({ withTenantDb: h.withTenantDb }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  applyCharterControlExpired,
  reactToCharterControlExpired,
} from "@/lib/inngest/scaffold-charter-control-expired";

const base = {
  tenantId: "t-1",
  useCaseId: "uc-1",
  caseControlId: "cc-1",
  controlCode: "TR-2",
  at: "2026-09-29T04:00:00.000Z",
} as const;

const phase = (state: string) => ({
  id: "ph-1",
  state,
  track: { code: "TR-104" },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.registryFindMany.mockResolvedValue([{ scaffoldTrackId: "trk-1" }]);
  h.phaseFindFirst.mockResolvedValue(phase("GATE_READY"));
  h.phaseUpdateMany.mockResolvedValue({ count: 1 });
  h.auditCreate.mockResolvedValue({});
  h.withTenantDb.mockImplementation(
    async (_t: string, fn: (db: unknown) => Promise<unknown>) =>
      fn({
        processRegistry: { findMany: h.registryFindMany },
        scaffoldPhaseInstance: {
          findFirst: h.phaseFindFirst,
          updateMany: h.phaseUpdateMany,
        },
        auditLog: { create: h.auditCreate },
      })
  );
});

describe("applyCharterControlExpired", () => {
  it("acha a trilha pelo caso de uso no ProcessRegistry, dentro do tenant", async () => {
    await applyCharterControlExpired(base);

    expect(h.withTenantDb).toHaveBeenCalledWith("t-1", expect.any(Function));
    expect(h.registryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t-1",
          charterUseCaseId: "uc-1",
          scaffoldTrackId: { not: null },
        },
      })
    );
  });

  it("caso sem trilha ligada: nada a fazer", async () => {
    h.registryFindMany.mockResolvedValue([]);

    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 0, warned: 0 });
    expect(h.phaseFindFirst).not.toHaveBeenCalled();
  });

  it("SCALE em GATE_READY vai para BLOCKED, guardando o estado esperado", async () => {
    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 1, warned: 0 });
    expect(h.phaseUpdateMany).toHaveBeenCalledWith({
      where: { id: "ph-1", state: "GATE_READY" },
      data: { state: "BLOCKED" },
    });
  });

  it("só olha a fase SCALE da trilha do tenant", async () => {
    await applyCharterControlExpired(base);

    expect(h.phaseFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trackId: "trk-1",
          phase: "SCALE",
          track: { tenantId: "t-1" },
        },
      })
    );
  });

  it("audita o bloqueio: ator system, motivo e controle", async () => {
    await applyCharterControlExpired(base);

    const { data } = h.auditCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "t-1",
      actorType: "system",
      actorId: null,
      userId: null,
      action: "scaffold.gate.blocked_by_charter_control",
      entityType: "scaffold.phase",
      entityId: "ph-1",
    });
    expect(data.diff).toEqual([["Estado", "GATE_READY", "BLOCKED"]]);
    expect(data.metadata).toMatchObject({
      origin: "charter/control.expired",
      caseControlId: "cc-1",
      controlCode: "TR-2",
    });
    expect(JSON.stringify(data.metadata)).toContain("TR-104");
  });

  it.each([
    "OPEN",
    "REOPENED",
  ])("SCALE em %s: só aviso, sem mexer no estado", async (state) => {
    h.phaseFindFirst.mockResolvedValue(phase(state));

    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 0, warned: 1 });
    expect(h.phaseUpdateMany).not.toHaveBeenCalled();
    expect(h.auditCreate.mock.calls[0][0].data.action).toBe(
      "scaffold.gate.charter_control_expired"
    );
  });

  it.each([
    "CLOSED",
    "OBSERVING",
  ])("SCALE já fechada (%s): só aviso, NUNCA reabre sozinha", async (state) => {
    h.phaseFindFirst.mockResolvedValue(phase(state));

    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 0, warned: 1 });
    expect(h.phaseUpdateMany).not.toHaveBeenCalled();
    const { data } = h.auditCreate.mock.calls[0][0];
    expect(data.action).toBe(
      "scaffold.gate.charter_control_expired_after_close"
    );
    expect(data.diff).toBeUndefined();
  });

  it.each(["IDLE", "BLOCKED"])("SCALE em %s: nada a fazer", async (state) => {
    h.phaseFindFirst.mockResolvedValue(phase(state));

    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 0, warned: 0 });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("idempotente: se a fase já saiu de GATE_READY (count 0), não audita bloqueio", async () => {
    h.phaseUpdateMany.mockResolvedValue({ count: 0 });

    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 0, warned: 0 });
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("trilha sem fase SCALE: ignora", async () => {
    h.phaseFindFirst.mockResolvedValue(null);

    const r = await applyCharterControlExpired(base);

    expect(r).toEqual({ blocked: 0, warned: 0 });
  });
});

describe("reactToCharterControlExpired (função Inngest)", () => {
  const fn = reactToCharterControlExpired as unknown as {
    config: {
      id: string;
      triggers: { event: string }[];
      concurrency: { key: string; limit: number }[];
      retries: number;
    };
    handler: (ctx: unknown) => Promise<unknown>;
  };

  it("assina charter/control.expired e serializa por caso de uso", () => {
    expect(fn.config.id).toBe("scaffold-charter-control-expired");
    expect(fn.config.triggers).toEqual([{ event: "charter/control.expired" }]);
    expect(fn.config.concurrency).toEqual([
      { key: "event.data.useCaseId", limit: 1 },
    ]);
    expect(fn.config.retries).toBeGreaterThan(0);
  });

  it("valida o evento e aplica dentro de um step", async () => {
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    const r = await fn.handler({ event: { data: base }, step });

    expect(step.run).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ blocked: 1, warned: 0 });
  });

  it("recusa evento fora do contrato", async () => {
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    await expect(
      fn.handler({ event: { data: { ...base, tenantId: "" } }, step })
    ).rejects.toThrow();
    expect(h.withTenantDb).not.toHaveBeenCalled();
  });
});
