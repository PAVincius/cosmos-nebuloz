import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Benchmark travado por tenant, lado da leitura (specs/012): com a habilitação
// desligada o servidor devolve `cohort: null` e a aba Relatório não desenha
// nem o card de benchmark nem a faixa da coorte.

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
const REPORT = {
  assessmentCode: "AS-104",
  orgName: "Vanta Saúde",
  sector: "Saúde",
  templateVersion: "v3.2",
  composite: 61,
  axes: [
    {
      axis: "DATA",
      label: "Data",
      score: 61,
      computed: 61,
      confidence: 0.8,
      overridden: false,
      rationale: null,
    },
  ],
  topGaps: [],
  trail: [],
  isReassessment: false,
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("RelatorioTab — bloco de benchmark", () => {
  it("cohort nulo (habilitação desligada): sem card de benchmark, relatório inteiro", async () => {
    h.getReport.mockResolvedValue({
      ok: true,
      data: { ...REPORT, cohort: null },
    });
    render(<RelatorioTab a={A} />);
    await screen.findByText(/≥70 pronto/);
    expect(screen.queryByText(/Benchmark —/)).toBeNull();
    expect(screen.queryByText(/Comparação retida/)).toBeNull();
    expect(screen.queryByText(/banda p25–p75/)).toBeNull();
  });

  it("cohort presente e retido: continua declarando a retenção", async () => {
    h.getReport.mockResolvedValue({
      ok: true,
      data: {
        ...REPORT,
        cohort: { cohortKey: "saude · 200–1.000", n: 3, withheld: true },
      },
    });
    render(<RelatorioTab a={A} />);
    expect(await screen.findByText(/Comparação retida/)).toBeTruthy();
    expect(screen.getByText(/Benchmark — saude/)).toBeTruthy();
  });
});
