/** @vitest-environment jsdom */
// rotulos-humanos.test.tsx — heurística 4 (consistência) e 2 (mundo real).
//
// O painel já tem mapas ROTULO_* em 23 arquivos; estes eram os pontos que
// ainda punham o enum cru na tela: ACTIVE/SUSPENDED como texto de botão no
// contrato de módulo, tenant_member como opção de filtro do audit, e o
// plural "(s)" onde a contagem já é conhecida. O valor que vai para a action
// ou para a URL não muda — só o que a pessoa lê.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcessoRow } from "@/app/actions/access";
import type { PlatformApprovalRow } from "@/app/actions/approvals";
import type { AuditEventoRow } from "@/app/actions/audit";

const mocks = vi.hoisted(() => ({
  contractModuleAction: vi.fn(),
  listAuditEvents: vi.fn(),
  listAuditTenants: vi.fn(),
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("@/app/actions/provisioning", () => ({
  contractModuleAction: mocks.contractModuleAction,
}));
vi.mock("@/app/actions/audit", () => ({
  listAuditEvents: mocks.listAuditEvents,
  listAuditTenants: mocks.listAuditTenants,
}));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: vi.fn(),
  listPlatformApprovals: mocks.listPlatformApprovals,
}));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/audit",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Importar uma página puxa o painel dela inteiro — é o import, não o render,
// que pesa; com a suíte em paralelo isso passa dos 5s padrão.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("contrato de módulo", () => {
  async function montar(status: string) {
    const { ModuleForm } = await import(
      "@/app/(staff)/clientes/[slug]/module-form"
    );
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );
  }

  it("os botões dizem Ativo / Trial / Suspenso / Cancelado, não o enum", async () => {
    await montar("ACTIVE");

    expect(screen.getByRole("button", { name: /Ativo/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trial/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Suspenso" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelado" })).toBeTruthy();
    for (const cru of ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"]) {
      expect(screen.queryByRole("button", { name: cru })).toBeNull();
    }
  });

  it("o status atual também aparece com rótulo humano", async () => {
    await montar("SUSPENDED");

    // Segunda célula da linha é o status atual; a terceira, os botões.
    const [, statusAtual] = screen.getAllByRole("cell");
    expect(statusAtual.textContent).toBe("Suspenso");
    expect(screen.queryByText("SUSPENDED")).toBeNull();
  });

  it("a action continua recebendo o enum", async () => {
    mocks.contractModuleAction.mockResolvedValue({ ok: true, data: {} });
    await montar("ACTIVE");

    fireEvent.click(screen.getByRole("button", { name: /Trial/ }));
    // Ativar também passa pela barreira (crítica rodada 4).
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await vi.waitFor(() => {
      expect(mocks.contractModuleAction).toHaveBeenCalledWith({
        module: "COSMOS",
        slug: "acme",
        status: "TRIAL",
      });
    });
  });
});

describe("filtros do audit", () => {
  it("entidade e ação têm rótulo humano; o valor do searchParam fica intacto", async () => {
    const { Filtros } = await import("@/app/(staff)/audit/filtros");
    render(<Filtros tenants={[]} />);

    const entidade = screen.getByLabelText("Entidade");
    const membro = within(entidade).getByRole("option", {
      name: "Membro do cliente",
    }) as HTMLOptionElement;
    expect(membro.value).toBe("tenant_member");
    expect(
      within(entidade).queryByRole("option", { name: "tenant_member" })
    ).toBeNull();

    const acao = screen.getByLabelText("Ação");
    const criacao = within(acao).getByRole("option", {
      name: "Criação",
    }) as HTMLOptionElement;
    expect(criacao.value).toBe("created");
    expect(within(acao).queryByRole("option", { name: "created" })).toBeNull();
  });
});

describe("plural real, não '(s)'", () => {
  function evento(id: string): AuditEventoRow {
    return {
      action: "created",
      alvo: null,
      ator: "ana@nebuloz.com",
      diff: null,
      entityId: null,
      entityType: "tenant",
      id,
      quando: "2026-09-01T00:00:00.000Z",
      semDiff: true,
      tenantNome: "Acme",
      tenantSlug: "acme",
    };
  }

  it("audit: '1 evento' e '2 eventos', no card e na paginação", async () => {
    mocks.listAuditTenants.mockResolvedValue({ ok: true, data: [] });
    const { default: Page } = await import("@/app/(staff)/audit/page");

    mocks.listAuditEvents.mockResolvedValue({
      ok: true,
      data: { eventos: [evento("e1")], pagina: 1, porPagina: 50, total: 1 },
    });
    const um = render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("1 evento no filtro atual")).toBeTruthy();
    expect(screen.getByText(/· 1 evento$/)).toBeTruthy();
    expect(screen.queryAllByText(/\(s\)/)).toHaveLength(0);
    um.unmount();

    mocks.listAuditEvents.mockResolvedValue({
      ok: true,
      data: {
        eventos: [evento("e1"), evento("e2")],
        pagina: 1,
        porPagina: 50,
        total: 2,
      },
    });
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("2 eventos no filtro atual")).toBeTruthy();
    expect(screen.getByText(/· 2 eventos$/)).toBeTruthy();
  });

  it("aprovações: '1 pendente' e '2 pendentes'", async () => {
    mocks.requirePlatformStaff.mockResolvedValue({ canWrite: false });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    const pedido = (id: string, status: string): PlatformApprovalRow => ({
      acao: "enviar_proposta_com_desconto",
      alvoLabel: "P-1 · Acme",
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
    });

    // A fila lê só os pendentes (os decididos moram em ?estado=decididos),
    // e o subtítulo conta o que está na tela.
    mocks.listPlatformApprovals.mockResolvedValue({
      ok: true,
      data: [pedido("a", "PENDING_APPROVAL")],
    });
    const um = render(await Page());
    expect(screen.getByText("1 pendente")).toBeTruthy();
    expect(screen.queryAllByText(/\(s\)/)).toHaveLength(0);
    um.unmount();

    mocks.listPlatformApprovals.mockResolvedValue({
      ok: true,
      data: [pedido("a", "PENDING_APPROVAL"), pedido("b", "PENDING_APPROVAL")],
    });
    render(await Page());
    expect(screen.getByText("2 pendentes")).toBeTruthy();
  });

  it("observabilidade: '1 tentativa recusada' e '2 tentativas recusadas'", async () => {
    const { default: Page } = await import(
      "@/app/(staff)/observabilidade/page"
    );
    const acesso: AcessoRow = {
      email: "x@nebuloz.com",
      evento: "RECUSADO",
      id: "a1",
      ip: null,
      motivo: "sem 2FA",
      quando: "2026-09-01T00:00:00.000Z",
    };

    mocks.listPlatformHealth.mockResolvedValue({
      ok: true,
      data: { acessos: [acesso], integracoes: [], recusas: 1 },
    });
    const um = render(await Page());
    expect(
      screen.getByText("1 tentativa recusada nas últimas 50")
    ).toBeTruthy();
    expect(screen.queryAllByText(/\(s\)/)).toHaveLength(0);
    um.unmount();

    mocks.listPlatformHealth.mockResolvedValue({
      ok: true,
      data: { acessos: [acesso], integracoes: [], recusas: 2 },
    });
    render(await Page());
    expect(
      screen.getByText("2 tentativas recusadas nas últimas 50")
    ).toBeTruthy();
  });
});
