/** @vitest-environment jsdom */
// cliente-citado-vira-saida.test.tsx — crítica rodada 6. Observabilidade,
// Trilha de auditoria, Benchmark e Atividade citavam o cliente pelo slug sem
// levar a ele: o operador copiava o slug e buscava na carteira. Agora o
// cliente citado é link para o detalhe, na aba que responde a pergunta da
// tela (`?aba=integracoes`, `?aba=audit`). Observabilidade mostra o erro que
// prometia; Atividade diz que corta em 100; Carteira e Contas falam o nome do
// plano e do módulo, não o enum.
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientesTabela } from "@/app/(staff)/clientes-tabela";
import type { IntegracaoQuebrada } from "@/app/actions/access";
import type { ActivityRow, ClientRow } from "@/app/actions/clients";
import type { AuditEventoRow } from "@/lib/audit-filtro";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listAccountHealth: vi.fn(),
  listAuditEvents: vi.fn(),
  listAuditTenants: vi.fn(),
  listBenchmark: vi.fn(),
  listClients: vi.fn(),
  listPlatformHealth: vi.fn(),
  listStaffActivity: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/agregados", () => import("../vitest-mocks/agregados"));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/audit", () => ({
  listAuditEvents: mocks.listAuditEvents,
  listAuditTenants: mocks.listAuditTenants,
}));
vi.mock("@/app/actions/accounts", () => ({
  listAccountHealth: mocks.listAccountHealth,
}));
vi.mock("@/app/actions/benchmark", () => ({
  listBenchmark: mocks.listBenchmark,
}));
vi.mock("@/app/actions/clients", () => ({
  listClients: mocks.listClients,
  listStaffActivity: mocks.listStaffActivity,
}));

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
});

function integracao(over: Partial<IntegracaoQuebrada>): IntegracaoQuebrada {
  return {
    id: "i-1",
    mensagem: "Token expirado — reautorize o OAuth.",
    name: "GitHub",
    source: "github",
    status: "ERROR",
    tenantNome: "Vanta Saúde",
    tenantSlug: "vanta",
    ultimoSync: null,
    ...over,
  };
}

function saude(integracoes: IntegracaoQuebrada[], integracoesComErro: number) {
  return {
    data: {
      acessos: [],
      integracoes,
      integracoesComErro,
      recusas: 0,
      tenants: 3,
      ultimosEventos: [],
    },
    ok: true,
  };
}

describe("Observabilidade", () => {
  it("o slug leva à aba Integrações do cliente", async () => {
    mocks.listPlatformHealth.mockResolvedValue(saude([integracao({})], 1));
    const { default: Page } = await import(
      "@/app/(staff)/observabilidade/page"
    );
    render(await Page());

    const link = screen.getByRole("link", { name: /vanta/ });
    expect(link.getAttribute("href")).toBe("/clientes/vanta?aba=integracoes");
  });

  it("o erro aparece; longo, truncado na tela e inteiro para quem lê com leitor", async () => {
    const longa = `Linear respondeu 401: ${"o token da organização foi revogado pelo administrador ".repeat(4)}fim.`;
    mocks.listPlatformHealth.mockResolvedValue(
      saude(
        [
          integracao({ id: "i-1", mensagem: "Token expirado." }),
          integracao({ id: "i-2", mensagem: longa, name: "Linear" }),
        ],
        2
      )
    );
    const { default: Page } = await import(
      "@/app/(staff)/observabilidade/page"
    );
    render(await Page());

    expect(screen.getByText("Token expirado.")).toBeTruthy();
    const curta = screen.getByText(/^Linear respondeu 401: .*…$/);
    expect(curta.getAttribute("aria-hidden")).toBe("true");
    expect(curta.textContent?.length).toBeLessThan(longa.length);
    const inteira = screen.getByText(longa);
    expect(inteira.className).toContain("sr-only");
    expect(curta.closest("[title]")?.getAttribute("title")).toBe(longa);
  });

  it("a contagem de quebradas é a do banco, e diz quando a lista é parcial", async () => {
    mocks.listPlatformHealth.mockResolvedValue(
      saude(
        Array.from({ length: 50 }, (_, i) => integracao({ id: `i-${i}` })),
        73
      )
    );
    const { default: Page } = await import(
      "@/app/(staff)/observabilidade/page"
    );
    render(await Page());

    expect(screen.getByText(/73 integrações com erro/)).toBeTruthy();
    expect(
      screen.getByText(/as 50 de sincronização mais recente/)
    ).toBeTruthy();
  });
});

describe("Trilha de auditoria", () => {
  function evento(over: Partial<AuditEventoRow>): AuditEventoRow {
    return {
      action: "updated",
      alvo: "Charter",
      ator: "Ana",
      diff: null,
      entityId: "e-1",
      entityType: "tenantModule",
      id: "ev-1",
      quando: "2026-09-01T12:00:00.000Z",
      semDiff: true,
      tenantNome: "Acme",
      tenantSlug: "acme",
      ...over,
    };
  }

  it("o cliente da linha leva à aba Audit dele; o tenant interno não vira link", async () => {
    mocks.listAuditTenants.mockResolvedValue({
      data: [{ id: "t-1", name: "Acme", slug: "acme" }],
      ok: true,
    });
    mocks.listAuditEvents.mockResolvedValue({
      data: {
        eventos: [
          evento({}),
          evento({ id: "ev-2", tenantNome: "Nebuloz", tenantSlug: "nebuloz" }),
        ],
        pagina: 1,
        porPagina: 50,
        total: 2,
      },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/audit/page");
    render(await Page({ searchParams: Promise.resolve({}) }));

    const link = screen.getByRole("link", { name: /acme/ });
    expect(link.getAttribute("href")).toBe("/clientes/acme?aba=audit");
    expect(screen.queryByRole("link", { name: /nebuloz/ })).toBeNull();
    expect(screen.getByText("nebuloz")).toBeTruthy();
  });
});

describe("Benchmark", () => {
  it("o nome do cliente leva ao detalhe", async () => {
    mocks.listBenchmark.mockResolvedValue({
      data: {
        clientes: [
          {
            descontoMedio: 0,
            engajamentos: 1,
            nome: "Atlas Energia",
            receitaCentavos: 100,
            slug: "atlas",
            ticketCentavos: 100,
          },
        ],
        servicos: [],
        temMaisClientes: false,
      },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/benchmark/page");
    render(await Page());

    const link = screen.getByRole("link", { name: /Atlas Energia/ });
    expect(link.getAttribute("href")).toBe("/clientes/atlas");
  });
});

describe("Atividade do staff", () => {
  function ato(i: number, over: Partial<ActivityRow> = {}): ActivityRow {
    return {
      action: "module.contracted",
      actorName: "Ana",
      clienteSlug: "vanta-saude",
      createdAt: "2026-09-01T12:00:00.000Z",
      id: `a-${i}`,
      target: `vanta-saude · CHARTER ${i}`,
      ...over,
    };
  }

  it("o alvo leva à aba Audit do cliente; ato no tenant interno fica texto", async () => {
    mocks.listStaffActivity.mockResolvedValue({
      data: [ato(1), ato(2, { clienteSlug: null, target: "P-0001 · Atlas" })],
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/atividade/page");
    render(await Page());

    const link = screen.getByRole("link", { name: /vanta-saude · CHARTER 1/ });
    expect(link.getAttribute("href")).toBe("/clientes/vanta-saude?aba=audit");
    expect(screen.queryByRole("link", { name: /P-0001/ })).toBeNull();
    expect(screen.queryByText(/mais recentes/)).toBeNull();
  });

  it("no teto, diz que corta — e para onde ir para ver mais", async () => {
    mocks.listStaffActivity.mockResolvedValue({
      data: Array.from({ length: 100 }, (_, i) => ato(i)),
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/atividade/page");
    render(await Page());

    expect(
      screen.getByText(/Mostrando os 100 atos mais recentes/)
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Trilha de auditoria/ })
        .getAttribute("href")
    ).toBe("/audit");
  });
});

describe("Rótulos de plano e módulo", () => {
  const CLIENTE: ClientRow = {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "t-1",
    memberCount: 2,
    modules: [{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }],
    name: "Vanta Saúde",
    plan: "GALAXY",
    slug: "vanta",
  };

  it("Carteira: módulo pelo nome e plano com o tom do plano", () => {
    render(<ClientesTabela clientes={[CLIENTE]} />);

    const linha = screen.getAllByRole("row")[1];
    expect(within(linha).getByText("Cosmos · Ativo")).toBeTruthy();
    expect(within(linha).queryByText(/COSMOS/)).toBeNull();
    const plano = within(linha).getByText("Galaxy");
    expect(plano.style.color).toBe("var(--blue-text)");
  });

  it("Contas: o plano pelo nome, não pelo enum", async () => {
    mocks.listAccountHealth.mockResolvedValue({
      data: {
        itens: [
          {
            diasParaRenovar: null,
            modulos: [],
            nome: "Vanta Saúde",
            plano: "GALAXY",
            renovaEm: null,
            saude: "OK",
            sinais: [],
            slug: "vanta",
            ultimaAtividade: null,
          },
        ],
        temMais: false,
      },
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/contas/page");
    render(await Page());

    expect(screen.getByText("vanta · Galaxy")).toBeTruthy();
    expect(screen.queryByText(/GALAXY/)).toBeNull();
  });
});
