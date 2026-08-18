// measure.test.tsx — Measure & Grow (/cosmos/measure). Verifica que o KPI, o
// radar e a coluna de delta saem de dado real, que um ciclo anterior parcial
// degrada o radar para só-atual em vez de fabricar nota faltante, e que o
// painel de ações de melhoria (FR-013) mostra a taxa de conclusão com
// denominador e permite registrar avaliação e ação pela tela.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCompetencyScoresMock = vi.fn();
const listImprovementActionsMock = vi.fn();
const recordCompetencyAssessmentMock = vi.fn();
const createImprovementActionMock = vi.fn();
const listTeamsMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/measure", () => ({
  listCompetencyScores: (...args: unknown[]) =>
    listCompetencyScoresMock(...args),
  listImprovementActions: (...args: unknown[]) =>
    listImprovementActionsMock(...args),
  recordCompetencyAssessment: (...args: unknown[]) =>
    recordCompetencyAssessmentMock(...args),
  createImprovementAction: (...args: unknown[]) =>
    createImprovementActionMock(...args),
}));
vi.mock("@/app/(cosmos)/actions/teams", () => ({
  listTeams: (...args: unknown[]) => listTeamsMock(...args),
}));

import MeasureScreen from "../../components/cosmos/screens/measure";

const NO_ACTIONS = {
  ok: true,
  data: { items: [], total: 0, done: 0, completionPct: null },
};

const FULL_PREV_CYCLE = [
  {
    competency: "TEAM_TECHNICAL_AGILITY",
    competencyLabel: "Team & Technical Agility",
    score: 4.5,
    prevScore: 4.0,
    delta: 0.5,
    assessedAt: new Date("2026-02-01"),
  },
  {
    competency: "AGILE_PRODUCT_DELIVERY",
    competencyLabel: "Agile Product Delivery",
    score: 2.0,
    prevScore: 2.5,
    delta: -0.5,
    assessedAt: new Date("2026-02-01"),
  },
  {
    competency: "ENTERPRISE_SOLUTION_DELIVERY",
    competencyLabel: "Enterprise Solution Delivery",
    score: 3.0,
    prevScore: 3.0,
    delta: 0,
    assessedAt: new Date("2026-02-01"),
  },
];

describe("MeasureScreen", () => {
  beforeEach(() => {
    listCompetencyScoresMock.mockReset();
    listImprovementActionsMock.mockReset();
    recordCompetencyAssessmentMock.mockReset();
    createImprovementActionMock.mockReset();
    listTeamsMock.mockReset();
    listImprovementActionsMock.mockResolvedValue(NO_ACTIONS);
    // Deliberadamente lento. `listTeams` é um fetch independente do que desenha
    // a tela, então na prática ele às vezes chega depois do primeiro clique —
    // foi o que deixou este arquivo vermelho na CI sem nenhum commit o ter
    // causado. Resolver na hora esconderia a corrida e o `findByRole("option")`
    // dos testes de escrita viraria enfeite: passaria por acidente de ordem.
    listTeamsMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                data: [{ id: "team-atlas", name: "Squad Atlas" }],
              }),
            50
          )
        )
    );
  });

  it("renders KPIs and the prev-cycle delta column from real data", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getAllByText("Team & Technical Agility").length
      ).toBeGreaterThan(0)
    );
    // KpiCard values count up via requestAnimationFrame; wait for the
    // animation's fallback timeout to settle on the real, exact figure.
    // avg maturity = (4.5 + 2.0 + 3.0) / 3 = 3.2 (comma-decimal, matching
    // the codebase's convention for KpiCard's animated decimal values)
    await waitFor(() => expect(screen.getByText("3,2")).toBeTruthy(), {
      timeout: 3000,
    });
    // delta column renders the sign explicitly
    expect(screen.getByText("+0.5")).toBeTruthy();
    expect(screen.getByText("-0.5")).toBeTruthy();
  });

  it("shows the previous-cycle radar overlay when every competency has one", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(screen.getByText("Ciclo anterior")).toBeTruthy()
    );
  });

  it("degrades to current-only when the previous cycle is partial, not fabricated", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          competency: "TEAM_TECHNICAL_AGILITY",
          competencyLabel: "Team & Technical Agility",
          score: 4.5,
          prevScore: 4.0,
          delta: 0.5,
          assessedAt: new Date("2026-02-01"),
        },
        {
          competency: "AGILE_PRODUCT_DELIVERY",
          competencyLabel: "Agile Product Delivery",
          score: 2.0,
          prevScore: null,
          delta: null,
          assessedAt: new Date("2026-02-01"),
        },
        {
          competency: "ENTERPRISE_SOLUTION_DELIVERY",
          competencyLabel: "Enterprise Solution Delivery",
          score: 3.0,
          prevScore: null,
          delta: null,
          assessedAt: new Date("2026-02-01"),
        },
      ],
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getAllByText("Team & Technical Agility").length
      ).toBeGreaterThan(0)
    );
    expect(screen.queryByText("Ciclo anterior")).toBeNull();
    // the honest "—" for a competency with no prior cycle, not a fake 0
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows honest empty states with no assessments, not fabricated data", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getAllByText("Nenhuma avaliação encontrada.").length
      ).toBeGreaterThan(0)
    );
  });

  it("mostra a taxa de conclusão das ações de melhoria com o denominador (FR-013)", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });
    listImprovementActionsMock.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [
          {
            id: "a1",
            title: "Dojo de testes de contrato",
            status: "DONE",
            competencyLabel: "Team & Technical Agility",
            dueDate: null,
          },
          {
            id: "a2",
            title: "Revisar hipótese de valor no PI Planning",
            status: "OPEN",
            competencyLabel: null,
            dueDate: null,
          },
        ],
        total: 2,
        done: 1,
        completionPct: 50,
      },
    });

    render(<MeasureScreen />);

    expect(await screen.findByText("Dojo de testes de contrato")).toBeTruthy();
    expect(screen.getByText("1 de 2 concluídas")).toBeTruthy();
    expect(
      screen.getByText("Revisar hipótese de valor no PI Planning")
    ).toBeTruthy();
  });

  it("não mostra 0% de conclusão quando não há ação viva", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });
    listImprovementActionsMock.mockResolvedValueOnce(NO_ACTIONS);

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(screen.getByText("Nenhuma ação de melhoria aberta.")).toBeTruthy()
    );
    expect(screen.queryByText("0% concluídas")).toBeNull();
  });

  it("registra uma avaliação pela tela e recarrega (caminho de escrita do FR-013)", async () => {
    listCompetencyScoresMock.mockResolvedValue({
      ok: true,
      data: FULL_PREV_CYCLE,
    });
    recordCompetencyAssessmentMock.mockResolvedValue({
      ok: true,
      data: { id: "ca-1" },
    });

    render(<MeasureScreen />);
    await screen.findByText("Registrar avaliação");

    fireEvent.click(screen.getByText("Registrar avaliação"));
    fireEvent.change(await screen.findByLabelText("Competência"), {
      target: { value: "AGILE_PRODUCT_DELIVERY" },
    });
    fireEvent.change(screen.getByLabelText("Nota (1–5)"), {
      target: { value: "4" },
    });
    // A lista de times vem de `listTeams`, um fetch independente do que
    // desenha a tela — esperar por "Registrar avaliação" não garante que ela
    // chegou. Selecionar um value cuja <option> ainda não existe é no-op
    // silencioso no jsdom: `scopeId` fica "", o guard do `save` devolve sem
    // chamar nada, e a falha aparece como "Number of calls: 0" longe da causa.
    await screen.findByRole("option", { name: "Squad Atlas" });
    fireEvent.change(screen.getByLabelText("Time avaliado"), {
      target: { value: "team-atlas" },
    });
    fireEvent.click(screen.getByText("Salvar avaliação"));

    await waitFor(() =>
      expect(recordCompetencyAssessmentMock).toHaveBeenCalledWith({
        competency: "AGILE_PRODUCT_DELIVERY",
        score: 4,
        scope: "team",
        scopeId: "team-atlas",
      })
    );
    await waitFor(() =>
      expect(listCompetencyScoresMock.mock.calls.length).toBeGreaterThan(1)
    );
  });

  it("abre uma ação de melhoria pela tela", async () => {
    listCompetencyScoresMock.mockResolvedValue({
      ok: true,
      data: FULL_PREV_CYCLE,
    });
    createImprovementActionMock.mockResolvedValue({
      ok: true,
      data: { id: "ia-1" },
    });

    render(<MeasureScreen />);
    await screen.findByText("Nova ação");

    fireEvent.click(screen.getByText("Nova ação"));
    fireEvent.change(await screen.findByLabelText("Título"), {
      target: { value: "Rodar dojo de testes de contrato" },
    });
    await screen.findByRole("option", { name: "Squad Atlas" });
    fireEvent.change(screen.getByLabelText("Time responsável"), {
      target: { value: "team-atlas" },
    });
    fireEvent.click(screen.getByText("Criar ação"));

    await waitFor(() =>
      expect(createImprovementActionMock).toHaveBeenCalledWith({
        title: "Rodar dojo de testes de contrato",
        scope: "team",
        scopeId: "team-atlas",
      })
    );
  });

  it("mostra o estado de erro do painel de ações sem inventar ação", async () => {
    listCompetencyScoresMock.mockResolvedValueOnce({
      ok: true,
      data: FULL_PREV_CYCLE,
    });
    listImprovementActionsMock.mockResolvedValueOnce({
      ok: false,
      error: "boom",
    });

    render(<MeasureScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar as ações de melhoria.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Nenhuma ação de melhoria aberta.")).toBeNull();
  });
});
