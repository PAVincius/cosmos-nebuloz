/** @vitest-environment jsdom */
// funil-url.test.tsx — lead aberto e filtro de estágio do funil vivem em
// `?lead=` e `?estagio=`. Abrir a URL com o param já mostra o diálogo/filtro;
// clicar escreve na URL preservando os demais params; id ou estágio
// inexistente cai no estado padrão sem erro.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DadosFunil, Funil } from "@/app/(staff)/funil/funil";
import type { LeadRow } from "@/app/actions/leads";
import { replaceMock, zerarRoteador } from "../vitest-mocks/next-navigation";

const { listarFunilMock } = vi.hoisted(() => ({ listarFunilMock: vi.fn() }));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/leads", () => ({
  converterEmProposta: vi.fn(),
  criarLead: vi.fn(),
  listarFunil: listarFunilMock,
  marcarPerdido: vi.fn(),
  moverEstagio: vi.fn(),
  registrarProximaAcao: vi.fn(),
}));

vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: vi.fn(),
}));

function lead(over: Partial<LeadRow>): LeadRow {
  return {
    acvEstimadoCentavos: 500_000,
    canal: { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
    contatoEmail: "ana@meridian.com",
    contatoNome: "Ana",
    criadoEm: "2026-07-01T00:00:00.000Z",
    donoNome: "Vini",
    entrada: "MERIDIAN",
    estagio: "DISCOVERY",
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

const DADOS: DadosFunil = {
  canais: [{ cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" }],
  estagios: [
    { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
    { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
    { codigo: "EVALUATION", criterios: [], pesoPercent: 60, tetoDias: 21 },
    { codigo: "PROPOSAL", criterios: [], pesoPercent: 80, tetoDias: 30 },
  ],
  historico: [],
  hoje: "2026-09-06T12:00:00.000Z",
  leads: [
    lead({ id: "lead-1", nome: "Meridian Corp" }),
    lead({
      id: "lead-2",
      motivoPerda: "PRECO",
      nome: "Charter SA",
      perdidoEm: "2026-08-20T00:00:00.000Z",
      perdidoNoEstagio: "DISCOVERY",
      situacao: "PERDIDO",
    }),
  ],
};

function montar() {
  return render(<Funil inicial={DADOS} podeEscrever={false} />);
}

/** O board também tem "Abrir lead …"; a tabela é o caminho da persona. */
function botaoDaTabela(nome: string) {
  return within(screen.getByRole("table")).getByRole("button", {
    name: `Abrir lead ${nome}`,
  });
}

beforeEach(() => {
  zerarRoteador("/funil");
  listarFunilMock.mockReset().mockResolvedValue({ data: DADOS, ok: true });
});

describe("Funil — lead e estágio na URL", () => {
  it("?lead=lead-1 já abre o diálogo do lead", () => {
    zerarRoteador("/funil", "lead=lead-1");
    montar();

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText("Meridian Corp")).toBeTruthy();
  });

  it("sem param, nenhum diálogo aberto", () => {
    montar();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("?lead= com id inexistente não abre diálogo, sem erro", () => {
    zerarRoteador("/funil", "lead=nao-existe");
    montar();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abrir um lead pela tabela escreve ?lead= preservando os outros params, e o diálogo abre", () => {
    zerarRoteador("/funil", "estagio=DISCOVERY");
    montar();

    fireEvent.click(botaoDaTabela("Meridian Corp"));

    expect(replaceMock).toHaveBeenCalledWith(
      "/funil?estagio=DISCOVERY&lead=lead-1",
      { scroll: false }
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("?estagio=PERDIDOS já entra filtrado, com o chip marcado", () => {
    zerarRoteador("/funil", "estagio=PERDIDOS");
    montar();

    expect(screen.getByText("1 de 2 leads")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Perdidos" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      within(screen.getByRole("table")).queryByRole("button", {
        name: "Abrir lead Meridian Corp",
      })
    ).toBeNull();
  });

  it("estágio desconhecido no param vale como Todos", () => {
    zerarRoteador("/funil", "estagio=nao-existe");
    montar();

    expect(screen.getByText("2 de 2 leads")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Todos" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("clicar num chip escreve ?estagio= preservando os outros params", () => {
    zerarRoteador("/funil", "q=meridian");
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Ganhos" }));

    expect(replaceMock).toHaveBeenCalledWith(
      "/funil?q=meridian&estagio=GANHOS",
      { scroll: false }
    );
    expect(screen.getByText("0 de 2 leads")).toBeTruthy();
  });

  it("chip Todos remove o param", () => {
    zerarRoteador("/funil", "estagio=GANHOS");
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Todos" }));

    expect(replaceMock).toHaveBeenCalledWith("/funil", { scroll: false });
  });
});
