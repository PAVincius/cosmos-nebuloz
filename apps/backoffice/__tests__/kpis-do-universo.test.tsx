/** @vitest-environment jsdom */
// kpis-do-universo.test.tsx — crítica rodada 6: com mais de 100 clientes, os
// KPIs calculados sobre a lista carregada viravam os números da página. A
// lista mockada aqui tem 100 itens e o agregado diz 140: o KPI mostra 140.
// Voltar a contar a lista faz o KPI dizer 100 e derruba a linha da tela.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContaComSaude } from "@/app/actions/accounts";
import type { ClienteBenchmark } from "@/app/actions/benchmark";
import type { ClientRow } from "@/app/actions/clients";
import type { LeadRow } from "@/app/actions/leads";
import type { ProposalRow } from "@/app/actions/proposals";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  agregadoDaCarteira: vi.fn(),
  agregadoDasContas: vi.fn(),
  agregadoDasPropostas: vi.fn(),
  agregadoDoBenchmark: vi.fn(),
  agregadoDoFunil: vi.fn(),
  listAccountHealth: vi.fn(),
  listBenchmark: vi.fn(),
  listClients: vi.fn(),
  listProposals: vi.fn(),
  listarFunil: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("@/app/actions/agregados", () => ({
  agregadoDaCarteira: mocks.agregadoDaCarteira,
  agregadoDasContas: mocks.agregadoDasContas,
  agregadoDasPropostas: mocks.agregadoDasPropostas,
  agregadoDoBenchmark: mocks.agregadoDoBenchmark,
  agregadoDoFunil: mocks.agregadoDoFunil,
}));
vi.mock("@/app/actions/clients", () => ({ listClients: mocks.listClients }));
vi.mock("@/app/actions/clientes-busca", () => ({
  buscarNaCarteira: vi.fn(),
}));
vi.mock("@/app/actions/accounts", () => ({
  listAccountHealth: mocks.listAccountHealth,
}));
vi.mock("@/app/actions/proposals", () => ({
  listProposals: mocks.listProposals,
  submitProposalAction: vi.fn(),
}));
vi.mock("@/app/actions/benchmark", () => ({
  listBenchmark: mocks.listBenchmark,
}));
vi.mock("@/app/actions/leads", () => ({ listarFunil: mocks.listarFunil }));
// O board de arrastar não é o assunto — só o cabeçalho do funil é.
vi.mock("@/app/(staff)/funil/funil", () => ({ Funil: () => null }));

vi.setConfig({ testTimeout: 20_000 });

// O KpiCard conta de 0 até o valor na entrada; sob reduced motion o número
// aparece direto — é o que o teste precisa ler.
window.matchMedia = ((consulta: string) => ({
  addEventListener: () => {},
  addListener: () => {},
  dispatchEvent: () => false,
  matches: consulta.includes("reduced-motion"),
  media: consulta,
  onchange: null,
  removeEventListener: () => {},
  removeListener: () => {},
})) as unknown as typeof window.matchMedia;

const CEM = Array.from({ length: 100 }, (_, i) => i);

function valorDoKpi(rotulo: string | RegExp): string {
  const card = screen.getByText(rotulo).closest(".kpi");
  if (!card) {
    throw new Error(`KPI ${String(rotulo)} não encontrado`);
  }
  return card.textContent ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: false });
});

describe("Carteira", () => {
  it("Clientes na carteira vem do agregado, não da lista", async () => {
    const clientes: ClientRow[] = CEM.map((i) => ({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: `t${i}`,
      memberCount: 1,
      modules: [{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }],
      name: `Cliente ${i}`,
      plan: "ORBIT",
      slug: `cliente-${i}`,
    }));
    mocks.listClients.mockResolvedValue({ data: clientes, ok: true });
    mocks.agregadoDaCarteira.mockResolvedValue({
      data: { clientes: 140, modulosAtivos: 210, suspensos: 9, trials: 7 },
      ok: true,
    });

    const { default: Page } = await import("@/app/(staff)/clientes/page");
    render(await Page());

    expect(valorDoKpi("Clientes na carteira")).toContain("140");
    expect(valorDoKpi("Módulos ativos")).toContain("210");
    expect(valorDoKpi("Trials em andamento")).toContain("7");
    expect(valorDoKpi("Exigem atenção")).toContain("9");
  });

  it("sem o agregado, os KPIs dizem que não contaram — nunca a página", async () => {
    mocks.listClients.mockResolvedValue({ data: [], ok: true });
    mocks.agregadoDaCarteira.mockResolvedValue({
      error: "banco fora",
      ok: false,
    });

    const { default: Page } = await import("@/app/(staff)/clientes/page");
    render(await Page());

    expect(screen.queryByText("Clientes na carteira")).toBeNull();
    expect(screen.getByText(/Não foi possível contar a carteira/)).toBeTruthy();
  });
});

describe("Saúde e renovação", () => {
  it("na página 2, os KPIs continuam sendo da carteira inteira", async () => {
    const contas: ContaComSaude[] = CEM.map((i) => ({
      diasParaRenovar: null,
      modulos: [],
      nome: `Conta ${i}`,
      plano: "ORBIT",
      renovaEm: null,
      saude: "OK",
      sinais: [],
      slug: `conta-${i}`,
      ultimaAtividade: null,
    }));
    mocks.listAccountHealth.mockResolvedValue({
      data: { itens: contas, temMais: false },
      ok: true,
    });
    mocks.agregadoDasContas.mockResolvedValue({
      data: { atencao: 30, renovando: 18, risco: 12, semSinal: 7 },
      ok: true,
    });

    const { default: Page } = await import("@/app/(staff)/contas/page");
    render(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));

    expect(valorDoKpi("Em risco")).toContain("12");
    expect(valorDoKpi("Atenção")).toContain("30");
    expect(valorDoKpi("Renovando")).toContain("18");
    expect(valorDoKpi("Sem sinal")).toContain("7");
  });
});

describe("Propostas", () => {
  it("fila, pipeline e contagem vêm do agregado", async () => {
    const propostas: ProposalRow[] = CEM.map((i) => ({
      acvCentavos: 100,
      cliente: "Atlas",
      criadoEm: "2026-09-01T00:00:00.000Z",
      descontoPercent: 0,
      id: `p${i}`,
      numero: `P-${i}`,
      status: "AGUARDANDO_APROVACAO",
      titulo: `Proposta ${i}`,
      totalCentavos: 100,
    }));
    mocks.listProposals.mockResolvedValue({ data: propostas, ok: true });
    mocks.agregadoDasPropostas.mockResolvedValue({
      data: {
        abertas: 80,
        decididas: 60,
        ganhas: 45,
        naFila: 23,
        pipelineAbertoCentavos: 800_000,
        ticketMedioCentavos: 12_300,
        total: 140,
      },
      ok: true,
    });

    const { default: Page } = await import("@/app/(staff)/propostas/page");
    render(await Page());

    expect(valorDoKpi("Na fila de aprovação")).toContain("23");
    expect(valorDoKpi("Win rate")).toContain("45 de 60 decididas");
    expect(valorDoKpi(/Pipeline aberto/)).toContain("80 em aberto");
    expect(screen.getByText("100 de 140 propostas")).toBeTruthy();
  });
});

describe("Funil", () => {
  it("ativos e estagnados do cabeçalho vêm do agregado", async () => {
    const leads = CEM.map(
      (i) =>
        ({
          entrada: null,
          estagio: "LEAD",
          estagioDesde: "2026-09-20T00:00:00.000Z",
          id: `l${i}`,
          situacao: "ATIVO",
        }) as unknown as LeadRow
    );
    mocks.listarFunil.mockResolvedValue({
      data: {
        canais: [],
        estagios: [],
        historico: [],
        hoje: "2026-09-22T00:00:00.000Z",
        leads,
        temMaisLeads: true,
      },
      ok: true,
    });
    mocks.agregadoDoFunil.mockResolvedValue({
      data: { ativos: 140, estagnados: 9, pelaEscada: 75 },
      ok: true,
    });

    const { default: Page } = await import("@/app/(staff)/funil/page");
    render(await Page());

    expect(screen.getByText("140 ativos")).toBeTruthy();
    expect(screen.getByText("9 estagnados")).toBeTruthy();
    expect(screen.getByText("75% entram pelo assessment")).toBeTruthy();
  });
});

describe("Benchmark", () => {
  it("Clientes, receita e sem contrato são da carteira inteira", async () => {
    const clientes: ClienteBenchmark[] = CEM.map((i) => ({
      descontoMedio: 0,
      engajamentos: 0,
      nome: `Cliente ${i}`,
      receitaCentavos: 0,
      slug: `cliente-${i}`,
      ticketCentavos: 0,
    }));
    mocks.listBenchmark.mockResolvedValue({
      data: { clientes, servicos: [], temMaisClientes: true },
      ok: true,
    });
    mocks.agregadoDoBenchmark.mockResolvedValue({
      data: { clientes: 140, receitaCentavos: 9_000_000, semContrato: 30 },
      ok: true,
    });

    const { default: Page } = await import("@/app/(staff)/benchmark/page");
    render(await Page());

    expect(valorDoKpi("Clientes")).toContain("140");
    expect(valorDoKpi("Sem contrato")).toContain("30");
    expect(valorDoKpi("Receita contratada")).toContain("90.000");
  });
});
