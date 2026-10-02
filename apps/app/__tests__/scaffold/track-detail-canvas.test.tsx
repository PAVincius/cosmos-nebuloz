import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A entrada do canvas no detalhe da trilha: botão no cabeçalho, aberto para
// qualquer papel (o canvas só lê — não há permissão a negar), que abre o diálogo
// e devolve a fase pedida ao detalhe.

const h = vi.hoisted(() => ({
  getTrack: vi.fn(),
  listDeliverables: vi.fn(),
  getAccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(scaffold)/actions/tracks", () => ({
  getTrack: h.getTrack,
  cancelTrack: vi.fn(),
}));
vi.mock("@/app/(scaffold)/actions/access", () => ({
  getScaffoldAccess: h.getAccess,
}));
vi.mock("@/app/(scaffold)/actions/gates", () => ({
  acknowledgeCharterPolicy: vi.fn(),
  closePhase: vi.fn(),
  overridePhase: vi.fn(),
  reopenPhase: vi.fn(),
}));
vi.mock("@/app/(scaffold)/actions/steps", () => ({
  setStepState: vi.fn(),
  attachArtefact: vi.fn(),
  readArtefact: vi.fn(),
}));
vi.mock("@/app/(scaffold)/actions/export", () => ({
  exportHandoverPack: vi.fn(),
}));
vi.mock("@/app/(scaffold)/actions/deliverables", () => ({
  listDeliverables: h.listDeliverables,
  listDeliverableAssignees: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  startDeliverable: vi.fn(),
  submitDeliverable: vi.fn(),
  approveDeliverable: vi.fn(),
  requestDeliverableAdjustment: vi.fn(),
  reopenDeliverable: vi.fn(),
  attachDeliverableVersion: vi.fn(),
  readDeliverableFile: vi.fn(),
  addDeliverableLink: vi.fn(),
  removeDeliverableLink: vi.fn(),
  addDeliverable: vi.fn(),
  assignDeliverable: vi.fn(),
}));

import TrackDetailScreen from "@/components/scaffold/screens/track-detail";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});

const phase = (p: string, state: string) => ({
  id: `pi-${p}`,
  phase: p,
  state,
  openedAt: null,
  closedAt: null,
  observationEndsAt: null,
  reopenCount: 0,
  reopenCountAtClose: null,
  charterPolicyAckAt: null,
  charterPolicy: null,
  charterAvailable: [],
  steps: [],
  criteria: [],
  result: null,
});

const TRACK = {
  id: "trk1",
  code: "TR-104",
  processName: "Triagem",
  status: "ACTIVE",
  currentPhase: "ASSESS",
  startedAt: new Date("2026-09-01"),
  templateLabel: "v3",
  templateName: "Triagem de suporte",
  ownerId: "o1",
  ownerName: "Marina",
  consultantName: null,
  sourceGap: null,
  businessCase: null,
  phases: [phase("ASSESS", "OPEN"), phase("PILOT", "IDLE")],
};

const ALL = new Proxy({}, { get: () => ({ allowed: true, reason: null }) });

beforeEach(() => {
  h.getTrack.mockResolvedValue({ ok: true, data: TRACK });
  h.listDeliverables.mockResolvedValue({ ok: true, data: [] });
});

describe("Abrir no canvas", () => {
  it("é ação do cabeçalho e fica habilitada mesmo sem nenhuma permissão de escrita", async () => {
    h.getAccess.mockResolvedValue({
      ok: true,
      data: {
        role: "TEAM_MEMBER",
        can: new Proxy(
          {},
          { get: () => ({ allowed: false, reason: "sem papel" }) }
        ),
      },
    });
    render(<TrackDetailScreen param="trk1" />);
    const btn = await screen.findByRole("button", { name: /abrir no canvas/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("abre o diálogo, Esc fecha e o foco volta ao botão", async () => {
    h.getAccess.mockResolvedValue({
      ok: true,
      data: { role: "CONSULTANT", can: ALL },
    });
    render(<TrackDetailScreen param="trk1" />);
    const btn = await screen.findByRole("button", { name: /abrir no canvas/i });
    btn.focus();
    fireEvent.click(btn);
    const dlg = await screen.findByRole("dialog", {
      name: /Canvas da trilha TR-104/,
    });
    fireEvent.keyDown(dlg, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(btn);
  });

  it("'Abrir Pilot na trilha' fecha o canvas e leva o detalhe para essa fase", async () => {
    h.getAccess.mockResolvedValue({
      ok: true,
      data: { role: "CONSULTANT", can: ALL },
    });
    render(<TrackDetailScreen param="trk1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /abrir no canvas/i })
    );
    await screen.findByRole("dialog");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Pilot.*Não iniciada/,
      })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Abrir Pilot na trilha/ })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(/Entregáveis — Pilot/)).toBeTruthy();
  });
});
