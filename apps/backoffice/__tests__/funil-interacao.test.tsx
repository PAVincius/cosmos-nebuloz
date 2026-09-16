/** @vitest-environment jsdom */
// funil-interacao.test.tsx — o board e o diálogo do lead não prometem o que
// não fazem.
//
// 1. Card em PROPOSAL não arrasta (o servidor recusa mover lead com
//    proposta), mas tinha `cursor: grab` — a mão que promete e não entrega.
// 2. Coluna vazia dizia só "Vazio"; agora diz o que cai nela.
// 3. Os links internos do diálogo eram `<a href>` cru: recarga completa da
//    aplicação a cada clique. Viram `Link` do Next — o `next/link` é mockado
//    aqui para marcar o `<a>` que passa por ele; um `<a>` cru não teria a
//    marca.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "@/app/(staff)/funil/board";
import {
  BlocoFechado,
  BlocoProposta,
} from "@/app/(staff)/funil/lead-dialog-partes";
import type { LeadRow } from "@/app/actions/leads";
import type { ConfigEstagio } from "@/lib/comercial/funil";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a data-next-link="" href={href} {...rest}>
      {children}
    </a>
  ),
}));

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

const PROPOSTA = {
  acvCentavos: 500_000,
  id: "prop-9",
  numero: "P-0009",
  status: "ENVIADA",
  tenantProvisionadoSlug: null,
};

function montarBoard(leads: LeadRow[]) {
  render(
    <Board
      estagios={ESTAGIOS}
      hoje={HOJE}
      leads={leads}
      onAbrirEstagio={vi.fn()}
      onAbrirLead={vi.fn()}
      onConverter={vi.fn()}
      onMover={vi.fn()}
      onPerder={vi.fn()}
      podeEscrever
    />
  );
}

describe("Board — cursor e coluna vazia", () => {
  it("card em PROPOSAL não tem cursor grab; card arrastável tem", () => {
    montarBoard([
      leadFactory({ id: "l1", nome: "Em Lead" }),
      leadFactory({
        estagio: "PROPOSAL",
        id: "l2",
        nome: "Em Proposta",
        proposta: PROPOSTA,
      }),
    ]);

    const emLead = screen.getByRole("button", { name: "Abrir lead Em Lead" });
    const emProposta = screen.getByRole("button", {
      name: "Abrir lead Em Proposta",
    });
    expect(emLead.style.cursor).toBe("grab");
    expect(emProposta.style.cursor).not.toBe("grab");
    expect(emProposta.getAttribute("draggable")).toBe("false");
  });

  it("coluna vazia diz o que cai nela, não só 'Vazio'", () => {
    montarBoard([leadFactory({ id: "l1", nome: "Em Lead" })]);

    expect(screen.queryByText("Vazio")).toBeNull();
    const descoberta = screen.getByRole("group", { name: "Coluna Descoberta" });
    expect(descoberta.textContent).toMatch(/Primeira conversa feita/);
  });
});

describe("Lead dialog — links internos passam pelo Link do Next", () => {
  it("BlocoProposta: 'Abrir proposta' é Link com href da proposta", () => {
    render(
      <BlocoProposta
        lead={leadFactory({ estagio: "PROPOSAL", proposta: PROPOSTA })}
      />
    );

    const link = screen.getByRole("link", { name: "Abrir proposta" });
    expect(link.getAttribute("href")).toBe("/propostas/prop-9");
    expect(link.hasAttribute("data-next-link")).toBe(true);
  });

  it("BlocoFechado ganho: 'Abrir cliente' é Link com href do cliente", () => {
    render(
      <BlocoFechado
        lead={leadFactory({
          estagio: "PROPOSAL",
          proposta: { ...PROPOSTA, tenantProvisionadoSlug: "acme" },
          situacao: "GANHO",
        })}
      />
    );

    const link = screen.getByRole("link", { name: "Abrir cliente" });
    expect(link.getAttribute("href")).toBe("/clientes/acme");
    expect(link.hasAttribute("data-next-link")).toBe(true);
  });
});
