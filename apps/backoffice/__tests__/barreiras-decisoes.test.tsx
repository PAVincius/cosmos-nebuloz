/** @vitest-environment jsdom */
// barreiras-decisoes.test.tsx — [P1] rejeitar um pedido de aprovação e
// concluir uma avaliação de readiness (congela o score) eram um clique.
// Por item: gatilho não chama; alvo escrito; Confirmar chama com o payload;
// Voltar não chama. Em Aprovações, o pendente trava a confirmação e o outro
// gatilho (Aprovar ganhou a própria barreira em barreiras-onda5.test.tsx).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decisao } from "@/app/(staff)/aprovacoes/decisao";
import { Avaliacao } from "@/app/(staff)/growth/readiness/[id]/avaliacao";
import type { AvaliacaoDetalhe } from "@/app/actions/maturidade";
import { RUBRICA_V1 } from "@/lib/growth/maturidade";

const { decidirMock, concluirMock, responderMock, refreshMock } = vi.hoisted(
  () => ({
    concluirMock: vi.fn(),
    decidirMock: vi.fn(),
    refreshMock: vi.fn(),
    responderMock: vi.fn(),
  })
);

vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: decidirMock,
}));

vi.mock("@/app/actions/maturidade", () => ({
  concluirAvaliacao: concluirMock,
  responder: responderMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}));

describe("Aprovações — rejeitar", () => {
  beforeEach(() => {
    decidirMock.mockReset();
    decidirMock.mockResolvedValue({ data: { id: "ap-1" }, ok: true });
  });

  it("o clique em Rejeitar não decide e mostra o alvo", () => {
    render(<Decisao alvo="Desconto 30% · Atlas" canWrite id="ap-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));

    expect(decidirMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Desconto 30% · Atlas/)).toBeTruthy();
  });

  it("Confirmar chama decidePlatformApprovalAction com REJECTED e a nota", async () => {
    render(<Decisao alvo="Desconto 30% · Atlas" canWrite id="ap-1" />);

    fireEvent.change(screen.getByLabelText("Nota da decisão"), {
      target: { value: "Margem abaixo do piso." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(decidirMock).toHaveBeenCalledTimes(1));
    expect(decidirMock).toHaveBeenCalledWith({
      id: "ap-1",
      nota: "Margem abaixo do piso.",
      outcome: "REJECTED",
    });
  });

  it("Voltar não decide", () => {
    render(<Decisao canWrite id="ap-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(decidirMock).not.toHaveBeenCalled();
  });

  it("enquanto decide, a confirmação e o outro gatilho mostram pendente", async () => {
    decidirMock.mockReturnValue(
      new Promise(() => {
        /* pendente de propósito */
      })
    );
    render(<Decisao canWrite id="ap-1" />);

    // Aprovar também passa pela barreira agora (onda 5): o gatilho abre a
    // pergunta, e é o Confirmar que decide.
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const confirmando = await screen.findByRole("button", {
      name: "Executando…",
    });
    expect(confirmando.hasAttribute("disabled")).toBe(true);
    const outro = screen.getByRole("button", { name: "Decidindo…" });
    expect(outro.hasAttribute("disabled")).toBe(true);
  });
});

const AVALIACAO: AvaliacaoDetalhe = {
  autorNome: "Vini",
  concluidaEm: null,
  criadoEm: "2026-09-01T00:00:00.000Z",
  id: "av-1",
  leadId: null,
  leadNome: null,
  nivelGeral: null,
  organizacao: "Atlas Energia",
  respondidos: RUBRICA_V1.criterios.length,
  // Todos respondidos: sem isso não há score e o botão nem habilita.
  respostas: RUBRICA_V1.criterios.map((c) => ({
    criterioId: c.id,
    nivel: 3,
    nota: null,
  })),
  rubricaVersao: RUBRICA_V1.versao,
  scoreGeral: null,
  status: "RASCUNHO",
};

describe("Readiness — concluir avaliação", () => {
  beforeEach(() => {
    concluirMock.mockReset();
    concluirMock.mockResolvedValue({
      data: { id: "av-1", nivelGeral: "GERENCIADO", scoreGeral: 75 },
      ok: true,
    });
    refreshMock.mockReset();
  });

  it("o clique em Concluir não congela e mostra a organização", () => {
    render(<Avaliacao inicial={AVALIACAO} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));

    expect(concluirMock).not.toHaveBeenCalled();
    expect(screen.getByText(/score fica congelado/)).toBeTruthy();
    expect(screen.getAllByText(/Atlas Energia/).length).toBeGreaterThan(0);
  });

  it("Confirmar chama concluirAvaliacao com o id", async () => {
    render(<Avaliacao inicial={AVALIACAO} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(concluirMock).toHaveBeenCalledTimes(1));
    expect(concluirMock).toHaveBeenCalledWith({ avaliacaoId: "av-1" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Voltar não congela", () => {
    render(<Avaliacao inicial={AVALIACAO} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(concluirMock).not.toHaveBeenCalled();
  });
});
