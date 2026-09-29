import { beforeEach, describe, expect, it, vi } from "vitest";

// CH-DEV-07 / CH-PO-04 — job de vencimento por cadência:
//   • Aceita cuja validade passou => Vencida, com evento e charter/control.expired;
//   • Dispensado cujo prazo de revisão passou => Reaberto, com evento.
// Idempotente (o UPDATE só age no estado esperado). Cliente Inngest mockado.
const h = vi.hoisted(() => ({
  tenantModuleFindMany: vi.fn(),
  ccFindMany: vi.fn(),
  ccUpdateMany: vi.fn(),
  evCreateMany: vi.fn(),
  auditCreateMany: vi.fn(),
  captureException: vi.fn(),
  withTenantDb: vi.fn(),
  emit: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      config: unknown,
      handler: (ctx: unknown) => Promise<unknown>
    ) => ({ config, handler }),
  },
}));
vi.mock("@repo/database", () => ({
  database: { tenantModule: { findMany: h.tenantModuleFindMany } },
  withTenantDb: h.withTenantDb,
}));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: h.emit,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: h.captureException }));
vi.mock("@repo/observability/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  expireCharterControls,
  expireDueControls,
} from "@/lib/inngest/charter-control-expiry";

const NOW = new Date("2026-09-29T04:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  h.ccUpdateMany.mockResolvedValue({ count: 1 });
  h.evCreateMany.mockResolvedValue({ count: 1 });
  h.auditCreateMany.mockResolvedValue({ count: 1 });
  h.emit.mockResolvedValue(undefined);
  h.ccFindMany.mockImplementation(async (args: { where: { state: string } }) =>
    args.where.state === "ACCEPTED"
      ? [
          { id: "cc1", useCaseId: "uc1", code: "TR-2" },
          { id: "cc2", useCaseId: "uc1", code: "TR-3" },
        ]
      : [{ id: "cc3", useCaseId: "uc2", code: "CV-1" }]
  );
  h.withTenantDb.mockImplementation(
    async (_t: string, fn: (db: unknown) => Promise<unknown>) =>
      fn({
        charterCaseControl: {
          findMany: h.ccFindMany,
          updateMany: h.ccUpdateMany,
        },
        charterCaseControlEvent: { createMany: h.evCreateMany },
        auditLog: { createMany: h.auditCreateMany },
      })
  );
});

describe("expireDueControls", () => {
  it("procura só aceitos com validade vencida e dispensados com prazo vencido, no tenant", async () => {
    await expireDueControls("t-1", NOW);

    const wheres = h.ccFindMany.mock.calls.map((c) => c[0].where);
    expect(wheres).toContainEqual({
      tenantId: "t-1",
      state: "ACCEPTED",
      expiresAt: { lte: NOW },
    });
    expect(wheres).toContainEqual({
      tenantId: "t-1",
      state: "DISPENSED",
      dispensedUntil: { lte: NOW },
    });
    expect(h.withTenantDb).toHaveBeenCalledWith("t-1", expect.any(Function));
  });

  it("Aceita -> Vencida, guardando o estado esperado no UPDATE", async () => {
    await expireDueControls("t-1", NOW);

    // A condição de vencimento repete no UPDATE: entre o SELECT e o UPDATE a
    // pessoa pode ter renovado a evidência (expiresAt novo), e um UPDATE só por
    // estado a venceria à força.
    expect(h.ccUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "cc1",
        tenantId: "t-1",
        state: "ACCEPTED",
        expiresAt: { lte: NOW },
      },
      data: { state: "EXPIRED" },
    });
  });

  it("grava o evento EXPIRE sem ator, com de/para", async () => {
    await expireDueControls("t-1", NOW);

    const rows = h.evCreateMany.mock.calls
      .flatMap((c) => c[0].data)
      .filter((e: { action: string }) => e.action === "EXPIRE");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      tenantId: "t-1",
      caseControlId: "cc1",
      actorId: null,
      fromState: "ACCEPTED",
      toState: "EXPIRED",
    });
  });

  it("Dispensado com prazo vencido -> Reaberto, limpando a dispensa, com evento e motivo", async () => {
    await expireDueControls("t-1", NOW);

    expect(h.ccUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "cc3",
        tenantId: "t-1",
        state: "DISPENSED",
        dispensedUntil: { lte: NOW },
      },
      data: {
        state: "REOPENED",
        dispensedUntil: null,
        dispensedReason: null,
      },
    });
    const reopen = h.evCreateMany.mock.calls
      .flatMap((c) => c[0].data)
      .find((e: { action: string }) => e.action === "REOPEN");
    expect(reopen).toMatchObject({
      caseControlId: "cc3",
      actorId: null,
      fromState: "DISPENSED",
      toState: "REOPENED",
    });
    expect(reopen.comment).toMatch(/prazo/i);
  });

  it("audita cada mudança com ator system (a trilha do Charter não some no job)", async () => {
    await expireDueControls("t-1", NOW);

    const rows = h.auditCreateMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      tenantId: "t-1",
      actorType: "system",
      actorId: null,
      userId: null,
      action: "Controle vencido",
      entityType: "charter.casecontrol",
      entityId: "cc1",
    });
    expect(rows.map((r: { action: string }) => r.action)).toContain(
      "Controle reaberto por prazo de dispensa"
    );
  });

  it("devolve os vencidos para o chamador anunciar depois da transação", async () => {
    const r = await expireDueControls("t-1", NOW);

    expect(r.expired.map((e) => e.code)).toEqual(["TR-2", "TR-3"]);
    expect(r.reopened).toBe(1);
    expect(h.emit).not.toHaveBeenCalled();
  });

  it("idempotente: quem já mudou de estado (count 0) não gera evento nem anúncio", async () => {
    h.ccUpdateMany.mockResolvedValue({ count: 0 });

    const r = await expireDueControls("t-1", NOW);

    expect(r.expired).toEqual([]);
    expect(r.reopened).toBe(0);
    expect(h.evCreateMany).not.toHaveBeenCalled();
    expect(h.auditCreateMany).not.toHaveBeenCalled();
  });

  it("nada vencido: nada é escrito", async () => {
    h.ccFindMany.mockResolvedValue([]);

    const r = await expireDueControls("t-1", NOW);

    expect(r).toEqual({ expired: [], reopened: 0 });
    expect(h.ccUpdateMany).not.toHaveBeenCalled();
    expect(h.evCreateMany).not.toHaveBeenCalled();
  });
});

describe("expireCharterControls (função Inngest)", () => {
  const fn = expireCharterControls as unknown as {
    config: {
      id: string;
      triggers: { cron: string }[];
      concurrency: { limit: number };
    };
    handler: (ctx: unknown) => Promise<unknown>;
  };

  it("roda de madrugada, uma vez por dia, com concorrência 1", () => {
    expect(fn.config.id).toBe("charter-control-expiry");
    expect(fn.config.triggers).toEqual([{ cron: "0 4 * * *" }]);
    expect(fn.config.concurrency).toEqual({ limit: 1 });
  });

  it("varre só tenants com Charter vigente e anuncia charter/control.expired de cada vencido", async () => {
    h.tenantModuleFindMany.mockResolvedValue([{ tenantId: "t-1" }]);
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    const r = await fn.handler({ step });

    expect(h.tenantModuleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          module: "CHARTER",
          status: { in: ["ACTIVE", "TRIAL"] },
        }),
      })
    );
    expect(h.emit).toHaveBeenCalledTimes(2);
    expect(h.emit.mock.calls[0][0]).toBe("charterControlExpired");
    expect(h.emit.mock.calls[0][1]).toMatchObject({
      tenantId: "t-1",
      useCaseId: "uc1",
      caseControlId: "cc1",
      controlCode: "TR-2",
    });
    expect(r).toMatchObject({ expired: 2, reopened: 1 });
  });

  it("falha em um tenant não impede os outros", async () => {
    h.tenantModuleFindMany.mockResolvedValue([
      { tenantId: "t-ruim" },
      { tenantId: "t-1" },
    ]);
    h.withTenantDb
      .mockRejectedValueOnce(new Error("tenant quebrado"))
      .mockImplementation(
        async (_t: string, f: (db: unknown) => Promise<unknown>) =>
          f({
            charterCaseControl: {
              findMany: h.ccFindMany,
              updateMany: h.ccUpdateMany,
            },
            charterCaseControlEvent: { createMany: h.evCreateMany },
            auditLog: { createMany: h.auditCreateMany },
          })
      );
    const step = { run: vi.fn(async (_id: string, f: () => unknown) => f()) };

    const r = await fn.handler({ step });

    expect(r).toMatchObject({ expired: 2, failedTenants: 1 });
    // Falha de tenant vai ao Sentry, não só ao log: job noturno que falha em
    // silêncio deixa controle vencido sem bloquear a decisão.
    expect(h.captureException).toHaveBeenCalledTimes(1);
    expect(h.captureException.mock.calls[0][1]).toMatchObject({
      tags: { job: "charter-control-expiry" },
      extra: { tenantId: "t-ruim" },
    });
  });
});
