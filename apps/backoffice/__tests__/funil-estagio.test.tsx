/** @vitest-environment jsdom */
// funil-estagio.test.tsx — T6 do funil v2: o painel do estágio (EstagioDialog)
// mostra os 4 cartões calculados a partir de `dados` (sem esperar o servidor),
// o registro de mudanças chega depois (via `lerEstagio`), "Filtrar tabela"
// aplica o filtro do estágio, e "Registrar mudança" (ADMIN) só libera quando
// algo mudou e o motivo tem 20+ caracteres.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstagioDialog } from "@/app/(staff)/funil/estagio-dialog";
import type { DadosFunil } from "@/app/(staff)/funil/funil";
import type { LeadRow } from "@/app/actions/leads";
import type { ConfigEstagio, Transicao } from "@/lib/comercial/funil";

const { lerEstagioMock, atualizarEstagioMock } = vi.hoisted(() => ({
  atualizarEstagioMock: vi.fn(),
  lerEstagioMock: vi.fn(),
}));

vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: atualizarEstagioMock,
  lerEstagio: lerEstagioMock,
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
    criadoEm: "2026-07-01T00:00:00.000Z",
    donoNome: "Vini",
    entrada: "MERIDIAN",
    estagio: "DISCOVERY",
    estagioDesde: "2026-08-20T00:00:00.000Z",
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

// lead-1: ainda em DISCOVERY agora. lead-2: entrou em DISCOVERY e avançou para
// EVALUATION. lead-3: entrou em DISCOVERY e foi perdido lá — os três dentro
// da janela de 90 d, o que dá "1 de 3 avançaram · 1 perdidos".
const LEADS: LeadRow[] = [
  leadFactory({ id: "lead-1", nome: "Meridian Corp" }),
  leadFactory({
    estagio: "EVALUATION",
    estagioDesde: "2026-08-25T00:00:00.000Z",
    id: "lead-2",
    nome: "Scaffold Ltda",
  }),
  leadFactory({
    id: "lead-3",
    motivoPerda: "PRECO",
    nome: "Charter SA",
    notaPerda: "Perdeu para o concorrente.",
    perdidoEm: "2026-07-20T00:00:00.000Z",
    perdidoNoEstagio: "DISCOVERY",
    situacao: "PERDIDO",
  }),
];

const HISTORICO: Transicao[] = [
  {
    de: "LEAD",
    em: "2026-08-20T00:00:00.000Z",
    leadId: "lead-1",
    para: "DISCOVERY",
  },
  {
    de: "LEAD",
    em: "2026-08-01T00:00:00.000Z",
    leadId: "lead-2",
    para: "DISCOVERY",
  },
  {
    de: "DISCOVERY",
    em: "2026-08-25T00:00:00.000Z",
    leadId: "lead-2",
    para: "EVALUATION",
  },
  {
    de: "LEAD",
    em: "2026-07-01T00:00:00.000Z",
    leadId: "lead-3",
    para: "DISCOVERY",
  },
  {
    de: "DISCOVERY",
    em: "2026-07-20T00:00:00.000Z",
    leadId: "lead-3",
    para: "PERDIDO",
  },
];

const DADOS: DadosFunil = {
  canais: [],
  estagios: ESTAGIOS,
  historico: HISTORICO,
  hoje: HOJE.toISOString(),
  leads: LEADS,
};

const MUDANCAS = [
  {
    autorNome: "marina",
    campo: "TETO",
    criadoEm: "2026-05-28T00:00:00.000Z",
    de: "10 d",
    id: "mc-2",
    motivo: "Agenda de CFO raramente cabe em duas semanas.",
    para: "14 d",
  },
  {
    autorNome: "marina",
    campo: "CRITERIOS",
    criadoEm: "2026-04-02T00:00:00.000Z",
    de: "0 itens",
    id: "mc-1",
    motivo: "Sem isso não dá para medir quanto do funil entra pelo assessment.",
    para: "1 itens",
  },
];

function montar(isAdmin = true) {
  const onAbrirLead = vi.fn();
  const onClose = vi.fn();
  const onFiltrar = vi.fn();
  const onRecarregar = vi.fn(() => Promise.resolve());

  render(
    <EstagioDialog
      codigo="DISCOVERY"
      dados={DADOS}
      isAdmin={isAdmin}
      onAbrirLead={onAbrirLead}
      onClose={onClose}
      onFiltrar={onFiltrar}
      onRecarregar={onRecarregar}
      podeEscrever={true}
    />
  );

  return { onAbrirLead, onClose, onFiltrar, onRecarregar };
}

describe("EstagioDialog", () => {
  beforeEach(() => {
    lerEstagioMock.mockReset();
    atualizarEstagioMock.mockReset();
    lerEstagioMock.mockResolvedValue({
      data: {
        config: {
          codigo: "DISCOVERY",
          criterios: [],
          pesoPercent: 30,
          tetoDias: 14,
        },
        mudancas: MUDANCAS,
      },
      ok: true,
    });
  });

  it("mostra os 4 cartões a partir de `dados` e o registro de mudanças depois de lerEstagio resolver", async () => {
    montar();

    expect(screen.getByText(/1 de 3 avançaram · 1 perdidos/)).toBeTruthy();

    expect(await screen.findByText(/Agenda de CFO/)).toBeTruthy();
    expect(screen.getByText(/Sem isso não dá para medir/)).toBeTruthy();
  });

  it("clicar num lead da lista chama onAbrirLead com o id dele", async () => {
    const { onAbrirLead } = montar();
    await screen.findByText(/Agenda de CFO/);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir lead Meridian Corp" })
    );

    expect(onAbrirLead).toHaveBeenCalledWith("lead-1");
  });

  it("'Filtrar tabela' chama onFiltrar com o código do estágio", async () => {
    const { onFiltrar } = montar();
    await screen.findByText(/Agenda de CFO/);

    fireEvent.click(screen.getByRole("button", { name: "Filtrar tabela" }));

    expect(onFiltrar).toHaveBeenCalledWith("DISCOVERY");
  });

  it("ADMIN: Registrar mudança só libera com peso alterado e motivo válido; grava com os campos certos", async () => {
    atualizarEstagioMock.mockResolvedValue({
      data: { codigo: "DISCOVERY" },
      ok: true,
    });
    const { onRecarregar } = montar(true);
    await screen.findByText(/Agenda de CFO/);

    fireEvent.click(screen.getByRole("button", { name: "Editar estágio" }));

    const registrar = screen.getByRole("button", { name: "Registrar mudança" });
    expect(registrar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Peso (%)"), {
      target: { value: "35" },
    });
    expect(registrar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Por que muda"), {
      target: { value: "curto" },
    });
    expect(registrar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Por que muda"), {
      target: {
        value: "Leads em avaliação com capacidade simulada fecham mais.",
      },
    });
    expect(registrar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(registrar);

    expect(atualizarEstagioMock).toHaveBeenCalledWith({
      codigo: "DISCOVERY",
      criterios: [],
      motivo: "Leads em avaliação com capacidade simulada fecham mais.",
      pesoPercent: 35,
      tetoDias: 14,
    });
    await screen.findByRole("button", { name: "Editar estágio" });
    expect(onRecarregar).toHaveBeenCalled();
  });

  it("sem isAdmin não mostra o formulário de edição", async () => {
    montar(false);
    await screen.findByText(/Agenda de CFO/);

    expect(screen.queryByRole("button", { name: "Editar estágio" })).toBeNull();
  });
});
