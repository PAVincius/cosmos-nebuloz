/** @vitest-environment jsdom */
// busca-acha-a-pagina-2.test.tsx — crítica rodada 6. A busca da carteira e
// o "Exigem atenção" filtravam só o carregado, e o "N de M" usava M = os
// carregados: com 140 clientes, o 101º não existia para a busca. Agora,
// quando há mais do que está na tela, a busca pergunta ao servidor (com
// espera de digitação e resposta velha descartada) e o filtro de atenção é
// do servidor. Propostas ganha a mesma busca, e `?enviada=` sai da URL
// depois de dito.
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientesTabela, KpiAtencao } from "@/app/(staff)/clientes-tabela";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import type { ClientRow } from "@/app/actions/clients";
import type { ProposalRow } from "@/app/actions/proposals";
import type { Pagina } from "@/lib/paginacao";
import type { Result } from "@/lib/safe-action";
import {
  replaceMock,
  replaceStateMock,
  zerarRoteador,
} from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listClients: vi.fn(),
  listProposals: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/agregados", () => import("../vitest-mocks/agregados"));
vi.mock("@/app/actions/clients", () => ({ listClients: mocks.listClients }));
vi.mock("@/app/actions/proposals", () => ({
  listProposals: mocks.listProposals,
  submitProposalAction: vi.fn(),
}));

vi.setConfig({ testTimeout: 20_000 });

function cliente(i: number, over: Partial<ClientRow> = {}): ClientRow {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: `t${i}`,
    memberCount: 1,
    modules: [],
    name: `Cliente ${i}`,
    plan: "ORBIT",
    slug: `cliente-${i}`,
    ...over,
  };
}

function proposta(i: number, over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    acvCentavos: 100,
    cliente: "Atlas Energia",
    criadoEm: "2026-09-01T00:00:00.000Z",
    descontoPercent: 0,
    id: `prop-${i}`,
    numero: `P-${i}`,
    status: "ENVIADA",
    titulo: `Proposta ${i}`,
    totalCentavos: 100,
    ...over,
  };
}

const CEM_CLIENTES = Array.from({ length: 100 }, (_, i) => cliente(i));
const CEM_PROPOSTAS = Array.from({ length: 100 }, (_, i) => proposta(i));

function pagina<T>(itens: T[], temMais = false): Result<Pagina<T>> {
  return { data: { itens, temMais }, ok: true };
}

function digitar(rotulo: string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/clientes");
});

describe("Carteira — busca com mais do que está na tela", () => {
  it("vai ao servidor e acha o cliente que não estava carregado", async () => {
    mocks.listClients.mockResolvedValue(
      pagina([cliente(120, { name: "Zeta Mineração", slug: "zeta" })])
    );
    render(<ClientesTabela clientes={CEM_CLIENTES} temMais total={140} />);

    digitar("Buscar cliente", "zeta");

    expect(await screen.findByText("Zeta Mineração")).toBeTruthy();
    expect(mocks.listClients).toHaveBeenCalledTimes(1);
    expect(mocks.listClients).toHaveBeenCalledWith({
      busca: "zeta",
      pagina: 1,
    });
    // M é a carteira inteira, não os 100 carregados.
    expect(screen.getByText("1 de 140")).toBeTruthy();
  });

  it("com a carteira inteira na tela, filtra no navegador e não pergunta ao servidor", async () => {
    render(
      <ClientesTabela
        clientes={[cliente(1, { name: "Vanta" }), cliente(2)]}
        temMais={false}
        total={2}
      />
    );

    digitar("Buscar cliente", "vanta");

    expect(screen.getByText("1 de 2")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 400));
    expect(mocks.listClients).not.toHaveBeenCalled();
  });

  it("resposta de um termo que já mudou não pinta a lista do termo novo", async () => {
    const pendentes: Record<string, (r: Result<Pagina<ClientRow>>) => void> =
      {};
    mocks.listClients.mockImplementation(
      ({ busca }: { busca: string }) =>
        new Promise((resolver) => {
          pendentes[busca] = resolver;
        })
    );
    render(<ClientesTabela clientes={CEM_CLIENTES} temMais total={140} />);

    digitar("Buscar cliente", "atlas");
    await waitFor(() => expect(pendentes.atlas).toBeDefined());
    digitar("Buscar cliente", "boreal");
    await waitFor(() => expect(pendentes.boreal).toBeDefined());

    await act(async () => {
      pendentes.boreal(pagina([cliente(130, { name: "Boreal Agro" })]));
    });
    await act(async () => {
      pendentes.atlas(pagina([cliente(131, { name: "Atlas Remoto" })]));
    });

    expect(screen.getByText("Boreal Agro")).toBeTruthy();
    expect(screen.queryByText("Atlas Remoto")).toBeNull();
  });

  it("falha do servidor é dita, e a lista diz que é só o carregado", async () => {
    mocks.listClients.mockResolvedValue({ error: "banco fora", ok: false });
    render(<ClientesTabela clientes={CEM_CLIENTES} temMais total={140} />);

    digitar("Buscar cliente", "zeta");

    expect(
      await screen.findByText(/Não foi possível buscar em toda a carteira/)
    ).toBeTruthy();
    expect(screen.getByText(/banco fora/)).toBeTruthy();
  });

  it("com ?atencao=1, a busca no servidor leva o filtro junto", async () => {
    zerarRoteador("/clientes", "atencao=1");
    mocks.listClients.mockResolvedValue(pagina([]));
    render(<ClientesTabela clientes={CEM_CLIENTES} temMais total={140} />);

    digitar("Buscar cliente", "zeta");

    await waitFor(() =>
      expect(mocks.listClients).toHaveBeenCalledWith({
        atencao: true,
        busca: "zeta",
        pagina: 1,
      })
    );
  });
});

describe("Carteira — Exigem atenção filtra no servidor", () => {
  it("o KPI navega (o servidor relê a lista), não só troca a URL", () => {
    render(<KpiAtencao valor={9} />);

    fireEvent.click(screen.getByRole("button", { name: /Exigem atenção/ }));

    expect(replaceMock).toHaveBeenCalledWith("/clientes?atencao=1", {
      scroll: false,
    });
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it("a página lê ?atencao=1 e pede a lista já filtrada", async () => {
    mocks.listClients.mockResolvedValue(pagina([cliente(1)]));
    const { default: Page } = await import("@/app/(staff)/clientes/page");

    render(await Page({ searchParams: Promise.resolve({ atencao: "1" }) }));

    expect(mocks.listClients).toHaveBeenCalledWith({
      atencao: true,
      pagina: 1,
    });
    expect(screen.getByText("Cliente 1")).toBeTruthy();
  });

  it("Mostrar mais com ?atencao=1 pede a próxima página já filtrada", async () => {
    zerarRoteador("/clientes", "atencao=1");
    mocks.listClients.mockResolvedValue(pagina([]));
    render(<ClientesTabela clientes={CEM_CLIENTES} temMais total={140} />);

    fireEvent.click(screen.getByRole("button", { name: /Mostrar mais/ }));

    await waitFor(() =>
      expect(mocks.listClients).toHaveBeenCalledWith({
        atencao: true,
        pagina: 2,
      })
    );
  });
});

describe("Propostas — ?q= no servidor", () => {
  beforeEach(() => zerarRoteador("/propostas"));

  it("com mais do que está na tela, busca por título ou cliente no servidor", async () => {
    mocks.listProposals.mockResolvedValue(
      pagina([proposta(120, { titulo: "Boreal — assessment" })])
    );
    render(
      <Propostas
        iniciais={CEM_PROPOSTAS}
        podeEscrever={false}
        temMais
        total={140}
      />
    );

    digitar("Buscar proposta", "boreal");

    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      "/propostas?q=boreal"
    );
    expect(await screen.findByText("Boreal — assessment")).toBeTruthy();
    expect(mocks.listProposals).toHaveBeenCalledWith({
      busca: "boreal",
      pagina: 1,
    });
    expect(screen.getByText("1 de 140")).toBeTruthy();
  });

  it("?q= na URL já entra buscando (F5 mantém)", async () => {
    zerarRoteador("/propostas", "q=boreal");
    mocks.listProposals.mockResolvedValue(
      pagina([proposta(120, { titulo: "Boreal — assessment" })])
    );
    render(
      <Propostas
        iniciais={CEM_PROPOSTAS}
        podeEscrever={false}
        temMais
        total={140}
      />
    );

    expect(await screen.findByText("Boreal — assessment")).toBeTruthy();
  });
});

describe("Propostas — ?enviada= sai da URL depois de dito", () => {
  it("a frase fica, o param some — F5 não repete o envio", () => {
    zerarRoteador("/propostas", "enviada=prop-1");
    render(
      <Propostas
        iniciais={[proposta(1, { titulo: "Atlas — plataforma" })]}
        podeEscrever
      />
    );

    expect(
      screen.getByText(/Proposta «Atlas — plataforma» enviada/)
    ).toBeTruthy();
    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/propostas");
    expect(
      screen.getByText(/Proposta «Atlas — plataforma» enviada/)
    ).toBeTruthy();
  });
});
