// DivergencePanel — "Ver evidência" é a UI que faltava pro consultor abrir o
// que o respondente anexou (P1, achado do Crivo em M8: requestEvidenceUrl
// existia sem nenhuma tela chamando). Prova: clicar chama a action e abre a
// URL assinada devolvida — não uma URL inventada no cliente.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DivergenceRow } from "../../app/(meridian)/actions/scoring";

const getDivergenceMock = vi.fn();
const requestEvidenceUrlMock = vi.fn();

vi.mock("@/app/(meridian)/actions/scoring", () => ({
  getDivergence: (...args: unknown[]) => getDivergenceMock(...args),
}));
vi.mock("@/app/(meridian)/actions/report", () => ({
  requestEvidenceUrl: (...args: unknown[]) => requestEvidenceUrlMock(...args),
}));
// tab-scoring.tsx também importa registerOverride — sem mock, o módulo real
// de overrides.ts puxa o encadeamento de env server-only e derruba o import
// em jsdom, mesmo sem essa função ser usada neste teste.
vi.mock("@/app/(meridian)/actions/overrides", () => ({
  registerOverride: vi.fn(),
}));

import { DivergencePanel } from "@/components/meridian/screens/tab-scoring";

const ROWS: DivergenceRow[] = [
  {
    questionCode: "Q-D01",
    questionText: "Qual a cobertura de linhagem?",
    evidenceCount: 1,
    answers: [
      {
        respondentName: "Jonas Reis",
        respondentRole: "Eng. de Dados",
        displayValue: "Concordo",
        normalized: 0.75,
        evidence: [{ id: "ev1", fileName: "catalogo.xlsx" }],
      },
      {
        respondentName: "Ana Kim",
        respondentRole: "Analista de BI",
        displayValue: "Discordo",
        normalized: 0,
        evidence: [],
      },
    ],
  },
];

let fakeWin: { location: { href: string }; close: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  fakeWin = { location: { href: "" }, close: vi.fn() };
  window.open = vi.fn(() => fakeWin as unknown as Window);
});

describe("DivergencePanel — Ver evidência", () => {
  it("abre a aba em branco no clique (síncrono) e só navega depois que a URL chega — evita bloqueio de popup", async () => {
    getDivergenceMock.mockResolvedValue({ ok: true, data: ROWS });
    requestEvidenceUrlMock.mockResolvedValue({
      ok: true,
      data: { url: "https://signed.example/catalogo.xlsx", expiresIn: 300 },
    });

    render(<DivergencePanel assessmentId="a1" axis="DATA" />);

    const evidenceBtn = await screen.findByText("catalogo.xlsx");
    fireEvent.click(evidenceBtn);

    // window.open precisa acontecer NO clique, antes do await resolver —
    // depois disso o browser não conta mais como gesto do usuário e bloqueia
    // o popup.
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith(
      "",
      "_blank",
      "noopener,noreferrer"
    );
    expect(fakeWin.location.href).toBe("");

    await waitFor(() => {
      expect(fakeWin.location.href).toBe(
        "https://signed.example/catalogo.xlsx"
      );
    });
    expect(window.open).toHaveBeenCalledTimes(1);
  });

  it("fecha a aba em branco se requestEvidenceUrl falhar", async () => {
    getDivergenceMock.mockResolvedValue({ ok: true, data: ROWS });
    requestEvidenceUrlMock.mockResolvedValue({
      ok: false,
      error: "Evidência não encontrada nesta organização.",
    });

    render(<DivergencePanel assessmentId="a1" axis="DATA" />);
    fireEvent.click(await screen.findByText("catalogo.xlsx"));

    await waitFor(() => {
      expect(fakeWin.close).toHaveBeenCalledTimes(1);
    });
  });

  it("não mostra botão de evidência pra resposta sem anexo", async () => {
    getDivergenceMock.mockResolvedValue({ ok: true, data: ROWS });
    render(<DivergencePanel assessmentId="a1" axis="DATA" />);

    await screen.findByText("catalogo.xlsx");
    // Ana Kim não anexou nada — só o card dela não pode ter botão de evidência.
    expect(screen.queryAllByText("catalogo.xlsx")).toHaveLength(1);
  });
});
