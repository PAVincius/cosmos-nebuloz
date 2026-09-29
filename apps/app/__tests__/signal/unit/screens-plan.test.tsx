import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Plano de medição — telas (SG-DEV-04/06/07).
//
// O que estes testes protegem: a proposta que se declara fora do veredito, o
// papel sem permissão que vê o motivo em vez de um botão morto, a meta
// congelada que não aceita edição, e o comentário sem o qual não se pausa nem
// se pede revisão. Sem tela em branco enquanto carrega.

const h = vi.hoisted(() => ({
  listMeasureModels: vi.fn(),
  getInitiativePlan: vi.fn(),
  getPlanMetric: vi.fn(),
  pauseMetric: vi.fn(),
  requestTargetReview: vi.fn(),
  editMetric: vi.fn(),
  generatePlan: vi.fn(),
  classifyInitiative: vi.fn(),
  changePrimary: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/app/(signal)/actions/plan-read", () => ({
  listMeasureModels: h.listMeasureModels,
  getInitiativePlan: h.getInitiativePlan,
  getPlanMetric: h.getPlanMetric,
}));
vi.mock("@/app/(signal)/actions/plan", () => ({
  approveMetric: vi.fn(),
  changePrimary: h.changePrimary,
  editMetric: h.editMetric,
  generatePlan: h.generatePlan,
  classifyInitiative: h.classifyInitiative,
  mapMetricSource: vi.fn(),
  pauseMetric: h.pauseMetric,
  proposeMetric: vi.fn(),
  requestTargetReview: h.requestTargetReview,
  resumeMetric: vi.fn(),
}));
vi.mock("@/components/signal/base", async () => {
  const primitives = await vi.importActual<
    typeof import("@/components/charter/base")
  >("../../../components/charter/base");
  const modal = await vi.importActual<
    typeof import("@/components/charter/modal")
  >("../../../components/charter/modal");
  const data = await vi.importActual<
    typeof import("@/components/charter/use-charter-data")
  >("../../../components/charter/use-charter-data");
  return {
    ...primitives,
    ModalShell: modal.ModalShell,
    useSignalData: data.useCharterData,
    useModal: () => ({ open: h.open, close: h.close }),
  };
});

import { MetricModal } from "@/components/signal/plan-modals";
import { PlanTab } from "@/components/signal/plan-tab";
import ModelsScreen from "@/components/signal/screens/models";

const row = (over: Record<string, unknown> = {}) => ({
  id: "pm_1",
  role: "PRIMARY",
  roleLabel: "Primária",
  name: "Mediana do tempo até o destino correto",
  formula: "mediana(tempo até destino)",
  direction: "DOWN",
  state: "MEASURING",
  stateLabel: "Medindo",
  stateTone: "green",
  source: { label: "Tempo · Jira", health: "HEALTHY", healthy: true },
  baseline: 42,
  current: 30,
  target: 25,
  ownerId: null,
  ownerName: null,
  version: 2,
  inVerdict: true,
  fromModel: true,
  ...over,
});

const plan = (over: Record<string, unknown> = {}) => ({
  initiativeCode: "IN-014",
  initiativeName: "Triagem assistida",
  metrics: [
    row(),
    row({
      id: "pm_2",
      role: "GUARD",
      roleLabel: "Guarda",
      name: "Urgentes rebaixados",
      state: "PROPOSED",
      stateLabel: "Proposta",
      stateTone: "amber",
      inVerdict: false,
      fromModel: false,
    }),
  ],
  model: {
    name: "Triagem",
    versionLabel: "v1",
    counterfactual: "holdout de 15% por ordem de chegada",
    sampleWindowWeeks: 4,
    traps: ["Holdout contaminado quando o atendente vê a sugestão."],
  },
  baselineOrigin: {
    scaffoldTrackId: "trk_1",
    baselineVersion: 1,
    signedAt: null,
  },
  decisionDenial: null,
  canMapSource: true,
  mapDenial: null,
  workForm: "TRIAGE",
  owners: [{ id: "u1", name: "Paula" }],
  mappings: [{ id: "mp_1", label: "MP-01 · Tempo", healthy: true }],
  ...over,
});

const model = (over: Record<string, unknown> = {}) => ({
  workForm: "TRIAGE",
  name: "Triagem",
  versionLabel: "v1",
  counterfactual: "holdout de 15% por ordem de chegada",
  sampleWindowWeeks: 4,
  sources: ["Fila de pedidos"],
  traps: ["Sazonalidade de pedidos dentro da janela."],
  note: null,
  metrics: [
    {
      role: "PRIMARY",
      roleLabel: "Primária",
      name: "Tempo até o destino correto",
      formula: "mediana do tempo até o destino correto",
      direction: "DOWN",
    },
  ],
  inUse: [{ code: "IN-014", name: "Triagem assistida" }],
  ...over,
});

const history = (metric: Record<string, unknown> = {}) => ({
  metric: { ...row(), fromModelName: "Triagem", ...metric },
  observations: [],
  events: [
    {
      id: "e1",
      action: "APPROVE",
      actor: "Paula",
      fromState: "PROPOSED",
      toState: "NO_SOURCE",
      version: 1,
      changes: [],
      comment: null,
      at: new Date("2026-09-29T12:00:00Z"),
    },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
  h.getInitiativePlan.mockResolvedValue({ ok: true, data: plan() });
  h.listMeasureModels.mockResolvedValue({ ok: true, data: [model()] });
  h.getPlanMetric.mockResolvedValue({ ok: true, data: history() });
});

describe("Modelos de medição", () => {
  it("mostra contrafactual, janela, métrica por papel e armadilhas", async () => {
    render(<ModelsScreen />);
    expect(
      await screen.findByText(/holdout de 15% por ordem de chegada/)
    ).toBeDefined();
    expect(
      screen.getByText(/janela mínima de amostra: 4 semanas/)
    ).toBeDefined();
    expect(screen.getByText("Tempo até o destino correto")).toBeDefined();
    expect(screen.getByText(/Sazonalidade de pedidos/)).toBeDefined();
    expect(screen.getByText(/Iniciativas em uso \(1\)/)).toBeDefined();
  });

  it("troca de modelo pela aba", async () => {
    h.listMeasureModels.mockResolvedValue({
      ok: true,
      data: [
        model(),
        model({
          workForm: "REPORTING",
          name: "Relatórios",
          counterfactual: "2 ciclos em paralelo com o processo antigo",
          inUse: [],
        }),
      ],
    });
    render(<ModelsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Relatórios/ }));
    expect(await screen.findByText(/2 ciclos em paralelo/)).toBeDefined();
  });

  it("mostra o erro em vez de tela em branco", async () => {
    h.listMeasureModels.mockResolvedValue({ ok: false, error: "Sem acesso" });
    render(<ModelsScreen />);
    expect(await screen.findByText(/Sem acesso/)).toBeDefined();
  });
});

describe("Aba Plano", () => {
  it("lista as métricas com papel, fonte, baseline, agora, meta e estado", async () => {
    render(<PlanTab code="IN-014" />);
    expect(
      await screen.findByText("Mediana do tempo até o destino correto")
    ).toBeDefined();
    expect(screen.getAllByText("Tempo · Jira").length).toBe(2);
    expect(screen.getAllByText("Medindo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("25").length).toBeGreaterThan(0);
  });

  it("proposta declara que está fora do veredito", async () => {
    render(<PlanTab code="IN-014" />);
    expect(
      await screen.findByText(/Fora do veredito até aprovar/)
    ).toBeDefined();
  });

  it("filtra por papel", async () => {
    render(<PlanTab code="IN-014" />);
    await screen.findByText("Urgentes rebaixados");
    fireEvent.click(screen.getByRole("button", { name: "Guarda" }));
    expect(
      screen.queryByText("Mediana do tempo até o destino correto")
    ).toBeNull();
    expect(screen.getByText("Urgentes rebaixados")).toBeDefined();
  });

  it("cards laterais: modelo aplicado, armadilhas e origem no Scaffold", async () => {
    render(<PlanTab code="IN-014" />);
    expect(await screen.findByText("Modelo aplicado")).toBeDefined();
    expect(screen.getByText(/Holdout contaminado/)).toBeDefined();
    expect(screen.getByText(/Baseline v1 assinada/)).toBeDefined();
  });

  it("abre o modal da métrica ao clicar na linha", async () => {
    render(<PlanTab code="IN-014" />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Mediana do tempo até o destino correto/,
      })
    );
    expect(h.open).toHaveBeenCalledTimes(1);
  });

  it("sem permissão, Propor métrica fica desabilitado com o motivo", async () => {
    h.getInitiativePlan.mockResolvedValue({
      ok: true,
      data: plan({ decisionDenial: "Seu papel não move o plano." }),
    });
    render(<PlanTab code="IN-014" />);
    const button = await screen.findByRole("button", {
      name: /Propor métrica/,
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("title")).toBe("Seu papel não move o plano.");
  });

  it("plano vazio oferece gerar do modelo", async () => {
    h.getInitiativePlan.mockResolvedValue({
      ok: true,
      data: plan({ metrics: [] }),
    });
    render(<PlanTab code="IN-014" />);
    expect(
      await screen.findByRole("button", { name: /Gerar plano do modelo/ })
    ).toBeDefined();
  });

  it("enquanto carrega mostra esqueleto, não vazio", () => {
    h.getInitiativePlan.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PlanTab code="IN-014" />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByText(/ainda não tem plano/)).toBeNull();
  });
});

describe("Modal da métrica", () => {
  const props = {
    metricId: "pm_1",
    denial: null,
    canMapSource: true,
    mappings: [{ id: "mp_1", label: "MP-01 · Tempo", healthy: true }],
    mapDenial: null as string | null,
    owners: [{ id: "u1", name: "Paula" }],
    onChanged: vi.fn(),
  };

  it("mostra fórmula, versão, origem e histórico", async () => {
    render(<MetricModal {...props} />);
    expect(
      (await screen.findAllByText("mediana(tempo até destino)")).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/v2/)).toBeDefined();
    expect(screen.getByText(/Modelo Triagem/)).toBeDefined();
    expect(screen.getByText(/Aprovada no plano/)).toBeDefined();
  });

  it("métrica congelada: meta desabilitada e pedido de revisão disponível", async () => {
    h.getPlanMetric.mockResolvedValue({
      ok: true,
      data: history({ state: "FROZEN", stateLabel: "Congelada" }),
    });
    render(<MetricModal {...props} />);
    expect(
      ((await screen.findByLabelText("Meta")) as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Pedir revisão de meta",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });

  it("pausar exige comentário antes de confirmar", async () => {
    h.pauseMetric.mockResolvedValue({ ok: true, data: { state: "PAUSED" } });
    render(<MetricModal {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Pausar" }));
    const confirm = screen
      .getAllByRole("button", { name: "Pausar" })
      .at(-1) as HTMLElement;
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Pausar a medição/), {
      target: { value: "Fonte em manutenção" },
    });
    await waitFor(() =>
      expect((confirm as HTMLButtonElement).disabled).toBe(false)
    );
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(h.pauseMetric).toHaveBeenCalledWith({
        id: "pm_1",
        comment: "Fonte em manutenção",
      })
    );
  });

  it("papel sem permissão vê o motivo e os controles desabilitados", async () => {
    render(<MetricModal {...props} denial="Seu papel não move o plano." />);
    expect(
      await screen.findByText("Seu papel não move o plano.")
    ).toBeDefined();
    const dis = (n: string) =>
      (screen.getByRole("button", { name: n }) as HTMLButtonElement).disabled;
    expect(dis("Pausar")).toBe(true);
    expect(dis("Salvar nova versão")).toBe(true);
  });

  it("responsável é escolhido entre os membros com papel no Signal", async () => {
    h.editMetric.mockResolvedValue({ ok: true, data: { version: 3 } });
    render(<MetricModal {...props} />);
    const select = (await screen.findByLabelText(
      "Responsável pela métrica"
    )) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      "Sem responsável",
      "Paula",
    ]);
    fireEvent.change(select, { target: { value: "u1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    await waitFor(() =>
      expect(h.editMetric).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pm_1", ownerId: "u1" })
      )
    );
  });

  it("trocar primária exige justificativa de 10+ caracteres e avisa do pedido ao Scaffold", async () => {
    h.getPlanMetric.mockResolvedValue({
      ok: true,
      data: history({ role: "GUARD", roleLabel: "Guarda" }),
    });
    h.changePrimary.mockResolvedValue({
      ok: true,
      data: { outcome: "review-requested" },
    });
    render(<MetricModal {...props} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Tornar primária" })
    );
    const confirm = screen.getByRole("button", {
      name: "Trocar primária",
    }) as HTMLButtonElement;
    fireEvent.change(
      screen.getByLabelText(/Trocar a primária por esta métrica/),
      {
        target: { value: "curta" },
      }
    );
    expect(confirm.disabled).toBe(true);
    fireEvent.change(
      screen.getByLabelText(/Trocar a primária por esta métrica/),
      {
        target: { value: "Cobertura do copiloto mudou o alvo." },
      }
    );
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    expect(
      await screen.findByText(/pedido de revisão ao Scaffold/)
    ).toBeDefined();
  });

  it("ADMIN vê Mapear fonte desabilitado com o motivo escrito", async () => {
    render(
      <MetricModal
        {...props}
        mapDenial="Seu papel não move o plano de medição."
      />
    );
    const btn = (await screen.findByRole("button", {
      name: "Mapear fonte",
    })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(
      screen.getAllByText("Seu papel não move o plano de medição.").length
    ).toBeGreaterThan(0);
  });

  it("o seletor de fonte não abre numa conexão caída", async () => {
    render(
      <MetricModal
        {...props}
        mappings={[
          { id: "mp_down", label: "MP-00 · Tempo · Jira", healthy: false },
          { id: "mp_ok", label: "MP-01 · Tempo · Data lake", healthy: true },
        ]}
      />
    );
    const select = (await screen.findByLabelText(
      "Mapeamento de origem"
    )) as HTMLSelectElement;
    expect(select.value).toBe("mp_ok");
    expect(
      Array.from(select.options).find((o) => o.value === "mp_down")?.text
    ).toMatch(/caída|problema/);
  });

  it("a meta aparece no formato pt-BR no campo de edição", async () => {
    h.getPlanMetric.mockResolvedValue({
      ok: true,
      data: history({ target: 2.5 }),
    });
    render(<MetricModal {...props} />);
    const input = (await screen.findByLabelText("Meta")) as HTMLInputElement;
    expect(input.value).toBe("2,5");
  });
});

describe("Plano vazio: classificar a forma de trabalho", () => {
  const empty = (workForm: string | null) => {
    h.getInitiativePlan.mockResolvedValue({
      ok: true,
      data: plan({ metrics: [], workForm }),
    });
  };

  it("sem forma, oferece o campo e classifica antes de gerar", async () => {
    empty(null);
    h.classifyInitiative.mockResolvedValue({
      ok: true,
      data: { workForm: "TRIAGE" },
    });
    h.generatePlan.mockResolvedValue({ ok: true, data: { metrics: 4 } });
    render(<PlanTab code="IN-014" />);
    const select = (await screen.findByLabelText(
      "Forma de trabalho"
    )) as HTMLSelectElement;
    expect(select.value).toBe("");
    fireEvent.change(select, { target: { value: "TRIAGE" } });
    fireEvent.click(
      screen.getByRole("button", { name: /Gerar plano do modelo/ })
    );
    await waitFor(() =>
      expect(h.classifyInitiative).toHaveBeenCalledWith({
        initiativeCode: "IN-014",
        workForm: "TRIAGE",
      })
    );
    await waitFor(() => expect(h.generatePlan).toHaveBeenCalled());
  });

  it("gerar sem escolher a forma fica desabilitado, com o motivo", async () => {
    empty(null);
    render(<PlanTab code="IN-014" />);
    const btn = (await screen.findByRole("button", {
      name: /Gerar plano do modelo/,
    })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(
      screen.getAllByText(/Escolha a forma de trabalho/).length
    ).toBeGreaterThan(0);
  });

  it("forma já gravada não chama classificar de novo", async () => {
    empty("TRIAGE");
    h.generatePlan.mockResolvedValue({ ok: true, data: { metrics: 4 } });
    render(<PlanTab code="IN-014" />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Gerar plano do modelo/ })
    );
    await waitFor(() => expect(h.generatePlan).toHaveBeenCalled());
    expect(h.classifyInitiative).not.toHaveBeenCalled();
  });
});
