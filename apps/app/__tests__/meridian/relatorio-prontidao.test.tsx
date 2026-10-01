import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AxisReading,
  assessReadiness,
} from "@/lib/meridian/readiness-bands";

// Faixas por eixo e arquétipo na aba Relatório (briefing do Andaime, itens 1 e
// 2). O estado vai em palavra, nunca só em cor (DESIGN.md do Meridian).

const h = vi.hoisted(() => ({
  getReport: vi.fn(),
  getReassessmentDiff: vi.fn(),
}));

vi.mock("@/app/(meridian)/actions/report", () => ({
  getReport: h.getReport,
  getReassessmentDiff: h.getReassessmentDiff,
}));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import RelatorioTab from "@/components/meridian/screens/tab-relatorio";

const A = { id: "as-1" } as never;

type Row = readonly [string, string, number, number];

const ATLAS: readonly Row[] = [
  ["DATA", "Data", 32, 0.72],
  ["PROCESS", "Process", 58, 0.65],
  ["PEOPLE", "People", 47, 0.55],
  ["GOVERNANCE", "Governance", 41, 0.61],
  ["INFRASTRUCTURE", "Infrastructure", 36, 0.8],
];

function reportFor(rows: readonly Row[]) {
  return {
    assessmentCode: "AS-900",
    orgName: "Atlas",
    sector: "Varejo",
    templateVersion: "v3.2",
    composite: 43,
    axes: rows.map(([axis, label, score, confidence]) => ({
      axis,
      label,
      score,
      computed: score,
      confidence,
      overridden: false,
      rationale: null,
    })),
    cohort: null,
    readiness: assessReadiness(
      rows.map(([axis, , score, confidence]) => ({
        axis: axis as AxisReading["axis"],
        score,
        confidence,
      }))
    ),
    topGaps: [],
    trail: [],
    isReassessment: false,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("RelatorioTab — faixas e arquétipo", () => {
  it("cada eixo mostra a faixa por extenso; confiança baixa ACRESCENTA a marca, não troca a faixa", async () => {
    h.getReport.mockResolvedValue({ ok: true, data: reportFor(ATLAS) });
    render(<RelatorioTab a={A} />);
    await screen.findByText(/Arquétipo de prontidão/);

    const linha = (rotulo: string) =>
      screen
        .getByText(rotulo, { selector: "span" })
        .closest("div") as HTMLElement;
    expect(within(linha("Data")).getByText("Inicial")).toBeTruthy();
    expect(within(linha("Process")).getByText("Em formação")).toBeTruthy();
    expect(within(linha("Governance")).getByText("Em formação")).toBeTruthy();
    expect(within(linha("Infrastructure")).getByText("Inicial")).toBeTruthy();
    // Pessoas: as duas coisas, faixa e marca (spec, US1 cenário 2).
    expect(within(linha("People")).getByText("Em formação")).toBeTruthy();
    expect(within(linha("People")).getByText("Não confiável")).toBeTruthy();
    // Os demais eixos não levam a marca.
    for (const eixo of ["Data", "Process", "Governance", "Infrastructure"]) {
      expect(within(linha(eixo)).queryByText("Não confiável")).toBeNull();
    }
  });

  it("o card do arquétipo mostra o dominante e o traço secundário (Atlas)", async () => {
    h.getReport.mockResolvedValue({ ok: true, data: reportFor(ATLAS) });
    render(<RelatorioTab a={A} />);
    const card = (await screen.findByText(/Arquétipo de prontidão/)).closest(
      "section, div[class], div"
    ) as HTMLElement;
    expect(screen.getAllByText("Piloto sem chão").length).toBeGreaterThan(0);
    expect(screen.getByText(/Traço secundário/)).toBeTruthy();
    expect(screen.getAllByText("Campeão isolado").length).toBeGreaterThan(0);
    expect(card).toBeTruthy();
  });

  it("diz que o score é instrução de sequência, não nota", async () => {
    h.getReport.mockResolvedValue({ ok: true, data: reportFor(ATLAS) });
    render(<RelatorioTab a={A} />);
    expect(
      await screen.findByText(/instrução de sequência, não nota/i)
    ).toBeTruthy();
  });

  it("eixo não confiável pede revalidação, nomeando o eixo", async () => {
    h.getReport.mockResolvedValue({ ok: true, data: reportFor(ATLAS) });
    render(<RelatorioTab a={A} />);
    expect(
      await screen.findByText(/revalide.*People|People.*revalid/i)
    ).toBeTruthy();
  });

  it("sem padrão entre os eixos: declara, em vez de inventar arquétipo", async () => {
    h.getReport.mockResolvedValue({
      ok: true,
      data: reportFor([
        ["DATA", "Data", 45, 0.9],
        ["PROCESS", "Process", 65, 0.9],
        ["PEOPLE", "People", 30, 0.9],
        ["GOVERNANCE", "Governance", 55, 0.9],
        ["INFRASTRUCTURE", "Infrastructure", 70, 0.9],
      ]),
    });
    render(<RelatorioTab a={A} />);
    expect(
      await screen.findByText(/Sem padrão dominante entre os eixos/)
    ).toBeTruthy();
    expect(screen.queryByText(/Traço secundário/)).toBeNull();
  });

  it("com menos de cinco eixos: não há arquétipo, e a tela diz por quê", async () => {
    h.getReport.mockResolvedValue({
      ok: true,
      data: reportFor(ATLAS.slice(0, 3)),
    });
    render(<RelatorioTab a={A} />);
    expect(await screen.findByText(/cinco eixos com score/i)).toBeTruthy();
  });
});
