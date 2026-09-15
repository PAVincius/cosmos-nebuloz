import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O gate engine na tela. A suíte de actions prova que `closePhase` recusa
// pelo motivo certo; esta prova que existe um botão que chega até ela, e que a
// recusa volta para o painel em vez de derrubar a tela.
//
// Antes disto, `closePhase`, `overridePhase` e `reopenPhase` tinham zero
// chamadores fora de testes — o produto shipou com o gate inacionável.

const h = vi.hoisted(() => ({
  getTrack: vi.fn(),
  closePhase: vi.fn(),
  overridePhase: vi.fn(),
  reopenPhase: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(scaffold)/actions/tracks", () => ({ getTrack: h.getTrack }));
vi.mock("@/app/(scaffold)/actions/gates", () => ({
  acknowledgeCharterPolicy: vi.fn(),
  closePhase: h.closePhase,
  overridePhase: h.overridePhase,
  reopenPhase: h.reopenPhase,
}));
vi.mock("@/app/(scaffold)/actions/steps", () => ({ setStepState: vi.fn() }));
vi.mock("@/app/(scaffold)/actions/export", () => ({
  exportHandoverPack: vi.fn(),
}));

import TrackDetailScreen from "@/components/scaffold/screens/track-detail";

const PHASE_ID = "clx0000000000000000phase1";

function trackWith(state: string, result: unknown = null) {
  return {
    id: "trk1",
    code: "TR-104",
    processName: "Triagem",
    status: "ACTIVE",
    currentPhase: "PILOT",
    startedAt: new Date("2026-09-01"),
    templateLabel: "v3",
    templateName: "Triagem de suporte",
    ownerId: "owner-1",
    ownerName: "Marina",
    consultantName: null,
    sourceGap: null,
    businessCase: null,
    phases: [
      {
        id: PHASE_ID,
        phase: "PILOT",
        state,
        openedAt: new Date("2026-09-01"),
        closedAt: null,
        observationEndsAt: null,
        reopenCount: 0,
        reopenCountAtClose: null,
        charterPolicyAckAt: null,
        charterPolicy: null,
        charterAvailable: [],
        steps: [],
        criteria: [
          {
            key: "beats-baseline",
            statement: "Piloto vence o baseline",
            evaluationType: "MANUAL",
          },
          {
            key: "no-new-risk",
            statement: "Nenhum risco novo",
            evaluationType: "MANUAL",
          },
        ],
        result,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.closePhase.mockResolvedValue({ ok: true, data: { gateResultId: "gr1" } });
  h.overridePhase.mockResolvedValue({
    ok: true,
    data: { gateResultId: "gr2" },
  });
  h.reopenPhase.mockResolvedValue({ ok: true, data: undefined });
});

describe("GatePanel — fechar", () => {
  it("manda os critérios marcados e o dono do processo como aprovador", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("GATE_READY") });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(await screen.findByLabelText("Piloto vence o baseline"));
    fireEvent.click(screen.getByLabelText("Nenhum risco novo"));
    fireEvent.click(screen.getByRole("button", { name: /fechar gate/i }));

    await waitFor(() => expect(h.closePhase).toHaveBeenCalledTimes(1));
    expect(h.closePhase.mock.calls[0][0]).toEqual({
      phaseInstanceId: PHASE_ID,
      approverId: "owner-1",
      criteriaFacts: {
        "beats-baseline": { met: true },
        "no-new-risk": { met: true },
      },
    });
  });

  it("não oferece fechar em fase OPEN — os passos ainda não terminaram", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    render(<TrackDetailScreen param="trk1" />);
    await screen.findByText("Gate da fase");
    expect(screen.queryByRole("button", { name: /fechar gate/i })).toBeNull();
  });
});

describe("GatePanel — recusa SG-02 vira override", () => {
  it("mostra a recusa no painel, recarrega, e o override leva as chaves", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("GATE_READY") });
    h.closePhase.mockResolvedValueOnce({
      ok: false,
      error: "Há critério de gate não atendido.",
      code: "CRITERIA_UNMET",
      blockers: ["no-new-risk"],
    });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(await screen.findByLabelText("Piloto vence o baseline"));
    // Depois da recusa o servidor já moveu a fase para BLOCKED.
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("BLOCKED") });
    fireEvent.click(screen.getByRole("button", { name: /fechar gate/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Há critério de gate não atendido.");
    expect(alert.textContent).toContain("Nenhum risco novo");
    // A tela continua de pé — não virou ScreenError.
    expect(screen.getByText("Gate da fase")).toBeDefined();

    fireEvent.click(
      await screen.findByRole("button", { name: /registrar override/i })
    );
    const submit = screen.getByRole("button", {
      name: /registrar override e fechar/i,
    });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(/justificativa/i), {
      target: {
        value:
          "Risco coberto pelo rollback manual acordado com o dono do processo.",
      },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(h.overridePhase).toHaveBeenCalledTimes(1));
    expect(h.overridePhase.mock.calls[0][0]).toMatchObject({
      phaseInstanceId: PHASE_ID,
      unmetCriteria: ["no-new-risk"],
    });
  });
});

describe("GatePanel — reabrir", () => {
  it("fase fechada oferece reabrir e manda a justificativa", async () => {
    h.getTrack.mockResolvedValue({
      ok: true,
      data: trackWith("CLOSED", {
        outcome: "PASSED",
        decidedAt: new Date("2026-09-10"),
        cycle: 0,
        criteriaSnapshot: [],
        override: null,
      }),
    });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /reabrir fase/i })
    );
    fireEvent.change(screen.getByLabelText(/justificativa/i), {
      target: { value: "O piloto não sustentou o ganho no segundo mês." },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /reabrir fase/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.reopenPhase).toHaveBeenCalledTimes(1));
    expect(h.reopenPhase.mock.calls[0][0]).toMatchObject({
      phaseInstanceId: PHASE_ID,
    });
  });

  it("resultado antigo não vale como decisão depois de reaberta", async () => {
    // `result` é topo de pilha append-only: depois do REOPEN ele ainda existe,
    // mas a fase não está fechada. O painel não pode dizer "fechado".
    h.getTrack.mockResolvedValue({
      ok: true,
      data: trackWith("OPEN", {
        outcome: "PASSED",
        decidedAt: new Date("2026-09-10"),
        cycle: 0,
        criteriaSnapshot: [],
        override: null,
      }),
    });
    render(<TrackDetailScreen param="trk1" />);
    await screen.findByText("Gate da fase");
    expect(screen.queryByText(/^fechado/)).toBeNull();
  });
});
