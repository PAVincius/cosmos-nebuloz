/** @vitest-environment jsdom */
// estados-vazios.test.tsx — heurística 1 (status): vazio que ensina, e
// esqueleto com a forma da tela.
//
// Benchmark e Versão mostravam <thead> sem linha — nada dizia se era falta de
// dado ou falha. O vazio do painel explica o que alimenta a tela e o que
// fazer, no tom do catálogo ("Catálogo vazio. Sem serviço cadastrado, proposta
// vira texto livre…"). E o loading.tsx do grupo (staff) desenhava cartões
// enquanto `/` renderiza KPIs: a tela pulava a altura da grade ao chegar.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EstadoDoDeploy } from "@/app/actions/versao";

const mocks = vi.hoisted(() => ({
  lerEstadoDoDeploy: vi.fn(),
  listBenchmark: vi.fn(),
}));

vi.mock("@/app/actions/benchmark", () => ({
  listBenchmark: mocks.listBenchmark,
}));
vi.mock("@/app/actions/versao", () => ({
  lerEstadoDoDeploy: mocks.lerEstadoDoDeploy,
}));

vi.setConfig({ testTimeout: 20_000 });

const DEPLOY: EstadoDoDeploy = {
  codigo: {
    ambiente: "preview",
    assunto: null,
    branch: null,
    commit: null,
    commitCompleto: null,
    url: null,
  },
  lidoEm: "2026-09-16T12:00:00.000Z",
  recentes: [],
  schema: {
    comFalha: [],
    estado: "BANCO_ATRAS",
    excedentes: [],
    faltando: ["20260906000000_empresa"],
    totalAplicadas: 0,
    totalDoCodigo: 12,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Benchmark vazio", () => {
  it("as duas tabelas dizem o que as alimenta e o que fazer, em vez de <thead> sem linha", async () => {
    mocks.listBenchmark.mockResolvedValue({
      data: { clientes: [], servicos: [] },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/benchmark/page");
    render(await Page());

    // Por cliente: vem dos engajamentos de Delivery.
    const clientes = screen.getByText(/Nenhum cliente para comparar/);
    expect(clientes.textContent).toMatch(/engajamento/i);
    expect(clientes.textContent).toMatch(/Delivery/);
    // Por serviço: a linha nasce do catálogo — vazio aqui é catálogo vazio.
    const servicos = screen.getByText(/Nenhum serviço no catálogo/);
    expect(servicos.textContent).toMatch(/cadastre o serviço/i);
    expect(servicos.textContent).toMatch(/vincule/i);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("com dados, as tabelas voltam e o vazio some", async () => {
    mocks.listBenchmark.mockResolvedValue({
      data: {
        clientes: [
          {
            descontoMedio: 0,
            engajamentos: 1,
            nome: "Atlas",
            receitaCentavos: 100,
            slug: "atlas",
            ticketCentavos: 100,
          },
        ],
        servicos: [
          {
            codigo: "SV-01",
            engajamentos: 1,
            nome: "Kickoff",
            receitaCentavos: 100,
          },
        ],
      },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/benchmark/page");
    render(await Page());

    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.queryByText(/Nenhum cliente para comparar/)).toBeNull();
  });
});

describe("Versão e schema sem migration listada", () => {
  it("diz o que significa a tabela vazia, com o total do código", async () => {
    mocks.lerEstadoDoDeploy.mockResolvedValue({ data: DEPLOY, ok: true });
    const { default: Page } = await import("@/app/(staff)/versao/page");
    render(await Page());

    const vazio = screen.getByText(/Nenhuma migration registrada/);
    expect(vazio.textContent).toMatch(/_prisma_migrations/);
    expect(vazio.textContent).toMatch(/12/);
    expect(vazio.textContent).toMatch(/migrate deploy/);
  });
});

describe("loading.tsx do grupo (staff)", () => {
  it("desenha a forma de / — KPIs, não cartões", async () => {
    const { default: Loading } = await import("@/app/(staff)/loading");
    const { container } = render(<Loading />);

    // Quatro placas de KPI (min-height 150, a geometria do KpiCard do kit).
    const kpis = container.querySelectorAll('[style*="min-height: 150px"]');
    expect(kpis).toHaveLength(4);
  });
});
