/** @vitest-environment jsdom */
// busca.test.tsx — busca por texto na carteira e no funil, em `?q=`.
//
// A lista já está no cliente; o que faltava era um lugar para digitar. O
// valor mora na URL (modo raso): F5 mantém, e "olha esses" vira link. O KPI
// "Exigem atenção" da carteira é o outro filtro — botão com `aria-pressed`
// que aplica `?atencao=1`.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientesTabela, KpiAtencao } from "@/app/(staff)/clientes-tabela";
import { type DadosFunil, Funil } from "@/app/(staff)/funil/funil";
import type { ClientRow } from "@/app/actions/clients";
import type { LeadRow } from "@/app/actions/leads";
import {
  replaceStateMock,
  zerarRoteador,
} from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/clients", () => ({ listClients: vi.fn() }));
vi.mock("@/app/actions/leads", () => ({
  converterEmProposta: vi.fn(),
  criarLead: vi.fn(),
  listarFunil: vi.fn(),
  marcarPerdido: vi.fn(),
  moverEstagio: vi.fn(),
  registrarProximaAcao: vi.fn(),
}));
vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: vi.fn(),
}));

function cliente(over: Partial<ClientRow>): ClientRow {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "c-1",
    memberCount: 1,
    modules: [],
    name: "Atlas Energia",
    plan: "ORBIT",
    slug: "atlas",
    ...over,
  };
}

const CLIENTES = [
  cliente({ id: "c-1", name: "Atlas Energia", slug: "atlas" }),
  cliente({
    id: "c-2",
    modules: [{ expiresAt: null, module: "COSMOS", status: "SUSPENDED" }],
    name: "Vanta Saúde",
    slug: "vanta",
  }),
];

function linhasDaTabela() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

function lead(over: Partial<LeadRow>): LeadRow {
  return {
    acvEstimadoCentavos: 500_000,
    canal: null,
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
    proximaAcaoEm: null,
    situacao: "ATIVO",
    ...over,
  };
}

const DADOS: DadosFunil = {
  canais: [],
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
      contatoEmail: "joao@charter.com",
      contatoNome: "João",
      donoNome: "Bia",
      id: "lead-2",
      nome: "Charter SA",
    }),
  ],
};

beforeEach(() => {
  zerarRoteador("/");
});

describe("Carteira — busca por nome ou slug", () => {
  it("digitar filtra as linhas, escreve ?q= e conta N de M", () => {
    render(<ClientesTabela clientes={CLIENTES} />);
    expect(linhasDaTabela()).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Buscar cliente"), {
      target: { value: "van" },
    });

    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/?q=van");
    expect(linhasDaTabela()).toHaveLength(1);
    expect(screen.getByText("Vanta Saúde")).toBeTruthy();
    expect(screen.getByText("1 de 2")).toBeTruthy();
  });

  it("acha pelo slug e ignora acento e caixa", () => {
    render(<ClientesTabela clientes={CLIENTES} />);

    fireEvent.change(screen.getByLabelText("Buscar cliente"), {
      target: { value: "SAUDE" },
    });
    expect(linhasDaTabela()).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Buscar cliente"), {
      target: { value: "atl" },
    });
    expect(screen.getByText("Atlas Energia")).toBeTruthy();
    expect(linhasDaTabela()).toHaveLength(1);
  });

  it("?q= na URL já entra filtrado (F5 mantém), e Limpar apaga o param", () => {
    zerarRoteador("/", "q=van");
    render(<ClientesTabela clientes={CLIENTES} />);

    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      (screen.getByLabelText("Buscar cliente") as HTMLInputElement).value
    ).toBe("van");

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));

    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/");
    expect(linhasDaTabela()).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  });

  it("busca sem resultado diz o que procurou e oferece limpar", () => {
    render(<ClientesTabela clientes={CLIENTES} />);
    fireEvent.change(screen.getByLabelText("Buscar cliente"), {
      target: { value: "zzz" },
    });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/Nenhum cliente com “zzz”/)).toBeTruthy();
    expect(screen.getByText("0 de 2")).toBeTruthy();
  });

  it("o plano aparece com rótulo, não com o enum", () => {
    render(<ClientesTabela clientes={CLIENTES} />);
    expect(screen.getAllByText("Orbit")).toHaveLength(2);
    expect(screen.queryByText("ORBIT")).toBeNull();
  });
});

describe("Carteira — KPI Exigem atenção filtra", () => {
  function montar() {
    return render(
      <>
        <KpiAtencao valor={1} />
        <ClientesTabela clientes={CLIENTES} />
      </>
    );
  }

  it("é botão com aria-pressed; clicar aplica ?atencao=1 e deixa só quem tem módulo suspenso", () => {
    montar();
    const kpi = screen.getByRole("button", { name: /Exigem atenção/ });
    expect(kpi.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(kpi);

    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/?atencao=1");
    expect(kpi.getAttribute("aria-pressed")).toBe("true");
    expect(linhasDaTabela()).toHaveLength(1);
    expect(screen.getByText("Vanta Saúde")).toBeTruthy();

    fireEvent.click(kpi);
    expect(kpi.getAttribute("aria-pressed")).toBe("false");
    expect(linhasDaTabela()).toHaveLength(2);
  });

  it("?atencao=1 na URL já entra pressionado e filtrado", () => {
    zerarRoteador("/", "atencao=1");
    montar();
    expect(
      screen
        .getByRole("button", { name: /Exigem atenção/ })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(linhasDaTabela()).toHaveLength(1);
  });

  it("busca e atenção compõem", () => {
    zerarRoteador("/", "atencao=1&q=atlas");
    montar();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("0 de 2")).toBeTruthy();
  });
});

describe("Funil — busca por nome, contato ou dono", () => {
  function nomesNoBoard(nome: string) {
    return screen.getAllByText(nome).length;
  }

  it("?q= filtra cards e tabela e escreve na URL ao digitar", () => {
    zerarRoteador("/funil");
    render(<Funil inicial={DADOS} podeEscrever={false} />);
    // Board e tabela: cada lead aparece duas vezes.
    expect(nomesNoBoard("Meridian Corp")).toBe(2);
    expect(nomesNoBoard("Charter SA")).toBe(2);

    fireEvent.change(screen.getByLabelText("Buscar lead"), {
      target: { value: "charter" },
    });

    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/funil?q=charter");
    expect(screen.queryByText("Meridian Corp")).toBeNull();
    expect(nomesNoBoard("Charter SA")).toBe(2);
    expect(screen.getByText("1 de 2")).toBeTruthy();
  });

  it("acha pelo contato e pelo dono", () => {
    zerarRoteador("/funil", "q=joao");
    render(<Funil inicial={DADOS} podeEscrever={false} />);
    expect(screen.queryByText("Meridian Corp")).toBeNull();
    expect(nomesNoBoard("Charter SA")).toBe(2);

    fireEvent.change(screen.getByLabelText("Buscar lead"), {
      target: { value: "vini" },
    });
    expect(screen.queryByText("Charter SA")).toBeNull();
    expect(nomesNoBoard("Meridian Corp")).toBe(2);
  });

  it("busca preserva o filtro de estágio e vice-versa", () => {
    zerarRoteador("/funil", "estagio=DISCOVERY");
    render(<Funil inicial={DADOS} podeEscrever={false} />);

    fireEvent.change(screen.getByLabelText("Buscar lead"), {
      target: { value: "charter" },
    });
    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      "/funil?estagio=DISCOVERY&q=charter"
    );
  });

  it("lead ganho diz Cliente, não Tenant", () => {
    zerarRoteador("/funil");
    render(
      <Funil
        inicial={{
          ...DADOS,
          leads: [
            lead({
              proposta: {
                acvCentavos: 1,
                id: "p",
                numero: "P-1",
                status: "ACEITA",
                tenantProvisionadoSlug: "meridian",
              },
              situacao: "GANHO",
            }),
          ],
        }}
        podeEscrever={false}
      />
    );
    expect(screen.getByText("Cliente meridian")).toBeTruthy();
    expect(screen.queryByText(/Tenant/)).toBeNull();
  });
});
