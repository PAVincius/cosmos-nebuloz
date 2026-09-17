/** @vitest-environment jsdom */
// readiness-avaliacao-a11y.test.tsx — o que a folha de avaliação diz sem
// depender de `title` nem da posição do erro.
//
// 1. A definição do nível existia só em `title` do botão — invisível para
//    teclado, toque e leitor de tela. O nível selecionado passa a mostrar a
//    definição em texto, abaixo da linha de botões.
// 2. O erro de um critério aparecia no topo da página, longe do botão que
//    falhou. Agora o `Erro` fica ao lado do critério cuja gravação o servidor
//    recusou.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Avaliacao } from "@/app/(staff)/growth/readiness/[id]/avaliacao";
import type { AvaliacaoDetalhe } from "@/app/actions/maturidade";
import { INFO_NIVEL } from "@/lib/growth/maturidade";

const { responderMock, concluirMock } = vi.hoisted(() => ({
  concluirMock: vi.fn(),
  responderMock: vi.fn(),
}));

vi.mock("@/app/actions/maturidade", () => ({
  concluirAvaliacao: concluirMock,
  responder: responderMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const PATROCINIO = "Existe patrocínio executivo com orçamento próprio para IA?";
const PORTFOLIO =
  "O portfólio de casos de uso é priorizado por valor e viabilidade?";

function avaliacao(over: Partial<AvaliacaoDetalhe> = {}): AvaliacaoDetalhe {
  return {
    autorNome: "Vini",
    concluidaEm: null,
    criadoEm: "2026-09-01T00:00:00.000Z",
    id: "av-1",
    leadId: null,
    leadNome: null,
    nivelGeral: null,
    organizacao: "Acme",
    respondidos: 0,
    respostas: [],
    rubricaVersao: "v1",
    scoreGeral: null,
    status: "RASCUNHO",
    ...over,
  };
}

/** Os cinco rádios de nível do critério cuja pergunta é `pergunta`. */
function botoesDoCriterio(pergunta: string): HTMLInputElement[] {
  const bloco = screen.getByText(pergunta).closest("div")
    ?.parentElement as HTMLElement;
  return Array.from(
    bloco.querySelectorAll<HTMLInputElement>('input[type="radio"]')
  );
}

describe("Avaliacao — nível e erro visíveis", () => {
  beforeEach(() => {
    responderMock.mockReset();
    responderMock.mockResolvedValue({ data: {}, ok: true });
    concluirMock.mockReset();
  });

  it("com nível selecionado, a definição aparece em texto abaixo dos botões", () => {
    render(
      <Avaliacao
        inicial={avaliacao({
          respostas: [
            { criterioId: "estrategia.patrocinio", nivel: 2, nota: null },
          ],
        })}
        podeEscrever
      />
    );

    expect(screen.getByText(INFO_NIVEL[2].definicao)).toBeTruthy();
  });

  it("sem nível selecionado, nenhuma definição aparece para o critério", () => {
    render(<Avaliacao inicial={avaliacao()} podeEscrever />);

    expect(screen.queryByText(INFO_NIVEL[2].definicao)).toBeNull();
    expect(screen.queryByText(INFO_NIVEL[0].definicao)).toBeNull();
  });

  it("clicar num nível mostra a definição daquele nível", () => {
    render(<Avaliacao inicial={avaliacao()} podeEscrever />);

    fireEvent.click(botoesDoCriterio(PATROCINIO)[3]);

    expect(screen.getByText(INFO_NIVEL[3].definicao)).toBeTruthy();
  });

  it("erro do servidor ao gravar aparece ao lado do critério que falhou", async () => {
    responderMock.mockResolvedValue({
      error: "Avaliação já concluída.",
      ok: false,
    });
    render(<Avaliacao inicial={avaliacao()} podeEscrever />);

    fireEvent.click(botoesDoCriterio(PORTFOLIO)[1]);

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Avaliação já concluída.");
    // Ao lado do critério: dentro do mesmo bloco da pergunta que falhou, e
    // não no bloco do outro critério.
    const blocoPortfolio = screen.getByText(PORTFOLIO).closest("div")
      ?.parentElement as HTMLElement;
    const blocoPatrocinio = screen.getByText(PATROCINIO).closest("div")
      ?.parentElement as HTMLElement;
    expect(blocoPortfolio.contains(alerta)).toBe(true);
    expect(blocoPatrocinio.contains(alerta)).toBe(false);
  });
});
