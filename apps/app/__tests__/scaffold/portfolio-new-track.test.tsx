import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// S-01 na tela. `createTrackFromGap` tinha zero chamadores: o Meridian dizia
// "Promovido para o SCAFFOLD" e nenhuma trilha nascia. O portfólio agora lista
// a promoção pendente e o modal a transforma em trilha, carregando o id da
// promoção — é ele que preenche `targetEntityId` do outro lado.

const h = vi.hoisted(() => ({
  listTracks: vi.fn(),
  listTemplates: vi.fn(),
  createTrackFromGap: vi.fn(),
  createTrack: vi.fn(),
  push: vi.fn(),
  getAccess: vi.fn(),
  listScaffoldGaps: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(scaffold)/actions/tracks", () => ({
  listTracks: h.listTracks,
  createTrackFromGap: h.createTrackFromGap,
  createTrack: h.createTrack,
}));
vi.mock("@/app/(scaffold)/actions/access", () => ({
  getScaffoldAccess: h.getAccess,
}));
vi.mock("@/app/(scaffold)/actions/gaps", () => ({
  listScaffoldGaps: h.listScaffoldGaps,
}));
vi.mock("@/app/(scaffold)/actions/templates", () => ({
  listTemplates: h.listTemplates,
}));

import PortfolioScreen from "@/components/scaffold/screens/portfolio";

const PROMOTION = {
  id: "clx00000000000000000prom1",
  gapId: "clx000000000000000000gap1",
  gapCode: "G-07",
  statement: "Triagem de autorizações: 40% das guias voltam por dado faltante",
  promotedAt: new Date("2026-09-10"),
};

const SUMMARY = {
  tracks: [],
  pendingPromotions: [PROMOTION],
  members: [
    { id: "clx0000000000000000owner1", name: "Marina", role: "PROCESS_OWNER" },
    { id: "clx000000000000000000cons1", name: "Rui", role: "CONSULTANT" },
  ],
  embeddedCount: 0,
  stalledCount: 0,
  gateReadyCount: 0,
  signedBaselineCount: 0,
  orgCount: 0,
  stallThresholdDays: 14,
  overrideRates: [],
};

const ACCESS = (allowed: boolean) => ({
  ok: true,
  data: {
    role: allowed ? "CONSULTANT" : "SPONSOR",
    can: {
      "track.manage": allowed
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "Requer papel Consultor — criar trilhas" },
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.getAccess.mockResolvedValue(ACCESS(true));
  h.listScaffoldGaps.mockResolvedValue({ ok: true, data: [] });
  h.listTracks.mockResolvedValue({ ok: true, data: SUMMARY });
  h.listTemplates.mockResolvedValue({
    ok: true,
    data: [
      {
        id: "clx0000000000000000templ1",
        key: "triage",
        name: "Triagem de suporte",
        archetype: "TRIAGE",
        currentLabel: "v4",
        publishedAt: new Date(),
        versions: [],
        overlays: [],
      },
      {
        id: "clx0000000000000000templ2",
        key: "draft",
        name: "Sem versão publicada",
        archetype: "REPORTING",
        currentLabel: null,
        publishedAt: null,
        versions: [],
        overlays: [],
      },
    ],
  });
  h.createTrackFromGap.mockResolvedValue({
    ok: true,
    data: { trackId: "trk-new", code: "TR-105" },
  });
  h.createTrack.mockResolvedValue({
    ok: true,
    data: { trackId: "trk-manual", code: "TR-106" },
  });
});

describe("portfólio — promoção pendente vira trilha", () => {
  it("lista a promoção e cria a trilha carregando gapId e promotionId", async () => {
    render(<PortfolioScreen />);
    expect(await screen.findByText("G-07")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /criar trilha/i }));
    // Nome vem da lacuna, até os dois-pontos.
    const name = (await screen.findByLabelText(
      /^processo/i
    )) as HTMLInputElement;
    expect(name.value).toBe("Triagem de autorizações");

    await waitFor(() =>
      expect(screen.getByLabelText(/^template/i)).toHaveProperty(
        "value",
        "clx0000000000000000templ1"
      )
    );
    // Template sem versão publicada não é opção — ST-01.
    expect(screen.queryByText(/sem versão publicada/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/dono do processo/i), {
      target: { value: "clx0000000000000000owner1" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /criar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.createTrackFromGap).toHaveBeenCalledTimes(1));
    expect(h.createTrackFromGap.mock.calls[0][0]).toMatchObject({
      gapId: PROMOTION.gapId,
      promotionId: PROMOTION.id,
      templateId: "clx0000000000000000templ1",
      processName: "Triagem de autorizações",
      ownerId: "clx0000000000000000owner1",
    });
    expect(h.createTrack).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith("/scaffold/track/trk-new")
    );
  });

  it("Nova trilha sem lacuna usa createTrack e não manda promoção", async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );

    const name = await screen.findByLabelText(/^processo/i);
    fireEvent.change(name, { target: { value: "Fechamento contábil" } });
    await waitFor(() =>
      expect(screen.getByLabelText(/^template/i)).toHaveProperty(
        "value",
        "clx0000000000000000templ1"
      )
    );
    fireEvent.change(screen.getByLabelText(/dono do processo/i), {
      target: { value: "clx0000000000000000owner1" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /criar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.createTrack).toHaveBeenCalledTimes(1));
    expect(h.createTrack.mock.calls[0][0]).not.toHaveProperty("promotionId");
    expect(h.createTrackFromGap).not.toHaveBeenCalled();
  });

  it("sem dono, o botão fica desabilitado", async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
    await screen.findByLabelText(/^processo/i);
    const submit = screen
      .getAllByRole("button", { name: /criar trilha/i })
      .at(-1) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

// Crivo F2: papel só-leitura via "Nova trilha" habilitado.
describe("portfólio — papel só-leitura", () => {
  it("Nova trilha e Criar trilha ficam desabilitados, com o motivo", async () => {
    h.getAccess.mockResolvedValue(ACCESS(false));
    render(<PortfolioScreen />);
    await screen.findByText("G-07");

    for (const name of [/nova trilha/i, /criar trilha/i]) {
      const button = screen.getByRole("button", { name });
      await waitFor(() => expect(button).toHaveProperty("disabled", true));
      expect(button.getAttribute("title")).toMatch(/Requer papel/);
    }
    fireEvent.click(screen.getByRole("button", { name: /nova trilha/i }));
    expect(screen.queryByLabelText(/^processo/i)).toBeNull();
  });

  it("quem pode abre o modal", async () => {
    render(<PortfolioScreen />);
    const nova = await screen.findByRole("button", { name: /nova trilha/i });
    await waitFor(() => expect(nova).toHaveProperty("disabled", false));
    fireEvent.click(nova);
    expect(await screen.findByLabelText(/^processo/i)).toBeDefined();
  });
});

describe("modal — quem pode ser dono do processo (Crivo F3)", () => {
  it("lista só quem tem papel de dono do processo", async () => {
    h.listTracks.mockResolvedValue({
      ok: true,
      data: {
        ...SUMMARY,
        members: [
          {
            id: "clx0000000000000000owner1",
            name: "Marina",
            role: "PROCESS_OWNER",
          },
          { id: "clx000000000000000000cons1", name: "Rui", role: "CONSULTANT" },
          { id: "clx00000000000000000spon1", name: "Sofia", role: "SPONSOR" },
          { id: "clx0000000000000000tlead1", name: "Tiago", role: "TEAM_LEAD" },
          { id: "clx0000000000000000tmemb1", name: "Ana", role: "TEAM_MEMBER" },
        ],
      },
    });
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
    const owner = (await screen.findByLabelText(
      /dono do processo/i
    )) as HTMLSelectElement;
    const names = [...owner.options].map((o) => o.textContent ?? "");
    expect(names.some((n) => n.includes("Marina"))).toBe(true);
    for (const out of ["Rui", "Sofia", "Tiago", "Ana"]) {
      expect(names.some((n) => n.includes(out))).toBe(false);
    }
  });

  it("o consultor continua saindo só de quem é consultor", async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
    const cons = (await screen.findByLabelText(
      /consultor nebuloz/i
    )) as HTMLSelectElement;
    const names = [...cons.options].map((o) => o.textContent ?? "");
    expect(names.some((n) => n.includes("Rui"))).toBe(true);
    expect(names.some((n) => n.includes("Marina"))).toBe(false);
  });

  it("sem nenhum dono cadastrado, diz onde resolver em vez de deixar o seletor vazio", async () => {
    h.listTracks.mockResolvedValue({
      ok: true,
      data: {
        ...SUMMARY,
        members: [
          { id: "clx000000000000000000cons1", name: "Rui", role: "CONSULTANT" },
        ],
      },
    });
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
    expect(await screen.findByText(/papéis de adoção/i)).toBeDefined();
  });
});

describe("as cinco formas na tela (Crivo F4)", () => {
  const TEMPLATES = [
    ["templ1", "triage", "Triagem de suporte", "TRIAGE"],
    ["templ2", "conversational", "Assistente conversacional", "CONVERSATIONAL"],
    ["templ3", "analysis", "Análise e priorização", "ANALYSIS"],
    ["templ4", "docreview", "Revisão de documentos", "DOC_REVIEW"],
    ["templ5", "reporting", "Relatórios", "REPORTING"],
  ].map(([id, key, name, archetype]) => ({
    id: `clx00000000000000000${id}`,
    key,
    name,
    archetype,
    currentLabel: "v1",
    publishedAt: new Date(),
    versions: [],
    overlays: [],
  }));

  it("o seletor de template mostra o rótulo, nunca o código cru", async () => {
    h.listTemplates.mockResolvedValue({ ok: true, data: TEMPLATES });
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
    const select = (await screen.findByLabelText(
      /^template/i
    )) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(5));
    const labels = [...select.options].map((o) => o.textContent ?? "");
    for (const raw of [
      "ANALYSIS",
      "CONVERSATIONAL",
      "DOC_REVIEW",
      "TRIAGE",
      "REPORTING",
    ]) {
      expect(labels.some((l) => l.includes(raw))).toBe(false);
    }
    expect(
      labels.some((l) =>
        l.includes("Análise e priorização · Análise e priorização")
      )
    ).toBe(true);
    expect(labels.some((l) => l.includes("Assistente conversacional"))).toBe(
      true
    );
  });

  it("o filtro do portfólio tem um chip por forma", async () => {
    render(<PortfolioScreen />);
    await screen.findByText("G-07");
    for (const label of [
      "Assistente conversacional",
      "Análise e priorização",
      "Revisão de documentos",
      "Triagem de demanda",
      "Relatórios recorrentes",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("trilha de análise mostra a forma, e não fica em branco", async () => {
    h.listTracks.mockResolvedValue({
      ok: true,
      data: {
        ...SUMMARY,
        orgCount: 1,
        tracks: [
          {
            id: "trk1",
            code: "TR-114",
            processName: "Glosas hospitalares",
            archetype: "ANALYSIS",
            currentPhase: "ASSESS",
            phaseState: "OPEN",
            status: "ACTIVE",
            ownerId: "clx0000000000000000owner1",
            ownerName: "Marina",
            consultantId: null,
            templateLabel: "v1",
            sourceGapId: null,
            startedAt: new Date("2026-09-01"),
            lastGateAt: null,
            lastGateLabel: null,
            stalledDays: 0,
            deliverables: { approved: 0, required: 0 },
          },
        ],
      },
    });
    render(<PortfolioScreen />);
    await screen.findByText("Glosas hospitalares");
    expect(screen.getAllByText(/Análise e priorização/).length).toBeGreaterThan(
      0
    );
  });
});

// PDF p.3 "Gaps reais do Meridian": a Nova trilha lista os gaps ranqueados e
// escolher um cria a trilha por createTrackFromGap.
describe("Nova trilha a partir dos gaps do Meridian", () => {
  const RANKED = (over: Record<string, unknown>) => ({
    rank: 1,
    id: "clx000000000000000000gapA1",
    code: "G-01",
    statement:
      "Triagem de autorizações: 40% das guias voltam por dado faltante",
    axis: "PROCESS",
    severity: "HIGH",
    effort: "S",
    costOfDelay: 80,
    confidence: "MEASURED",
    state: "OPEN",
    assessmentId: "a1",
    assessmentCode: "AS-1",
    promotion: {
      id: "clx0000000000000000promA1",
      product: "SCAFFOLD",
      landed: false,
    },
    ...over,
  });

  const GAPS = [
    RANKED({}),
    RANKED({
      rank: 2,
      id: "clx000000000000000000gapB2",
      code: "G-02",
      statement: "Glosas hospitalares sem priorização",
      severity: "MEDIUM",
      promotion: null,
    }),
    RANKED({
      rank: 3,
      id: "clx000000000000000000gapC3",
      code: "G-03",
      statement: "Relatório regulatório manual",
      promotion: {
        id: "clx0000000000000000promC3",
        product: "SCAFFOLD",
        landed: true,
      },
    }),
    RANKED({
      rank: 4,
      id: "clx000000000000000000gapD4",
      code: "G-04",
      statement: "Atendimento ao beneficiário",
      promotion: {
        id: "clx0000000000000000promD4",
        product: "COSMOS",
        landed: false,
      },
    }),
  ];

  const openModal = async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
  };

  it("lista os gaps na ordem do ranking, com o vocabulário do Meridian", async () => {
    h.listScaffoldGaps.mockResolvedValue({ ok: true, data: GAPS });
    await openModal();

    await screen.findByText("G-01");
    // O G-07 é a promoção pendente do portfólio, atrás do modal: fora da conta.
    const list = screen.getByRole("region", {
      name: /gaps reais do meridian/i,
    });
    const codes = [...list.querySelectorAll(".mono")]
      .map((n) => n.textContent ?? "")
      .filter((t) => /^G-\d+$/.test(t));
    expect(codes).toEqual(["G-01", "G-02", "G-03", "G-04"]);
    expect(screen.getByText(/gaps reais do meridian/i)).toBeDefined();
    expect(screen.getAllByText(/Gravidade alta/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Confiança medida/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Custo de atraso 80/).length).toBeGreaterThan(0);
  });

  it("só o gap promovido e sem trilha pode ser usado; os outros dizem por quê", async () => {
    h.listScaffoldGaps.mockResolvedValue({ ok: true, data: GAPS });
    await openModal();
    await screen.findByText("G-01");

    expect(
      screen.getAllByRole("button", { name: /usar este gap/i })
    ).toHaveLength(1);
    expect(screen.getByText(/ainda não promovido/i)).toBeDefined();
    expect(screen.getByText(/já tem trilha/i)).toBeDefined();
    expect(screen.getByText(/outro produto/i)).toBeDefined();
  });

  it("escolher o gap preenche o processo e cria a trilha com gapId e promotionId", async () => {
    h.listScaffoldGaps.mockResolvedValue({ ok: true, data: GAPS });
    await openModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /usar este gap/i })
    );

    const name = (await screen.findByLabelText(
      /^processo/i
    )) as HTMLInputElement;
    expect(name.value).toBe("Triagem de autorizações");
    expect(screen.getByText(/nasce do gap G-01/i)).toBeDefined();

    await waitFor(() =>
      expect(screen.getByLabelText(/^template/i)).toHaveProperty(
        "value",
        "clx0000000000000000templ1"
      )
    );
    fireEvent.change(screen.getByLabelText(/dono do processo/i), {
      target: { value: "clx0000000000000000owner1" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /criar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.createTrackFromGap).toHaveBeenCalledTimes(1));
    expect(h.createTrackFromGap.mock.calls[0][0]).toMatchObject({
      gapId: "clx000000000000000000gapA1",
      promotionId: "clx0000000000000000promA1",
      processName: "Triagem de autorizações",
    });
    expect(h.createTrack).not.toHaveBeenCalled();
  });

  it("dá para desistir do gap e criar sem lacuna", async () => {
    h.listScaffoldGaps.mockResolvedValue({ ok: true, data: GAPS });
    await openModal();
    fireEvent.click(
      await screen.findByRole("button", { name: /usar este gap/i })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /tirar o gap/i })
    );
    expect(screen.queryByText(/nasce do gap/i)).toBeNull();
    expect(
      (screen.getByLabelText(/^processo/i) as HTMLInputElement).value
    ).toBe("");
  });

  it("Meridian indisponível: avisa e a criação sem lacuna continua", async () => {
    h.listScaffoldGaps.mockResolvedValue({
      ok: false,
      error: "Módulo MERIDIAN não contratado por esta organização.",
    });
    await openModal();
    expect(
      await screen.findByText(/gaps do meridian indisponíveis/i)
    ).toBeDefined();
    expect(screen.getByLabelText(/^processo/i)).toBeDefined();
  });

  it("sem gap finalizado: diz isso, sem lista vazia", async () => {
    h.listScaffoldGaps.mockResolvedValue({ ok: true, data: [] });
    await openModal();
    expect(await screen.findByText(/nenhum gap finalizado/i)).toBeDefined();
  });

  it("a promoção pendente do portfólio segue direta: não consulta a lista de gaps", async () => {
    render(<PortfolioScreen />);
    await screen.findByText("G-07");
    fireEvent.click(screen.getByRole("button", { name: /criar trilha/i }));
    await screen.findByLabelText(/^processo/i);
    expect(h.listScaffoldGaps).not.toHaveBeenCalled();
  });
});

describe("portfólio — sub-linha de entregáveis e atalho (PDF p.3)", () => {
  const ROW = (over: Record<string, unknown> = {}) => ({
    id: "trk1",
    code: "TR-114",
    processName: "Glosas hospitalares",
    archetype: "ANALYSIS",
    currentPhase: "ASSESS",
    phaseState: "OPEN",
    status: "ACTIVE",
    ownerId: "clx0000000000000000owner1",
    ownerName: "Marina",
    consultantId: null,
    templateLabel: "v1",
    sourceGapId: null,
    startedAt: new Date("2026-09-01"),
    lastGateAt: null,
    lastGateLabel: null,
    stalledDays: 0,
    deliverables: { approved: 3, required: 16 },
    ...over,
  });
  const withRows = (rows: unknown[]) =>
    h.listTracks.mockResolvedValue({
      ok: true,
      data: { ...SUMMARY, orgCount: rows.length, tracks: rows },
    });

  it("mostra 'forma · X/Y entregáveis' na linha da trilha", async () => {
    withRows([ROW()]);
    render(<PortfolioScreen />);
    await screen.findByText("Glosas hospitalares");
    // A forma também é chip de filtro: a sub-linha é o que traz a fração.
    const sub = screen.getByText(/3\/16 entregáveis/);
    expect(sub.textContent).toMatch(
      /Análise e priorização · v1 · 3\/16 entregáveis/
    );
  });

  it("trilha anterior ao modelo de entregáveis não mostra fração", async () => {
    withRows([ROW({ deliverables: { approved: 0, required: 0 } })]);
    render(<PortfolioScreen />);
    await screen.findByText("Glosas hospitalares");
    expect(screen.queryByText(/entregáveis$/)).toBeNull();
    expect(screen.queryByText(/0\/0/)).toBeNull();
  });

  it("'Trilhas disponíveis' leva ao catálogo, com o nome antigo aposentado", async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /trilhas disponíveis/i })
    );
    expect(h.push).toHaveBeenCalledWith("/scaffold/templates");
    expect(screen.queryByRole("button", { name: /^templates$/i })).toBeNull();
  });
});
