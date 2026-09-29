import { beforeEach, describe, expect, it, vi } from "vitest";

// X-04 — a reabertura de fase por entregável reaberto anuncia
// `scaffold/gate.reopened` pelo mesmo contrato do reopenPhase (fase reaberta é
// notícia para o resto do produto).
const h = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/inngest/emit-product-event", () => ({
  emitProductEvent: h.emit,
}));

import { emitGateReopened } from "@/lib/scaffold/gate-events";

const EVENT = {
  tenantId: "t1",
  trackId: "trk1",
  trackCode: "TR-104",
  phaseInstanceId: "ph1",
  phase: "PILOT",
  reopenCount: 2,
  at: "2026-09-29T12:00:00.000Z",
  actorId: "u1",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.emit.mockResolvedValue(undefined);
});

describe("emitGateReopened", () => {
  it("emite scaffold/gate.reopened com o contrato compartilhado", async () => {
    await emitGateReopened(EVENT);

    expect(h.emit).toHaveBeenCalledTimes(1);
    expect(h.emit).toHaveBeenCalledWith("scaffoldGateReopened", {
      tenantId: "t1",
      trackId: "trk1",
      trackCode: "TR-104",
      phase: "PILOT",
      phaseInstanceId: "ph1",
      reopenCount: 2,
      at: "2026-09-29T12:00:00.000Z",
    });
  });

  it("não vaza o ator para o evento (o contrato só leva fatos e ids)", async () => {
    await emitGateReopened(EVENT);

    expect(JSON.stringify(h.emit.mock.calls[0][1])).not.toContain("actorId");
  });
});
