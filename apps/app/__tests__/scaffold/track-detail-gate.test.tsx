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
  cancelTrack: vi.fn(),
  closePhase: vi.fn(),
  overridePhase: vi.fn(),
  reopenPhase: vi.fn(),
  attachArtefact: vi.fn(),
  readArtefact: vi.fn(),
  push: vi.fn(),
  listDeliverables: vi.fn(),
  startDeliverable: vi.fn(),
  approveDeliverable: vi.fn(),
  requestAdjustment: vi.fn(),
  attachVersion: vi.fn(),
  readFile: vi.fn(),
  getAccess: vi.fn(),
  setStepState: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(scaffold)/actions/tracks", () => ({
  getTrack: h.getTrack,
  cancelTrack: h.cancelTrack,
}));
vi.mock("@/app/(scaffold)/actions/gates", () => ({
  acknowledgeCharterPolicy: vi.fn(),
  closePhase: h.closePhase,
  overridePhase: h.overridePhase,
  reopenPhase: h.reopenPhase,
}));
vi.mock("@/app/(scaffold)/actions/access", () => ({
  getScaffoldAccess: h.getAccess,
}));
vi.mock("@/app/(scaffold)/actions/steps", () => ({
  setStepState: h.setStepState,
  attachArtefact: h.attachArtefact,
  readArtefact: h.readArtefact,
}));
vi.mock("@/app/(scaffold)/actions/deliverables", () => ({
  listDeliverables: h.listDeliverables,
  startDeliverable: h.startDeliverable,
  submitDeliverable: vi.fn(),
  approveDeliverable: h.approveDeliverable,
  requestDeliverableAdjustment: h.requestAdjustment,
  reopenDeliverable: vi.fn(),
  attachDeliverableVersion: h.attachVersion,
  readDeliverableFile: h.readFile,
}));
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

const PERMISSIONS = [
  "track.manage",
  "step.complete",
  "artefact.read",
  "gate.close",
  "gate.override",
  "businesscase.write",
  "businesscase.sign",
  "template.publish",
  "membership.manage",
  "portfolio.read",
  "deliverable.read",
  "deliverable.work",
  "deliverable.review",
  "deliverable.reopen",
  "deliverable.add",
];

/** Acesso de quem pode tudo, menos o que está em `denied`. */
function accessWithout(denied: string[] = []) {
  return {
    ok: true,
    data: {
      role: "CONSULTANT",
      can: Object.fromEntries(
        PERMISSIONS.map((p) => [
          p,
          denied.includes(p)
            ? { allowed: false, reason: `Requer papel Consultor — ${p}` }
            : { allowed: true, reason: null },
        ])
      ),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getAccess.mockResolvedValue(accessWithout());
  h.setStepState.mockResolvedValue({ ok: true, data: undefined });
  h.closePhase.mockResolvedValue({ ok: true, data: { gateResultId: "gr1" } });
  h.overridePhase.mockResolvedValue({
    ok: true,
    data: { gateResultId: "gr2" },
  });
  h.reopenPhase.mockResolvedValue({ ok: true, data: undefined });
  // Trilha legada: sem entregável, a tela segue só os passos.
  h.listDeliverables.mockResolvedValue({ ok: true, data: [] });
});

describe("GatePanel — fechar", () => {
  it("manda os critérios marcados e o dono do processo como aprovador", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("GATE_READY") });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(await screen.findByLabelText("Piloto vence o baseline"));
    fireEvent.click(screen.getByLabelText("Nenhum risco novo"));
    fireEvent.click(screen.getByRole("button", { name: /revisar e assinar/i }));

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
    expect(
      screen.queryByRole("button", { name: /revisar e assinar/i })
    ).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: /revisar e assinar/i }));

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

describe("cancelar trilha", () => {
  it("com caso assinado, manda a decisão do Signal junto da justificativa", async () => {
    h.getTrack.mockResolvedValue({
      ok: true,
      data: {
        ...trackWith("OPEN"),
        businessCase: {
          id: "bc1",
          code: "BC-104",
          state: "SIGNED",
          signed: true,
        },
      },
    });
    h.cancelTrack.mockResolvedValue({ ok: true, data: undefined });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /cancelar trilha/i })
    );
    fireEvent.change(screen.getByLabelText(/apuração do signal/i), {
      target: { value: "keep_reading" },
    });
    fireEvent.change(screen.getByLabelText(/justificativa/i), {
      target: { value: "O processo foi absorvido por outra área em setembro." },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /cancelar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.cancelTrack).toHaveBeenCalledTimes(1));
    expect(h.cancelTrack.mock.calls[0][0]).toMatchObject({
      trackId: "trk1",
      signalDecision: "keep_reading",
    });
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith("/scaffold/portfolio")
    );
  });

  it("sem caso assinado, não pergunta pelo Signal nem manda decisão", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    h.cancelTrack.mockResolvedValue({ ok: true, data: undefined });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /cancelar trilha/i })
    );
    expect(screen.queryByLabelText(/apuração do signal/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/justificativa/i), {
      target: { value: "O processo foi absorvido por outra área em setembro." },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /cancelar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.cancelTrack).toHaveBeenCalledTimes(1));
    expect(h.cancelTrack.mock.calls[0][0].signalDecision).toBeUndefined();
  });
});

describe("artefato do passo", () => {
  it("anexar pede a URL assinada e faz o PUT direto no storage", async () => {
    const withStep = trackWith("OPEN");
    withStep.phases[0].steps = [
      {
        id: "step-1",
        seq: 1,
        statement: "Medir o baseline",
        expectedArtefact: "planilha.xlsx",
        required: true,
        state: "TODO",
        note: null,
        completedAt: null,
        artefacts: [],
      },
    ] as never;
    h.getTrack.mockResolvedValue({ ok: true, data: withStep });
    h.attachArtefact.mockResolvedValue({
      ok: true,
      data: {
        uploadUrl: "https://storage.test/signed-put",
        artefactId: "art-1",
        objectKey: "k",
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    render(<TrackDetailScreen param="trk1" />);

    const input = (await screen.findByLabelText(
      /anexar artefato: medir o baseline/i
    )) as HTMLInputElement;
    const file = new File(["abc"], "baseline.xlsx", {
      type: "application/vnd.ms-excel",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(h.attachArtefact).toHaveBeenCalledTimes(1));
    expect(h.attachArtefact.mock.calls[0][0]).toEqual({
      stepInstanceId: "step-1",
      filename: "baseline.xlsx",
      contentType: "application/vnd.ms-excel",
      sizeBytes: 3,
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls[0][0]).toBe("https://storage.test/signed-put");
    expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe("PUT");
    fetchSpy.mockRestore();
  });

  it("abrir artefato pede a URL de leitura e abre em aba nova", async () => {
    const withArt = trackWith("OPEN");
    withArt.phases[0].steps = [
      {
        id: "step-1",
        seq: 1,
        statement: "Medir o baseline",
        expectedArtefact: "planilha.xlsx",
        required: true,
        state: "DONE",
        note: null,
        completedAt: new Date(),
        artefacts: [{ id: "art-1", filename: "baseline.xlsx", sizeBytes: 3 }],
      },
    ] as never;
    h.getTrack.mockResolvedValue({ ok: true, data: withArt });
    h.readArtefact.mockResolvedValue({
      ok: true,
      data: { url: "https://storage.test/signed-get", expiresIn: 60 },
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "baseline.xlsx" })
    );
    await waitFor(() => expect(h.readArtefact).toHaveBeenCalledTimes(1));
    expect(h.readArtefact.mock.calls[0][0]).toEqual({ artefactId: "art-1" });
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://storage.test/signed-get",
        "_blank",
        "noopener,noreferrer"
      )
    );
    openSpy.mockRestore();
  });
});

// Entregáveis — SG-01 / SC-DEV-03. O servidor decide; a tela só mostra o motivo.
const NO = { allowed: false, reason: "Seu papel não revisa entregável." };
const YES = { allowed: true, reason: null };

function deliverable(status: string, over: Record<string, unknown> = {}) {
  return {
    id: "del-1",
    phaseInstanceId: PHASE_ID,
    code: "B1.2",
    title: "Configuração do piloto",
    status,
    required: true,
    dispensedReason: null,
    actions: {
      START: YES,
      SUBMIT: YES,
      APPROVE: YES,
      REQUEST_ADJUSTMENT: YES,
      REOPEN: YES,
    },
    attach: YES,
    hasFile: false,
    fileName: null,
    version: 0,
    ...over,
  };
}

describe("entregáveis na tela", () => {
  it("obrigatório pendente desabilita o gate e escreve o motivo", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("GATE_READY") });
    h.listDeliverables.mockResolvedValue({
      ok: true,
      data: [deliverable("IN_REVIEW")],
    });
    render(<TrackDetailScreen param="trk1" />);

    const close = await screen.findByRole("button", {
      name: /revisar e assinar/i,
    });
    await waitFor(() => expect(close).toHaveProperty("disabled", true));
    expect(
      screen.getByText("1 entregável obrigatório pendente: B1.2.")
    ).toBeDefined();
    fireEvent.click(close);
    expect(h.closePhase).not.toHaveBeenCalled();
  });

  it("tudo aprovado libera o gate", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("GATE_READY") });
    h.listDeliverables.mockResolvedValue({
      ok: true,
      data: [deliverable("APPROVED")],
    });
    render(<TrackDetailScreen param="trk1" />);
    const close = await screen.findByRole("button", {
      name: /revisar e assinar/i,
    });
    expect(close).toHaveProperty("disabled", false);
  });

  it("mostra o estado por extenso e dispara a ação permitida", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    h.listDeliverables.mockResolvedValue({
      ok: true,
      data: [deliverable("NOT_STARTED")],
    });
    h.startDeliverable.mockResolvedValue({ ok: true, data: undefined });
    render(<TrackDetailScreen param="trk1" />);

    expect(await screen.findByText("Não iniciado")).toBeDefined();
    expect(screen.getByText("Obrigatório")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /iniciar/i }));
    await waitFor(() =>
      expect(h.startDeliverable).toHaveBeenCalledWith({
        deliverableId: "del-1",
        comment: undefined,
      })
    );
  });

  it("ação sem permissão fica desabilitada com o motivo escrito", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    h.listDeliverables.mockResolvedValue({
      ok: true,
      data: [
        deliverable("IN_REVIEW", {
          actions: {
            START: NO,
            SUBMIT: NO,
            APPROVE: NO,
            REQUEST_ADJUSTMENT: NO,
            REOPEN: NO,
          },
        }),
      ],
    });
    render(<TrackDetailScreen param="trk1" />);

    const approve = await screen.findByRole("button", { name: /aprovar/i });
    expect(approve).toHaveProperty("disabled", true);
    expect(screen.getByText("Seu papel não revisa entregável.")).toBeDefined();
  });

  it("pedir ajuste exige comentário e o manda junto", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    h.listDeliverables.mockResolvedValue({
      ok: true,
      data: [deliverable("IN_REVIEW")],
    });
    h.requestAdjustment.mockResolvedValue({ ok: true, data: undefined });
    render(<TrackDetailScreen param="trk1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /pedir ajuste/i })
    );
    const send = screen
      .getAllByRole("button", { name: /pedir ajuste/i })
      .at(-1) as HTMLElement;
    expect(send).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(/o que precisa ser ajustado/i), {
      target: { value: "Falta o volume por canal." },
    });
    fireEvent.click(send);
    await waitFor(() =>
      expect(h.requestAdjustment).toHaveBeenCalledWith({
        deliverableId: "del-1",
        comment: "Falta o volume por canal.",
      })
    );
  });

  it("recusa do servidor aparece na lista, sem derrubar a tela", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    h.listDeliverables.mockResolvedValue({
      ok: true,
      data: [deliverable("IN_REVIEW")],
    });
    h.approveDeliverable.mockResolvedValue({
      ok: false,
      error: "Ninguém aprova nem pede ajuste no que é seu.",
      code: "FORBIDDEN",
    });
    render(<TrackDetailScreen param="trk1" />);
    fireEvent.click(await screen.findByRole("button", { name: /aprovar/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("no que é seu");
    expect(screen.getByText("Gate da fase")).toBeDefined();
  });
});

describe("arquivo do entregável", () => {
  const open = async (item: Record<string, unknown>) => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    h.listDeliverables.mockResolvedValue({ ok: true, data: [item] });
    render(<TrackDetailScreen param="trk1" />);
  };

  it("anexa: pede a URL assinada, faz o PUT direto no storage e recarrega", async () => {
    await open(deliverable("IN_PROGRESS"));
    h.attachVersion.mockResolvedValue({
      ok: true,
      data: {
        uploadUrl: "https://storage.test/put",
        version: 1,
        fileName: "plano.pdf",
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    const input = (await screen.findByLabelText(
      /anexar arquivo: B1\.2/i
    )) as HTMLInputElement;
    const file = new File(["abc"], "plano.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(h.attachVersion).toHaveBeenCalledTimes(1));
    expect(h.attachVersion.mock.calls[0]?.[0]).toEqual({
      deliverableId: "del-1",
      filename: "plano.pdf",
      contentType: "application/pdf",
      sizeBytes: 3,
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://storage.test/put");
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).method).toBe("PUT");
    fetchSpy.mockRestore();
  });

  it("PUT que falha avisa na lista, sem derrubar a tela", async () => {
    await open(deliverable("IN_PROGRESS"));
    h.attachVersion.mockResolvedValue({
      ok: true,
      data: {
        uploadUrl: "https://storage.test/put",
        version: 1,
        fileName: "a.pdf",
      },
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, status: 403 } as Response);
    const input = (await screen.findByLabelText(
      /anexar arquivo: B1\.2/i
    )) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["a"], "a.pdf", { type: "application/pdf" })],
      },
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/upload falhou/i);
    expect(screen.getByText("Gate da fase")).toBeDefined();
    fetchSpy.mockRestore();
  });

  it("mostra versão e nome do arquivo, e baixa pela URL auditada", async () => {
    await open(
      deliverable("IN_REVIEW", {
        hasFile: true,
        fileName: "plano.pdf",
        version: 2,
      })
    );
    h.readFile.mockResolvedValue({
      ok: true,
      data: {
        url: "https://storage.test/get",
        expiresIn: 300,
        fileName: "plano.pdf",
        version: 2,
      },
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    expect(await screen.findByText(/v2 · plano\.pdf/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /baixar plano\.pdf/i }));
    await waitFor(() =>
      expect(h.readFile).toHaveBeenCalledWith({ deliverableId: "del-1" })
    );
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        "https://storage.test/get",
        "_blank",
        "noopener,noreferrer"
      )
    );
    openSpy.mockRestore();
  });

  it("sem permissão para anexar, o controle fica desabilitado com o motivo", async () => {
    await open(
      deliverable("IN_PROGRESS", {
        attach: { allowed: false, reason: "Só o responsável anexa." },
      })
    );
    const input = (await screen.findByLabelText(
      /anexar arquivo: B1\.2/i
    )) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.getByText("Só o responsável anexa.")).toBeDefined();
  });

  it("estado que não admite anexo não mostra o controle", async () => {
    await open(deliverable("IN_REVIEW"));
    await screen.findByText("Em revisão");
    expect(screen.queryByLabelText(/anexar arquivo/i)).toBeNull();
  });

  it("enviar sem arquivo: o botão vem desabilitado com o motivo da máquina", async () => {
    await open(
      deliverable("IN_PROGRESS", {
        actions: {
          START: NO,
          SUBMIT: {
            allowed: false,
            reason:
              "Anexe o arquivo do entregável antes de enviar para revisão.",
          },
          APPROVE: NO,
          REQUEST_ADJUSTMENT: NO,
          REOPEN: NO,
        },
      })
    );
    const send = await screen.findByRole("button", {
      name: /enviar para revisão/i,
    });
    expect(send).toHaveProperty("disabled", true);
    expect(screen.getByText(/anexe o arquivo do entregável/i)).toBeDefined();
  });
});

describe("caso de negócio a partir da trilha", () => {
  it("leva ao caso, que é onde a promessa se escreve e se assina", async () => {
    h.getTrack.mockResolvedValue({
      ok: true,
      data: {
        ...trackWith("OPEN"),
        businessCase: {
          id: "bc1",
          code: "BC-104",
          state: "DRAFT",
          signed: false,
        },
      },
    });
    render(<TrackDetailScreen param="trk1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /caso de negócio BC-104/i })
    );
    expect(h.push).toHaveBeenCalledWith("/scaffold/baseline/bc1");
  });

  it("sem caso (trilha antiga), não oferece o atalho", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("OPEN") });
    render(<TrackDetailScreen param="trk1" />);
    await screen.findByText("Gate da fase");
    expect(
      screen.queryByRole("button", { name: /caso de negócio/i })
    ).toBeNull();
  });
});

// Crivo F2: papel só-leitura via controle habilitado e, ao clicar, a tela inteira
// virava "Não foi possível carregar".
describe("papel só-leitura na trilha", () => {
  const WITH_STEP = () => {
    const t = trackWith("OPEN");
    t.phases[0].steps = [
      {
        id: "step-1",
        seq: 1,
        statement: "Medir o baseline",
        expectedArtefact: "planilha.xlsx",
        required: true,
        state: "TODO",
        note: null,
        completedAt: null,
        artefacts: [],
      },
    ] as never;
    return t;
  };
  const READ_ONLY = ["track.manage", "step.complete", "gate.close"];

  it("passo, anexo e cancelar ficam desabilitados, com o motivo escrito", async () => {
    h.getAccess.mockResolvedValue(accessWithout(READ_ONLY));
    h.getTrack.mockResolvedValue({ ok: true, data: WITH_STEP() });
    render(<TrackDetailScreen param="trk1" />);

    const toggle = await screen.findByLabelText("Concluir: Medir o baseline");
    await waitFor(() => expect(toggle).toHaveProperty("disabled", true));
    expect(
      screen.getByRole("button", { name: /cancelar trilha/i })
    ).toHaveProperty("disabled", true);
    expect(screen.getByText(/somente leitura/i).textContent).toMatch(
      /Requer papel/
    );
    fireEvent.click(toggle);
    expect(h.setStepState).not.toHaveBeenCalled();
  });

  it("o gate também: sem gate.close, Revisar e assinar e Reabrir ficam desabilitados com motivo", async () => {
    h.getAccess.mockResolvedValue(
      accessWithout(["gate.close", "gate.override"])
    );
    h.getTrack.mockResolvedValue({ ok: true, data: trackWith("GATE_READY") });
    render(<TrackDetailScreen param="trk1" />);
    const close = await screen.findByRole("button", {
      name: /revisar e assinar/i,
    });
    await waitFor(() => expect(close).toHaveProperty("disabled", true));
    expect(
      screen.getByText(/Requer papel Consultor — gate\.close/)
    ).toBeDefined();
  });

  it("fase fechada: Reabrir fase desabilitado sem gate.close", async () => {
    h.getAccess.mockResolvedValue(accessWithout(["gate.close"]));
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
    const reopen = await screen.findByRole("button", { name: /reabrir fase/i });
    await waitFor(() => expect(reopen).toHaveProperty("disabled", true));
  });

  it("quem pode, continua podendo", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: WITH_STEP() });
    render(<TrackDetailScreen param="trk1" />);
    const toggle = await screen.findByLabelText("Concluir: Medir o baseline");
    await waitFor(() => expect(toggle).toHaveProperty("disabled", false));
    expect(screen.queryByText(/somente leitura/i)).toBeNull();
  });

  it("não sabe o acesso ainda: não oferece o controle enquanto carrega", async () => {
    h.getAccess.mockReturnValue(new Promise(() => {}));
    h.getTrack.mockResolvedValue({ ok: true, data: WITH_STEP() });
    render(<TrackDetailScreen param="trk1" />);
    const toggle = await screen.findByLabelText("Concluir: Medir o baseline");
    expect(toggle).toHaveProperty("disabled", true);
  });

  it("falha ao ler o acesso não trava a tela: o servidor segue decidindo", async () => {
    h.getAccess.mockResolvedValue({ ok: false, error: "boom" });
    h.getTrack.mockResolvedValue({ ok: true, data: WITH_STEP() });
    render(<TrackDetailScreen param="trk1" />);
    const toggle = await screen.findByLabelText("Concluir: Medir o baseline");
    await waitFor(() => expect(toggle).toHaveProperty("disabled", false));
  });

  it("recusa de ação aparece como aviso, sem derrubar a tela", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: WITH_STEP() });
    h.setStepState.mockResolvedValue({
      ok: false,
      error:
        "Requer papel Membro do time, Dono do processo ou Consultor — Concluir passo",
    });
    render(<TrackDetailScreen param="trk1" />);
    const toggle = await screen.findByLabelText("Concluir: Medir o baseline");
    await waitFor(() => expect(toggle).toHaveProperty("disabled", false));
    fireEvent.click(toggle);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Requer papel");
    // A trilha continua na tela; nada de "Não foi possível carregar".
    expect(screen.getByText("Gate da fase")).toBeDefined();
    expect(screen.queryByText(/não foi possível carregar/i)).toBeNull();
  });

  it("o aviso some ao dispensar", async () => {
    h.getTrack.mockResolvedValue({ ok: true, data: WITH_STEP() });
    h.setStepState.mockResolvedValue({ ok: false, error: "Sem permissão." });
    render(<TrackDetailScreen param="trk1" />);
    const toggle = await screen.findByLabelText("Concluir: Medir o baseline");
    await waitFor(() => expect(toggle).toHaveProperty("disabled", false));
    fireEvent.click(toggle);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: /dispensar/i }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falha ao CARREGAR a trilha continua sendo tela de erro, com tentar de novo", async () => {
    h.getTrack.mockResolvedValue({ ok: false, error: "Trilha não encontrada" });
    render(<TrackDetailScreen param="trk1" />);
    expect(await screen.findByText(/Trilha não encontrada/)).toBeDefined();
  });
});
