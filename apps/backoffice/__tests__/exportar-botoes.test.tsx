/** @vitest-environment jsdom */
// exportar-botoes.test.tsx — o CSV se pede por link, não por fetch: o
// navegador baixa sozinho (Content-Disposition), funciona sem JS e o link
// leva os filtros da tela. E dois resíduos da onda: o título da aba do
// Financeiro, e a aba de auditoria do cliente, que dizia "0" quando a
// leitura falhava.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetalheDoTenant } from "@/app/(staff)/clientes/[slug]/detalhe";
import type { AuditRow } from "@/app/actions/tenant-observability";
import { secaoDaRota } from "@/components/nav";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listAuditEvents: vi.fn(),
  listAuditTenants: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("@/app/actions/audit", () => ({
  listAuditEvents: mocks.listAuditEvents,
  listAuditTenants: mocks.listAuditTenants,
}));
vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: vi.fn(),
}));
// Os diálogos do Financeiro oferecem cliente num seletor — a action puxa o
// banco no import.
vi.mock("@/app/actions/clients", () => ({ listClients: vi.fn() }));
vi.mock("@/app/actions/empresa/financeiro", () => ({
  lerCaixa: vi.fn(),
  lerDre: vi.fn(),
  listarPlanoDeContas: vi.fn(),
}));
vi.mock("@/app/actions/empresa/livro", () => ({ listarLancamentos: vi.fn() }));
vi.mock("@/app/actions/empresa/orcamento", () => ({ lerOrcado: vi.fn() }));
vi.mock("@/app/actions/empresa/recorrente", () => ({
  listarRecorrente: vi.fn(),
}));
vi.mock("@/app/actions/empresa/titulos", () => ({
  listarTitulos: vi.fn(async () => ({ error: "x", ok: false })),
}));

// Importar uma página puxa o painel dela inteiro; com a suíte em paralelo
// passa dos 5s padrão.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: false });
  mocks.listAuditTenants.mockResolvedValue({ data: [], ok: true });
  mocks.listAuditEvents.mockResolvedValue({
    data: { eventos: [], pagina: 1, porPagina: 50, total: 0 },
    ok: true,
  });
});

describe("Trilha de auditoria — Exportar CSV", () => {
  it("é um link para a rota de exportação com os filtros da tela, sem a página", async () => {
    zerarRoteador("/audit", "tenant=t1&acao=tenant.create&pagina=2");
    const { default: Page } = await import("@/app/(staff)/audit/page");
    render(
      await Page({
        searchParams: Promise.resolve({
          acao: "tenant.create",
          pagina: "2",
          tenant: "t1",
        }),
      })
    );

    const link = screen.getByRole("link", { name: /Exportar CSV/ });
    expect(link.getAttribute("href")).toBe(
      "/audit/exportar?tenant=t1&acao=tenant.create"
    );
  });

  it("sem filtro, exporta a plataforma inteira", async () => {
    zerarRoteador("/audit");
    const { default: Page } = await import("@/app/(staff)/audit/page");
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("link", { name: /Exportar CSV/ }).getAttribute("href")
    ).toBe("/audit/exportar");
  });
});

describe("Financeiro", () => {
  async function abrir(aba?: string) {
    zerarRoteador("/empresa/financeiro", aba ? `aba=${aba}` : "");
    const { default: Page } = await import(
      "@/app/(staff)/empresa/financeiro/page"
    );
    return render(await Page({ searchParams: Promise.resolve({ aba }) }));
  }

  it("na aba Títulos, Exportar CSV leva à rota de exportação", async () => {
    await abrir("titulos");

    expect(
      screen.getByRole("link", { name: /Exportar CSV/ }).getAttribute("href")
    ).toBe("/empresa/financeiro/titulos/exportar");
  });

  it("nas outras abas não há exportação", async () => {
    await abrir();

    expect(screen.queryByRole("link", { name: /Exportar CSV/ })).toBeNull();
  });

  it("o eyebrow é a seção do menu, e a aba tem título", async () => {
    await abrir();
    const { metadata } = await import("@/app/(staff)/empresa/financeiro/page");

    expect(
      screen.getByText(new RegExp(`^${secaoDaRota("/empresa/financeiro")} · `))
    ).toBeTruthy();
    expect(metadata.title).toBe("Financeiro — Back-office Nebuloz");
  });
});

describe("detalhe do cliente — aba de auditoria", () => {
  function montar(
    auditoria: Parameters<typeof DetalheDoTenant>[0]["auditoria"]
  ) {
    zerarRoteador("/clientes/acme");
    return render(
      <DetalheDoTenant
        acoesDeModulo={null}
        auditoria={auditoria}
        canWrite={false}
        charter={null}
        contratados={new Set()}
        integracoes={{ data: [], ok: true }}
        membros={{ data: [], ok: true }}
        meridian={null}
        modulos={[]}
        slug="acme"
      />
    );
  }

  it("diz o nome do menu e a contagem", () => {
    montar({ data: [{}, {}] as AuditRow[], ok: true });

    expect(
      screen.getByRole("tab", { name: "Trilha de auditoria · 2" })
    ).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /^Audit/ })).toBeNull();
  });

  it("leitura que falhou não vira 0: mostra — e o motivo", () => {
    montar({ error: "Banco indisponível.", ok: false });

    const aba = screen.getByRole("tab", { name: /Trilha de auditoria · —/ });
    expect(aba.textContent).not.toContain("· 0");
    expect(aba.getAttribute("title")).toContain("Banco indisponível.");
    expect(aba.textContent).toContain("Banco indisponível.");
  });
});
