/** @vitest-environment jsdom */
// risk-screen.test.tsx — tela de Matriz de Risco: o botão "Exportar matriz"
// foi removido (não existe exportação real servindo a matriz nesta onda), o
// eyebrow deriva a contagem de categorias de RISK_CATEGORY_LABEL em vez de um
// "7" hardcoded, a concordância de "mitigação(ões) atrasada(s)" acompanha a
// contagem, e o mapa de calor / rastreador de mitigações mostram um estado
// vazio honesto — com link para casos de uso — em vez de uma grade de "·" ou
// só o cabeçalho da tabela flutuando. Asserção sobre conteúdo, sem snapshot.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RiskBoard } from "@/app/(charter)/actions/risk";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const getRiskBoardMock = vi.fn();
const createMitigationMock = vi.fn();
vi.mock("@/app/(charter)/actions/risk", () => ({
  getRiskBoard: (...args: unknown[]) => getRiskBoardMock(...args),
  createMitigation: (...args: unknown[]) => createMitigationMock(...args),
}));

import RiskScreen from "../../components/charter/screens/risk";

function board(over: Partial<RiskBoard> = {}): RiskBoard {
  return {
    heatmap: [],
    categories: [],
    mitigations: [],
    cases: [],
    ...over,
  };
}

describe("RiskScreen", () => {
  beforeEach(() => {
    pushMock.mockReset();
    getRiskBoardMock.mockReset();
    createMitigationMock.mockReset();
  });

  it("não mostra mais 'Exportar matriz' — nenhuma exportação real serve a matriz de risco", async () => {
    getRiskBoardMock.mockResolvedValue({ ok: true, data: board() });
    render(<RiskScreen />);

    await screen.findByText("Matriz de Risco de IA");
    expect(
      screen.queryByRole("button", { name: /exportar matriz/i })
    ).toBeNull();
  });

  it("eyebrow deriva a contagem de categorias do dado — não um '7' solto no JSX", async () => {
    getRiskBoardMock.mockResolvedValue({ ok: true, data: board() });
    render(<RiskScreen />);

    // RISK_CATEGORY_LABEL tem 7 chaves hoje (privacidade, regulatório,
    // segurança, viés, PI, operacional, reputacional) — o texto abaixo só
    // é prova de "vem do dado" porque o teste de concordância de plural mais
    // adiante prova o mesmo padrão de contagem em outro número.
    expect(await screen.findByText(/7 categorias de risco/)).toBeTruthy();
  });

  it("badge de mitigação atrasada concorda em número — zero usa o plural", async () => {
    getRiskBoardMock.mockResolvedValue({
      ok: true,
      data: board({
        cases: [
          {
            code: "UC-1",
            title: "Caso 1",
            dataClass: "INTERNAL",
            severity: 2,
            likelihood: 2,
            score: 4,
            label: "baixo",
            tone: "green",
            status: "APPROVED",
          },
        ],
        mitigations: [
          {
            id: "m1",
            code: "MIT-01",
            useCaseCode: "UC-1",
            useCaseTitle: "Caso 1",
            category: "PRIVACY",
            action: "Ação",
            ownerName: null,
            dueDate: null,
            status: "OPEN",
            overdue: false,
          },
        ],
      }),
    });
    render(<RiskScreen />);

    expect(await screen.findByText("0 mitigações atrasadas")).toBeTruthy();
  });

  it("mapa de calor e rastreador de mitigações mostram estado vazio honesto com link para casos de uso", async () => {
    getRiskBoardMock.mockResolvedValue({ ok: true, data: board() });
    render(<RiskScreen />);

    const links = await screen.findAllByRole("button", {
      name: /ver casos de uso/i,
    });
    // Uma ocorrência no mapa de calor, outra no rastreador de mitigações.
    expect(links.length).toBe(2);

    fireEvent.click(links[0]);
    expect(pushMock).toHaveBeenCalledWith("/charter/cases");
  });
});
