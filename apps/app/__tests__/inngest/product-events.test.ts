import { beforeEach, describe, expect, it, vi } from "vitest";

// X-04 — eventos entre produtos. O cliente Inngest é mockado: o que se prova é
// o contrato (nome, dados validados, id de idempotência) e que uma falha do
// Inngest nunca derruba a action de negócio que emitiu.
const h = vi.hoisted(() => ({
  send: vi.fn(),
  fallbackCreate: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({ inngest: { send: h.send } }));
vi.mock("@repo/database", () => ({
  database: { jobFallbackQueue: { create: h.fallbackCreate } },
}));
vi.mock("@repo/observability/log", () => ({
  log: { error: h.logError, warn: vi.fn(), info: vi.fn() },
}));

import { emitProductEvent } from "@/lib/inngest/emit-product-event";
import {
  buildProductEvent,
  PRODUCT_EVENTS,
} from "@/lib/inngest/product-events";

beforeEach(() => {
  vi.clearAllMocks();
  h.send.mockResolvedValue({ ids: ["evt-1"] });
  h.fallbackCreate.mockResolvedValue({});
});

const GATE_CLOSED = {
  tenantId: "t-1",
  trackId: "tr-1",
  trackCode: "TR-104",
  processName: "Triagem de autorizações prévias",
  closedPhase: "ASSESS",
  openedPhase: "PILOT",
  outcome: "PASSED",
  gateResultId: "gr-1",
  at: "2026-09-29T12:00:00.000Z",
} as const;

describe("nomes dos eventos", () => {
  it("seguem a convenção do repositório (domínio/coisa.ação) e não colidem", () => {
    expect(PRODUCT_EVENTS).toEqual({
      scaffoldGateClosed: "scaffold/gate.closed",
      scaffoldGateReopened: "scaffold/gate.reopened",
      signalBaselineFrozen: "signal/baseline.frozen",
      signalVerdict: "signal/verdict",
      signalTargetReviewRequested: "signal/target-review.requested",
      charterControlAccepted: "charter/control.accepted",
      charterControlExpired: "charter/control.expired",
    });
    const nomes = Object.values(PRODUCT_EVENTS);
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

describe("signal/target-review.requested", () => {
  it("id de idempotência sai do evento de histórico, não do relógio", () => {
    const data = {
      tenantId: "t1",
      initiativeId: "i1",
      initiativeCode: "IN-014",
      scaffoldTrackId: "tr1",
      planMetricId: "pm1",
      metricName: "Tempo até o destino correto",
      eventId: "ev-9",
      at: "2026-09-29T12:00:00.000Z",
    };
    const e = buildProductEvent("signalTargetReviewRequested", data);
    expect(e.name).toBe("signal/target-review.requested");
    expect(e.id).toBe("signal/target-review.requested:ev-9");
  });
});

describe("buildProductEvent", () => {
  it("monta o evento com id de idempotência derivado do fato, não do relógio", () => {
    const a = buildProductEvent("scaffoldGateClosed", GATE_CLOSED);
    const b = buildProductEvent("scaffoldGateClosed", {
      ...GATE_CLOSED,
      at: "2026-09-29T13:00:00.000Z",
    });

    expect(a.name).toBe("scaffold/gate.closed");
    expect(a.data).toEqual(GATE_CLOSED);
    expect(a.id).toBe("scaffold/gate.closed:gr-1");
    // Reenviar o mesmo fato depois não pode virar evento novo.
    expect(b.id).toBe(a.id);
  });

  it("reabertura: o id inclui o ciclo, senão a segunda reabertura seria descartada", () => {
    const primeira = buildProductEvent("scaffoldGateReopened", {
      tenantId: "t-1",
      trackId: "tr-1",
      trackCode: "TR-104",
      phase: "PILOT",
      phaseInstanceId: "ph-1",
      reopenCount: 1,
      at: "2026-09-29T12:00:00.000Z",
    });
    const segunda = buildProductEvent("scaffoldGateReopened", {
      tenantId: "t-1",
      trackId: "tr-1",
      trackCode: "TR-104",
      phase: "PILOT",
      phaseInstanceId: "ph-1",
      reopenCount: 2,
      at: "2026-09-30T12:00:00.000Z",
    });

    expect(primeira.id).not.toBe(segunda.id);
  });

  it("recusa dado inválido antes de sair (fase desconhecida)", () => {
    expect(() =>
      buildProductEvent("scaffoldGateClosed", {
        ...GATE_CLOSED,
        closedPhase: "OUTRA" as never,
      })
    ).toThrow();
  });

  it("exige tenantId em todo evento", () => {
    expect(() =>
      buildProductEvent("signalVerdict", {
        initiativeCode: "IN-014",
        verdict: "PROVEN",
      } as never)
    ).toThrow();
  });

  it("cobre os 6 eventos, inclusive controle aceito/vencido do Charter", () => {
    const controle = {
      tenantId: "t-1",
      useCaseId: "uc-1",
      caseControlId: "cc-1",
      controlCode: "TR-2",
      at: "2026-09-29T12:00:00.000Z",
    };
    expect(
      buildProductEvent("charterControlAccepted", {
        ...controle,
        expiresAt: "2027-03-29T12:00:00.000Z",
      }).name
    ).toBe("charter/control.accepted");
    expect(buildProductEvent("charterControlExpired", controle).name).toBe(
      "charter/control.expired"
    );
    expect(
      buildProductEvent("signalBaselineFrozen", {
        tenantId: "t-1",
        initiativeId: "i-1",
        initiativeCode: "IN-014",
        baselineId: "b-1",
        version: 2,
        scaffoldTrackId: "tr-1",
        at: "2026-09-29T12:00:00.000Z",
      }).id
    ).toBe("signal/baseline.frozen:b-1");
  });
});

describe("emitProductEvent", () => {
  it("envia pelo cliente Inngest com o id de idempotência", async () => {
    await emitProductEvent("scaffoldGateClosed", GATE_CLOSED);

    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "scaffold/gate.closed",
        id: "scaffold/gate.closed:gr-1",
        data: GATE_CLOSED,
      })
    );
  });

  it("se o Inngest cair, enfileira no fallback e NÃO lança", async () => {
    h.send.mockRejectedValue(new Error("inngest fora"));

    await expect(
      emitProductEvent("scaffoldGateClosed", GATE_CLOSED)
    ).resolves.toBeUndefined();

    expect(h.fallbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t-1",
          jobType: "scaffold/gate.closed",
        }),
      })
    );
  });

  it("dado inválido é registrado e engolido: emitir nunca derruba a action", async () => {
    await expect(
      emitProductEvent("scaffoldGateClosed", {
        ...GATE_CLOSED,
        closedPhase: "OUTRA" as never,
      })
    ).resolves.toBeUndefined();

    expect(h.send).not.toHaveBeenCalled();
    expect(h.logError).toHaveBeenCalled();
  });

  it("se até o fallback falhar, ainda assim não lança", async () => {
    h.send.mockRejectedValue(new Error("inngest fora"));
    h.fallbackCreate.mockRejectedValue(new Error("banco fora"));

    await expect(
      emitProductEvent("scaffoldGateClosed", GATE_CLOSED)
    ).resolves.toBeUndefined();
  });
});
