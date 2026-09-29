// meridian-gaps-tab.test.tsx — a aba que desenha o grafo de dependências.
//
// Existe por causa de um bug que só aparecia no navegador: a lista de arestas
// era recalculada a cada render e entrava nas dependências do `useLayoutEffect`
// que mede a geometria dos nós. Referência nova a cada render → efeito roda →
// `setEdgeGeom` → outro render, e o React derrubava a tela inteira com
// "Maximum update depth exceeded".
//
// Typecheck, lint e os testes de action passavam com o bug em pé: nenhum deles
// renderiza a árvore. Este renderiza — e é isso que o torna a rede certa para
// essa classe de erro.
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssessmentDetail } from "../../app/(meridian)/actions/assessments";
import type { GapRow } from "../../app/(meridian)/actions/gaps";

const listGapRegisterMock = vi.fn();

// A lista de evidências (A3) chama a action de leitura; sem o mock o teste
// carregaria o banco no jsdom.
vi.mock("@/app/(meridian)/actions/report", () => ({
  listAssessmentEvidence: () =>
    Promise.resolve({ ok: true, data: { total: 0, items: [] } }),
  requestEvidenceUrl: vi.fn(),
}));
vi.mock("@/app/(meridian)/actions/gaps", () => ({
  listGapRegister: (...args: unknown[]) => listGapRegisterMock(...args),
}));

import GapsTab from "@/components/meridian/screens/tab-gaps";

const gap = (
  code: string,
  costOfDelay: number,
  dependsOn: string[] = []
): GapRow => ({
  id: `id-${code}`,
  code,
  assessmentId: "clx0000000000000000000as4",
  assessmentCode: "AS-104",
  orgName: "Vanta Saúde",
  axis: "DATA",
  statement: `${code}: enunciado do gap para a coluna do grafo.`,
  severity: "HIGH",
  effort: "L",
  costOfDelay,
  confidence: "MEASURED",
  ownerLabel: "Eng. de Dados",
  state: "OPEN",
  derived: true,
  since: "2026-08-01T00:00:00.000Z",
  evidenceCount: 2,
  dependsOn,
  promotion: null,
});

const ASSESSMENT = { id: "a1" } as AssessmentDetail;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GapsTab", () => {
  it("renderiza o grafo sem entrar em loop de render", async () => {
    // Uma cadeia de dependências obriga o efeito de medição a rodar com
    // arestas de verdade — que é o caminho onde o loop acontecia.
    listGapRegisterMock.mockResolvedValue({
      ok: true,
      data: [
        gap("G-01", 88),
        gap("G-02", 74, ["G-01"]),
        gap("G-03", 60, ["G-02"]),
      ],
    });

    const erros: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      erros.push(args[0]);
    };

    try {
      render(<GapsTab a={ASSESSMENT} />);
      await waitFor(() => {
        expect(screen.getByText("Grafo de dependências")).toBeTruthy();
      });
    } finally {
      console.error = originalError;
    }

    expect(
      erros.filter((e) => String(e).includes("Maximum update depth"))
    ).toEqual([]);
  });

  it("agrupa os gaps por profundidade topológica", async () => {
    listGapRegisterMock.mockResolvedValue({
      ok: true,
      data: [gap("G-01", 88), gap("G-02", 74, ["G-01"])],
    });
    render(<GapsTab a={ASSESSMENT} />);

    await waitFor(() => {
      expect(screen.getByText("Sem pré-requisito")).toBeTruthy();
    });
    expect(screen.getByText("Depende de nível 0")).toBeTruthy();
  });

  it("ordena a tabela por custo de atraso decrescente", async () => {
    listGapRegisterMock.mockResolvedValue({
      ok: true,
      data: [gap("G-baixo", 20), gap("G-alto", 90)],
    });
    render(<GapsTab a={ASSESSMENT} />);

    await waitFor(() => {
      expect(screen.getByText("Gaps por custo de atraso")).toBeTruthy();
    });
    // Só a tabela é ordenada por custo de atraso; o grafo acima agrupa por
    // profundidade topológica e cita os mesmos códigos, então a asserção
    // precisa começar depois do título da tabela.
    const corpo = document.body.textContent ?? "";
    const tabela = corpo.slice(corpo.indexOf("Gaps por custo de atraso"));
    expect(tabela.indexOf("G-alto")).toBeLessThan(tabela.indexOf("G-baixo"));
  });

  it("explica o vazio em vez de desenhar grafo sem nós", async () => {
    listGapRegisterMock.mockResolvedValue({ ok: true, data: [] });
    render(<GapsTab a={ASSESSMENT} />);

    await waitFor(() => {
      expect(screen.getByText("Gaps ainda não derivados")).toBeTruthy();
    });
  });
});
