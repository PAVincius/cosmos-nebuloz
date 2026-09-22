/** @vitest-environment jsdom */
// funil-mover-pendente.test.tsx — crítica rodada 3, persona Riley: o board não
// travava durante `mover` — um segundo arraste antes da releitura disparava
// outra action sobre a lista velha. E mover terminava em `recarregar()` mudo.
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

const LEAD: LeadRow = {
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
};

function montar(movendo: string | null) {
  const onMover = vi.fn();
  render(
    <Board
      estagios={ESTAGIOS}
      hoje={HOJE}
      leads={[LEAD]}
      movendo={movendo}
      onAbrirEstagio={vi.fn()}
      onAbrirLead={vi.fn()}
      onConverter={vi.fn()}
      onMover={onMover}
      onPerder={vi.fn()}
      podeEscrever
    />
  );
  return { onMover };
}

function arrastarPara(nomeDaColuna: string) {
  const card = screen.getByRole("button", { name: /^Abrir Meridian Corp/ });
  const coluna = screen.getByRole("group", { name: nomeDaColuna });
  fireEvent.dragStart(card, { dataTransfer: { effectAllowed: "" } });
  fireEvent.drop(coluna, { dataTransfer: {} });
  return coluna;
}

describe("Board — mover com pendente", () => {
  it("sem nada em curso, soltar chama onMover uma vez", () => {
    const { onMover } = montar(null);
    arrastarPara("Coluna Descoberta");
    expect(onMover).toHaveBeenCalledTimes(1);
  });

  it("com um lead sendo movido, um novo drop é ignorado e as colunas ficam aria-busy", () => {
    const { onMover } = montar("lead-1");
    const coluna = arrastarPara("Coluna Descoberta");
    expect(onMover).not.toHaveBeenCalled();
    expect(coluna.getAttribute("aria-busy")).toBe("true");
  });
});
