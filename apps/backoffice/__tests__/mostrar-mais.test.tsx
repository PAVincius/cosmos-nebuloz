/** @vitest-environment jsdom */
// mostrar-mais.test.tsx — as listas param no teto e oferecem a próxima página.
//
// A primeira página chega do servidor pela forma antiga (array) nas telas
// cujo `page.tsx` não pagina; a regra é a mesma em todas: página cheia
// oferece "Mostrar mais", e a partir daí a action responde `{ itens, temMais }`
// e o botão some quando acaba. Depois de uma escrita, a tela relê as páginas
// que já carregou, em vez de voltar à primeira.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientesTabela } from "@/app/(staff)/clientes-tabela";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { type DadosFunil, Funil } from "@/app/(staff)/funil/funil";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import type { ClientRow } from "@/app/actions/clients";
import type { EngagementRow } from "@/app/actions/engagements";
import type { LeadRow } from "@/app/actions/leads";
import type { ProposalRow } from "@/app/actions/proposals";
import { TETO_DA_LISTA } from "@/lib/paginacao";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listClients: vi.fn(),
  listEngagements: vi.fn(),
  listProposals: vi.fn(),
  listarFunil: vi.fn(),
  setEngagementStatusAction: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/clients", () => ({ listClients: mocks.listClients }));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: vi.fn(),
  listEngagements: mocks.listEngagements,
  setEngagementStatusAction: mocks.setEngagementStatusAction,
}));
vi.mock("@/app/actions/proposals", () => ({
  listProposals: mocks.listProposals,
  submitProposalAction: vi.fn(),
}));
vi.mock("@/app/actions/leads", () => ({
  converterEmProposta: vi.fn(),
  criarLead: vi.fn(),
  listarFunil: mocks.listarFunil,
  marcarPerdido: vi.fn(),
  moverEstagio: vi.fn(),
  registrarProximaAcao: vi.fn(),
}));
vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: vi.fn(),
  lerEstagio: vi.fn(),
}));

function cliente(i: number): ClientRow {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: `c-${i}`,
    memberCount: 1,
    modules: [],
    name: `Cliente ${i}`,
    plan: "ORBIT",
    slug: `cliente-${i}`,
  };
}

function engajamento(i: number): EngagementRow {
  return {
    clienteNome: "Atlas",
    clienteSlug: "atlas",
    codigo: `ENG-${i}`,
    fimEm: null,
    id: `e-${i}`,
    inicioEm: null,
    nome: `Engajamento ${i}`,
    proximos: ["ATIVO"],
    status: "PROPOSTO",
    valorCentavos: 100,
  };
}

function proposta(i: number): ProposalRow {
  return {
    acvCentavos: 100,
    cliente: "Atlas",
    criadoEm: "2026-09-01T00:00:00.000Z",
    descontoPercent: 0,
    id: `p-${i}`,
    numero: `P-${i}`,
    status: "RASCUNHO",
    titulo: `Proposta ${i}`,
    totalCentavos: 100,
  };
}

function lead(i: number): LeadRow {
  return {
    acvEstimadoCentavos: null,
    canal: null,
    contatoEmail: null,
    contatoNome: null,
    criadoEm: "2026-09-01T00:00:00.000Z",
    donoNome: null,
    entrada: null,
    estagio: "LEAD",
    estagioDesde: "2026-09-01T00:00:00.000Z",
    id: `l-${i}`,
    motivoPerda: null,
    nome: `Lead ${i}`,
    notaPerda: null,
    origem: null,
    perdidoEm: null,
    perdidoNoEstagio: null,
    proposta: null,
    proximaAcao: null,
    proximaAcaoEm: null,
    situacao: "ATIVO",
  };
}

function muitos<T>(n: number, fabrica: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => fabrica(i));
}

const ROTULO = `Mostrar mais ${TETO_DA_LISTA}`;

/** Cem linhas por render: com a máquina carregada, os 5 s do padrão estouram. */
const FOLGA = 30_000;

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  zerarRoteador("/");
});

describe("Carteira — mostrar mais", () => {
  it(
    "página cheia oferece a próxima; página curta não",
    () => {
      const { unmount } = render(
        <ClientesTabela clientes={muitos(TETO_DA_LISTA, cliente)} />
      );
      expect(screen.getByRole("button", { name: ROTULO })).toBeTruthy();
      unmount();

      render(<ClientesTabela clientes={muitos(3, cliente)} />);
      expect(screen.queryByRole("button", { name: ROTULO })).toBeNull();
    },
    FOLGA
  );

  it(
    "clicar pede a página 2, acrescenta as linhas e some quando acabou",
    async () => {
      mocks.listClients.mockResolvedValue({
        data: { itens: [cliente(500)], temMais: false },
        ok: true,
      });
      render(<ClientesTabela clientes={muitos(TETO_DA_LISTA, cliente)} />);

      fireEvent.click(screen.getByRole("button", { name: ROTULO }));

      expect(await screen.findByText("Cliente 500")).toBeTruthy();
      expect(mocks.listClients).toHaveBeenCalledWith({ pagina: 2 });
      expect(screen.getByText("Cliente 0")).toBeTruthy();
      expect(screen.queryByRole("button", { name: ROTULO })).toBeNull();
    },
    FOLGA
  );

  it(
    "página 2 que falha diz por quê e mantém o botão",
    async () => {
      mocks.listClients.mockResolvedValue({
        error: "Banco indisponível.",
        ok: false,
      });
      render(<ClientesTabela clientes={muitos(TETO_DA_LISTA, cliente)} />);

      fireEvent.click(screen.getByRole("button", { name: ROTULO }));

      expect((await screen.findByRole("alert")).textContent).toContain(
        "Banco indisponível."
      );
      expect(screen.getByRole("button", { name: ROTULO })).toBeTruthy();
    },
    FOLGA
  );
});

describe("Engajamentos — mostrar mais e reler o que já carregou", () => {
  it(
    "segunda página acrescenta; depois de uma escrita relê as duas páginas",
    async () => {
      mocks.listEngagements.mockImplementation(
        async (opcoes?: { pagina?: number }) => ({
          data: {
            itens: [engajamento(100 + (opcoes?.pagina ?? 1))],
            temMais: (opcoes?.pagina ?? 1) < 2,
          },
          ok: true,
        })
      );
      mocks.setEngagementStatusAction.mockResolvedValue({
        data: { id: "e-0" },
        ok: true,
      });
      render(
        <Engajamentos
          clientes={[]}
          iniciais={muitos(TETO_DA_LISTA, engajamento)}
          podeEscrever
          servicos={[]}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: ROTULO }));
      expect(await screen.findByText("Engajamento 102")).toBeTruthy();
      expect(mocks.listEngagements).toHaveBeenCalledWith({ pagina: 2 });
      expect(screen.queryByRole("button", { name: ROTULO })).toBeNull();

      mocks.listEngagements.mockClear();
      fireEvent.click(screen.getAllByRole("button", { name: "→ Ativo" })[0]);

      await waitFor(() =>
        expect(mocks.listEngagements).toHaveBeenCalledWith({ pagina: 1 })
      );
      expect(mocks.listEngagements).toHaveBeenCalledWith({ pagina: 2 });
      expect(mocks.listEngagements).toHaveBeenCalledTimes(2);
    },
    FOLGA
  );
});

describe("Propostas — mostrar mais", () => {
  it(
    "página cheia oferece a próxima e acrescenta as linhas",
    async () => {
      mocks.listProposals.mockResolvedValue({
        data: { itens: [proposta(900)], temMais: true },
        ok: true,
      });
      render(
        <Propostas iniciais={muitos(TETO_DA_LISTA, proposta)} podeEscrever />
      );

      fireEvent.click(screen.getByRole("button", { name: ROTULO }));

      expect(await screen.findByText("Proposta 900")).toBeTruthy();
      expect(mocks.listProposals).toHaveBeenCalledWith({ pagina: 2 });
      // Ainda há mais: o botão continua.
      expect(screen.getByRole("button", { name: ROTULO })).toBeTruthy();
    },
    FOLGA
  );
});

describe("Funil — mostrar mais leads", () => {
  const dados: DadosFunil = {
    canais: [],
    estagios: [],
    historico: [],
    hoje: "2026-09-06T12:00:00.000Z",
    leads: [lead(0)],
    temMaisLeads: true,
  };

  it("temMaisLeads oferece a próxima página; os leads novos entram na tabela", async () => {
    mocks.listarFunil.mockResolvedValue({
      data: { ...dados, leads: [lead(700)], temMaisLeads: false },
      ok: true,
    });
    render(<Funil inicial={dados} podeEscrever={false} />);

    fireEvent.click(screen.getByRole("button", { name: ROTULO }));

    // No board (card) e na tabela (linha): o lead novo entra nos dois.
    expect(await screen.findAllByText("Lead 700")).toHaveLength(2);
    expect(mocks.listarFunil).toHaveBeenCalledWith({ pagina: 2 });
    expect(screen.getAllByText("Lead 0")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: ROTULO })).toBeNull();
  });

  it("sem temMaisLeads, nada a mostrar", () => {
    render(
      <Funil inicial={{ ...dados, temMaisLeads: false }} podeEscrever={false} />
    );
    expect(screen.queryByRole("button", { name: ROTULO })).toBeNull();
  });
});
