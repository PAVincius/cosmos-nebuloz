// meridian.test.tsx — telas do Meridian. Cobre o que o usuário vê e que uma
// regressão de dados esconderia: a carteira com os três estados obrigatórios
// (carregando / vazio com saída / erro com retry), e a coorte retida do
// benchmark, que é a regra de privacidade mais fácil de quebrar sem notar.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentRow } from "../../app/(meridian)/actions/assessments";
import type { CohortRow } from "../../app/(meridian)/actions/benchmark";

const listAssessmentsMock = vi.fn();
const listCohortsMock = vi.fn();

vi.mock("@/app/(meridian)/actions/assessments", () => ({
  listAssessments: (...args: unknown[]) => listAssessmentsMock(...args),
}));
vi.mock("@/app/(meridian)/actions/benchmark", () => ({
  listCohorts: (...args: unknown[]) => listCohortsMock(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import AssessmentsScreen from "@/components/meridian/screens/assessments";
import BenchmarkScreen from "@/components/meridian/screens/benchmark";

const ROW: AssessmentRow = {
  id: "a1",
  code: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  sizeBand: "200–1.000",
  templateVersion: "v3.2",
  status: "REVIEW",
  deadline: "2026-08-01T00:00:00.000Z",
  consultantId: "u1",
  benchmarkOptIn: true,
  reassessmentOfCode: "AS-092",
  responses: { done: 52, total: 55 },
  evidence: 31,
  scores: [
    {
      axis: "DATA",
      computed: 46,
      final: null,
      confidence: 0.58,
      respondentCount: 2,
      spread: 31,
      status: "CONTESTED",
      note: "Discordância alta",
    },
  ],
  composite: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AssessmentsScreen", () => {
  it("mostra a carteira com organização, código e re-run declarado", async () => {
    listAssessmentsMock.mockResolvedValue({ ok: true, data: [ROW] });
    render(<AssessmentsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Vanta Saúde")).toBeTruthy();
    });
    expect(screen.getByText(/AS-104/)).toBeTruthy();
    expect(screen.getByText(/re-run de AS-092/)).toBeTruthy();
    expect(screen.getByText("52/55")).toBeTruthy();
  });

  it("conta os eixos contestados no indicador de topo", async () => {
    listAssessmentsMock.mockResolvedValue({ ok: true, data: [ROW] });
    render(<AssessmentsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Eixos contestados")).toBeTruthy();
    });
  });

  it("diz 'sem scoring' em vez de desenhar zero", async () => {
    listAssessmentsMock.mockResolvedValue({
      ok: true,
      data: [{ ...ROW, scores: null, composite: null }],
    });
    render(<AssessmentsScreen />);
    await waitFor(() => {
      expect(screen.getByText("sem scoring")).toBeTruthy();
    });
  });

  it("oferece saída no estado vazio em vez de tabela morta", async () => {
    listAssessmentsMock.mockResolvedValue({ ok: true, data: [] });
    render(<AssessmentsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Nada neste filtro")).toBeTruthy();
    });
    expect(screen.getByText("Ver todos")).toBeTruthy();
  });

  it("mostra o erro de carregamento em vez de lista vazia", async () => {
    listAssessmentsMock.mockResolvedValue({
      ok: false,
      error: "Falha ao consultar a carteira.",
    });
    render(<AssessmentsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Falha ao consultar a carteira/)).toBeTruthy();
    });
  });
});

describe("BenchmarkScreen", () => {
  const withheld: CohortRow = {
    cohortKey: "agro · 200–1.000",
    n: 3,
    withheld: true,
  };
  const available: CohortRow = {
    cohortKey: "saude · 200–1.000",
    n: 11,
    withheld: false,
    bands: {
      DATA: { p25: 38, p50: 52, p75: 64 },
      PROCESS: { p25: 44, p50: 55, p75: 68 },
      PEOPLE: { p25: 30, p50: 42, p75: 55 },
      GOVERNANCE: { p25: 41, p50: 57, p75: 71 },
      INFRASTRUCTURE: { p25: 40, p50: 53, p75: 66 },
    },
  };

  it("declara a retenção da coorte abaixo do mínimo", async () => {
    listCohortsMock.mockResolvedValue({ ok: true, data: [withheld] });
    render(<BenchmarkScreen />);
    await waitFor(() => {
      expect(
        screen.getByText(/agregado existe, leitura bloqueada/)
      ).toBeTruthy();
    });
    // "retido" aparece no texto explicativo do cabeçalho e no selo da linha —
    // o que importa é o selo, e ele traz o limiar junto.
    expect(screen.getAllByText(/retido · n <\s*5/).length).toBeGreaterThan(0);
  });

  it("mostra a coorte liberada como disponível", async () => {
    listCohortsMock.mockResolvedValue({ ok: true, data: [available] });
    render(<BenchmarkScreen />);
    await waitFor(() => {
      expect(screen.getByText("disponível")).toBeTruthy();
    });
  });

  it("explica o pool vazio em vez de mostrar tabela sem linhas", async () => {
    listCohortsMock.mockResolvedValue({ ok: true, data: [] });
    render(<BenchmarkScreen />);
    await waitFor(() => {
      expect(screen.getByText("Pool vazio")).toBeTruthy();
    });
  });
});
