/** @vitest-environment jsdom */
// funil-board.test.tsx — o board é arrastar-e-soltar; o que se prova aqui é
// que soltar em cada alvo dispara exatamente a ação certa (e nenhuma quando a
// regra recusa), e que sem `podeEscrever` nenhum card fica arrastável.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "@/app/(staff)/funil/board";
import type { LeadRow } from "@/app/actions/leads";
import type { ConfigEstagio } from "@/lib/comercial/funil";

const HOJE = new Date("2026-09-06T12:00:00.000Z");

const ESTAGIOS: ConfigEstagio[] = [
  { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
  { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
  { codigo: "EVALUATION", criterios: [], pesoPercent: 60, tetoDias: 21 },
  { codigo: "PROPOSAL", criterios: [], pesoPercent: 80, tetoDias: 30 },
];

function leadFactory(over: Partial<LeadRow>): LeadRow {
  return {
    acvEstimadoCentavos: 500_000,
    canal: { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
    contatoEmail: "ana@meridian.com",
    contatoNome: "Ana",
    criadoEm: "2026-09-01T00:00:00.000Z",
    donoNome: "Vini",
    entrada: "MERIDIAN",
    estagio: "LEAD",
    estagioDesde: "2026-09-01T00:00:00.000Z",
    id: "lead-1",
    motivoPerda: null,
    nome: "Meridian Corp",
    notaPerda: null,
    origem: null,
    perdidoEm: null,
    perdidoNoEstagio: null,
    proposta: null,
    proximaAcao: "Ligar",
    proximaAcaoEm: "2026-09-10T00:00:00.000Z",
    situacao: "ATIVO",
    ...over,
  };
}

const LEAD_EM_LEAD = leadFactory({
  estagio: "LEAD",
  id: "lead-1",
  nome: "Meridian Corp",
});
const LEAD_EM_AVALIACAO = leadFactory({
  estagio: "EVALUATION",
  id: "lead-2",
  nome: "Scaffold Ltda",
});

function montar(podeEscrever: boolean) {
  const onAbrirEstagio = vi.fn();
  const onAbrirLead = vi.fn();
  const onMover = vi.fn();
  const onConverter = vi.fn();
  const onPerder = vi.fn();

  render(
    <Board
      estagios={ESTAGIOS}
      hoje={HOJE}
      leads={[LEAD_EM_LEAD, LEAD_EM_AVALIACAO]}
      onAbrirEstagio={onAbrirEstagio}
      onAbrirLead={onAbrirLead}
      onConverter={onConverter}
      onMover={onMover}
      onPerder={onPerder}
      podeEscrever={podeEscrever}
    />
  );

  return { onAbrirEstagio, onAbrirLead, onConverter, onMover, onPerder };
}

describe("Board", () => {
  it("soltar um card em outra coluna aberta chama onMover", () => {
    const { onMover, onConverter, onPerder } = montar(true);

    const card = screen.getByRole("button", {
      name: /^Abrir Meridian Corp/,
    });
    const coluna = screen.getByRole("group", { name: "Coluna Descoberta" });

    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(coluna, { dataTransfer: {} });

    expect(onMover).toHaveBeenCalledWith("lead-1", "DISCOVERY");
    expect(onConverter).not.toHaveBeenCalled();
    expect(onPerder).not.toHaveBeenCalled();
  });

  it("soltar um lead em Avaliação na coluna Proposta chama onConverter", () => {
    const { onConverter, onMover } = montar(true);

    const card = screen.getByRole("button", {
      name: /^Abrir Scaffold Ltda/,
    });
    const coluna = screen.getByRole("group", { name: "Coluna Proposta" });

    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(coluna, { dataTransfer: {} });

    expect(onConverter).toHaveBeenCalledWith("lead-2");
    expect(onMover).not.toHaveBeenCalled();
  });

  it("soltar um lead que não está em Avaliação na coluna Proposta recusa com mensagem", () => {
    const { onConverter, onMover } = montar(true);

    const card = screen.getByRole("button", {
      name: /^Abrir Meridian Corp/,
    });
    const coluna = screen.getByRole("group", { name: "Coluna Proposta" });

    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(coluna, { dataTransfer: {} });

    expect(onConverter).not.toHaveBeenCalled();
    expect(onMover).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Só um lead em Avaliação vira proposta/)
    ).toBeTruthy();
  });

  it("soltar em Ganho não chama nada — a zona não é alvo de drop", () => {
    const { onMover, onConverter, onPerder } = montar(true);

    const card = screen.getByRole("button", {
      name: /^Abrir Meridian Corp/,
    });
    const zonaDeGanho = screen.getByRole("group", {
      name: "Ganho vem da proposta aceita",
    });

    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(zonaDeGanho, { dataTransfer: {} });

    expect(onMover).not.toHaveBeenCalled();
    expect(onConverter).not.toHaveBeenCalled();
    expect(onPerder).not.toHaveBeenCalled();
    // Aceitar o arraste para recusar em seguida era o defeito (onda 8a).
    expect(screen.queryByText(/Ganho só via proposta aceita/)).toBeNull();
  });

  it("soltar em Perdido chama onPerder", () => {
    const { onPerder } = montar(true);

    const card = screen.getByRole("button", {
      name: /^Abrir Meridian Corp/,
    });
    const zonaDePerdido = screen.getByRole("group", {
      name: "Soltar para marcar perdido",
    });

    fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
    fireEvent.drop(zonaDePerdido, { dataTransfer: {} });

    expect(onPerder).toHaveBeenCalledWith("lead-1");
  });

  it("sem podeEscrever nenhum card fica arrastável", () => {
    montar(false);

    const cards = screen.getAllByRole("button", { name: /^Abrir (?!estágio)/ });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute("draggable")).not.toBe("true");
    }
  });

  it("card em Proposta não fica arrastável mesmo com podeEscrever — o servidor sempre recusa mover quem já tem proposta", () => {
    const leadEmProposta = leadFactory({
      estagio: "PROPOSAL",
      id: "lead-3",
      nome: "Charter SA",
      proposta: {
        id: "p-1",
        numero: "P-1",
        status: "ENVIADA",
        acvCentavos: 100_000,
        tenantProvisionadoSlug: null,
      },
    });

    render(
      <Board
        estagios={ESTAGIOS}
        hoje={HOJE}
        leads={[LEAD_EM_LEAD, leadEmProposta]}
        onAbrirEstagio={vi.fn()}
        onAbrirLead={vi.fn()}
        onConverter={vi.fn()}
        onMover={vi.fn()}
        onPerder={vi.fn()}
        podeEscrever={true}
      />
    );

    const cardProposta = screen.getByRole("button", {
      name: /^Abrir Charter SA/,
    });
    expect(cardProposta.getAttribute("draggable")).not.toBe("true");

    const cardLead = screen.getByRole("button", {
      name: /^Abrir Meridian Corp/,
    });
    expect(cardLead.getAttribute("draggable")).toBe("true");
  });
});
