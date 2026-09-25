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

let fakeWin: {
  location: { href: string };
  close: ReturnType<typeof vi.fn>;
  opener: unknown;
};

beforeEach(() => {
  vi.clearAllMocks();
  fakeWin = { location: { href: "" }, close: vi.fn(), opener: {} };
  // Contrato real de window.open: com "noopener" nas features, TODO browser
  // devolve null — não dá pra ter referência à aba e cortar o opener ao
  // mesmo tempo. Um mock que sempre devolve objeto esconde exatamente o bug
  // que este teste existe pra pegar.
  window.open = vi.fn((_url?: string, _target?: string, features?: string) =>
    features?.includes("noopener") ? null : (fakeWin as unknown as Window)
  );
});

describe("DivergencePanel — Ver evidência", () => {
  it("abre a aba em branco no clique (síncrono) sem noopener, corta o opener na mão, e só navega depois que a URL chega", async () => {
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
    // o popup. E sem "noopener" nos args — senão o browser real devolve
    // null e a aba nunca navega.
    expect(window.open).toHaveBeenCalledTimes(1);
    const call = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("");
    expect(call[1]).toBe("_blank");
    expect(String(call[2] ?? "")).not.toMatch(/noopener/);

    // Opener cortado na mão — é o que faz o "noopener" de verdade sem matar
    // a referência que o resto da função precisa.
    expect(fakeWin.opener).toBeNull();
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
