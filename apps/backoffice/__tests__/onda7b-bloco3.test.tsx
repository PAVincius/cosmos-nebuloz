/** @vitest-environment jsdom */
// onda7b-bloco3.test.tsx — flexibilidade que faltava (crítica rodada 4, H7):
// paginação do Audit em link, Financeiro que não perde o período ao trocar
// de aba, Aprovações separando pendentes de decididos, e o menu em português.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Paginacao } from "@/app/(staff)/audit/filtros";
import type { PlatformApprovalRow } from "@/app/actions/approvals";
import { itemDaRota, tituloDaAba } from "@/components/nav";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listPlatformApprovals: vi.fn(),
  listarLancamentos: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: vi.fn(),
  listPlatformApprovals: mocks.listPlatformApprovals,
}));
// O diálogo de receita recorrente puxa `listClients`; sem o mock, o módulo
// `"use server"` abre o banco e o guard de env derruba a suíte.
vi.mock("@/app/actions/clients", () => ({ listClients: vi.fn() }));
vi.mock("@/app/actions/empresa/financeiro", () => ({
  lerCaixa: vi.fn(),
  lerDre: vi.fn(),
  listarPlanoDeContas: vi.fn(),
}));
vi.mock("@/app/actions/empresa/livro", () => ({
  listarLancamentos: mocks.listarLancamentos,
}));
vi.mock("@/app/actions/empresa/orcamento", () => ({ lerOrcado: vi.fn() }));
vi.mock("@/app/actions/empresa/recorrente", () => ({
  listarRecorrente: vi.fn(),
}));
vi.mock("@/app/actions/empresa/titulos", () => ({ listarTitulos: vi.fn() }));

function pedido(id: string, status: string): PlatformApprovalRow {
  return {
    acao: "proposal.send",
    alvoLabel: `P-${id} · Diagnóstico`,
    alvoTipo: "proposal",
    criadoEm: "2026-09-01T00:00:00.000Z",
    decididoEm: null,
    decisorNome: null,
    id,
    impacto: "20%",
    motivo: "Desconto acima do limite.",
    nota: null,
    solicitanteNome: "Ana",
    status,
  };
}

beforeEach(() => {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.requirePlatformStaff.mockResolvedValue({
    canWrite: true,
    email: "v@nebuloz.ai",
    name: "V",
    userId: "u-1",
  });
});

describe("Audit — paginação em link", () => {
  it("Próxima e Anterior são links com ?pagina=, preservando o filtro", () => {
    zerarRoteador("/audit", "tenant=t1&pagina=2");
    render(<Paginacao pagina={2} porPagina={50} total={200} />);

    const proxima = screen.getByRole("link", { name: /Próxima/ });
    expect(proxima.getAttribute("href")).toContain("pagina=3");
    expect(proxima.getAttribute("href")).toContain("tenant=t1");
    expect(
      screen.getByRole("link", { name: /Anterior/ }).getAttribute("href")
    ).toContain("pagina=1");
    expect(screen.getByText(/página 2 de 4/)).toBeTruthy();
  });

  it("na primeira página há só Próxima com pagina=2; na última, só Anterior", () => {
    zerarRoteador("/audit");
    const um = render(<Paginacao pagina={1} porPagina={50} total={200} />);
    expect(
      screen.getByRole("link", { name: /Próxima/ }).getAttribute("href")
    ).toContain("pagina=2");
    expect(screen.queryByRole("link", { name: /Anterior/ })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    um.unmount();

    render(<Paginacao pagina={4} porPagina={50} total={200} />);
    expect(screen.queryByRole("link", { name: /Próxima/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Anterior/ })).toBeTruthy();
  });
});

describe("Financeiro — trocar de aba preserva o período", () => {
  it("os links das abas levam de, ate e os demais params", async () => {
    mocks.listarLancamentos.mockResolvedValue({ error: "x", ok: false });
    const { default: Page } = await import(
      "@/app/(staff)/empresa/financeiro/page"
    );
    render(
      await Page({
        searchParams: Promise.resolve({
          aba: "dre",
          ate: "2026-03-31",
          conta: "3.1",
          de: "2026-01-01",
        }),
      })
    );

    const href =
      screen.getByRole("link", { name: "Lançamentos" }).getAttribute("href") ??
      "";
    expect(href).toContain("aba=lancamentos");
    expect(href).toContain("de=2026-01-01");
    expect(href).toContain("ate=2026-03-31");
    expect(href).toContain("conta=3.1");
    expect(
      screen
        .getByRole("link", { name: "DRE mensal" })
        .getAttribute("aria-current")
    ).toBe("page");
  }, 30_000);
});

describe("Aprovações — pendentes primeiro, decididos com ?estado=decididos", () => {
  it("sem param lê só pendentes, o subtítulo conta o que está visível e oferece os decididos", async () => {
    mocks.listPlatformApprovals.mockResolvedValue({
      data: [pedido("1", "PENDING_APPROVAL"), pedido("2", "PENDING_APPROVAL")],
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    render(await Page());

    expect(mocks.listPlatformApprovals).toHaveBeenCalledWith(
      "PENDING_APPROVAL"
    );
    expect(screen.getByText("2 pendentes")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /decididos/i }).getAttribute("href")
    ).toBe("/aprovacoes?estado=decididos");
  });

  it("?estado=decididos lê aprovados e rejeitados, sem botão de decidir, e volta para pendentes", async () => {
    mocks.listPlatformApprovals.mockResolvedValue({
      data: [pedido("3", "APPROVED"), pedido("4", "REJECTED")],
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    render(
      await Page({ searchParams: Promise.resolve({ estado: "decididos" }) })
    );

    expect(mocks.listPlatformApprovals).toHaveBeenCalledWith("DECIDIDOS");
    expect(screen.getByText("2 decididos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
    expect(
      screen.getByRole("link", { name: /pendentes/i }).getAttribute("href")
    ).toBe("/aprovacoes");
  });

  it("um pendente só: singular", async () => {
    mocks.listPlatformApprovals.mockResolvedValue({
      data: [pedido("1", "PENDING_APPROVAL")],
      ok: true,
    });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    render(await Page());
    expect(screen.getByText("1 pendente")).toBeTruthy();
  });
});

describe("Menu — rótulos em português", () => {
  it("Auditoria e Growth não falam inglês no menu", () => {
    expect(itemDaRota("/audit")?.label).toBe("Trilha de auditoria");
    expect(itemDaRota("/growth/readiness")?.label).toBe("Maturidade de IA");
    expect(tituloDaAba("/audit")).toBe(
      "Trilha de auditoria — Back-office Nebuloz"
    );
  });

  it("Home é o primeiro item do menu", async () => {
    const { BO_NAV } = await import("@/components/nav");
    // A Home mora em `/` desde a rodada 5 (antes, `/home`).
    expect(BO_NAV[0]?.items[0]?.href).toBe("/");
  });
});
