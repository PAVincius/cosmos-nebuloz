/** @vitest-environment jsdom */
// copy-onda5.test.tsx — crítica rodada 2 (25/40): copy nos arquivos desta
// frente (a 5b cuida do resto). "tenant" onde a pessoa lê "cliente"; enum cru
// na tela (LOGIN, `row.action`); "MCP writes avançadas"; botão que fecha um
// formulário rotulado "Cancelar" ao lado de um "→ Cancelado" que mata o
// registro; abas do financeiro sem `aria-current` e sem `flexWrap`; e a
// consequência do provisionamento dizendo que módulos marcados "nascem
// ativos" num form que oferece Trial.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcessoRow } from "@/app/actions/access";
import type { AuditEventoRow } from "@/app/actions/audit";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  listAuditEvents: vi.fn(),
  listAuditTenants: vi.fn(),
  listClients: vi.fn(),
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
  listStaffActivity: vi.fn(),
  listTenantAudit: vi.fn(),
  listTenantIntegrations: vi.fn(),
  listTenantMembers: vi.fn(),
  listarTitulos: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("@/lib/modulos", () => ({ MODULOS_DA_PLATAFORMA: ["COSMOS"] }));
vi.mock("@/app/actions/agregados", () => import("../vitest-mocks/agregados"));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: vi.fn(),
  listPlatformApprovals: mocks.listPlatformApprovals,
}));
vi.mock("@/app/actions/audit", () => ({
  listAuditEvents: mocks.listAuditEvents,
  listAuditTenants: mocks.listAuditTenants,
}));
vi.mock("@/app/actions/clients", () => ({
  getClient: mocks.getClient,
  listClients: mocks.listClients,
  listStaffActivity: mocks.listStaffActivity,
}));
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
  listarTitulos: mocks.listarTitulos,
}));
vi.mock("@/app/actions/provisioning", () => ({
  bootstrapCharterAction: vi.fn(),
  bootstrapMeridianAction: vi.fn(),
  contractModuleAction: vi.fn(),
  provisionTenantAction: vi.fn(),
}));
vi.mock("@/app/actions/tenant-members", () => ({
  listTenantMembers: mocks.listTenantMembers,
}));
vi.mock("@/app/actions/tenant-observability", () => ({
  listTenantAudit: mocks.listTenantAudit,
  listTenantIntegrations: mocks.listTenantIntegrations,
}));

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: true });
});

describe("tenant → cliente", () => {
  it("a carteira (/clientes) não diz 'tenant' no subtítulo", async () => {
    mocks.listClients.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/clientes/page");
    render(await Page());

    expect(screen.queryByText(/tenants?\b/i)).toBeNull();
  });

  it("o detalhe do cliente leva 'Plataforma · cliente' no eyebrow e 'Clientes' na volta", async () => {
    mocks.getClient.mockResolvedValue({
      data: {
        charter: {
          hasCompliance: true,
          hasPolicy: true,
          moduleContracted: false,
        },
        createdAt: "2026-09-01T00:00:00.000Z",
        id: "t1",
        meridian: {
          hasConsultant: true,
          hasTemplate: true,
          moduleContracted: false,
        },
        modules: [],
        name: "Atlas Energia",
        plan: "ORBIT",
        slug: "atlas",
      },
      ok: true,
    });
    mocks.listTenantMembers.mockResolvedValue({ data: [], ok: true });
    mocks.listTenantIntegrations.mockResolvedValue({ data: [], ok: true });
    mocks.listTenantAudit.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import(
      "@/app/(staff)/clientes/[slug]/page"
    );
    render(await Page({ params: Promise.resolve({ slug: "atlas" }) }));

    expect(screen.getByText("Plataforma · cliente")).toBeTruthy();
    expect(screen.queryByText(/tenant · /)).toBeNull();
    expect(screen.getByRole("link", { name: /Clientes/ })).toBeTruthy();
  });

  it("o formulário de provisionar diz 'cliente' e a consequência fala do status marcado, não de 'nascem ativos'", async () => {
    const { NewClientForm } = await import("@/app/(staff)/clientes/novo/form");
    render(<NewClientForm canWrite modulos={["COSMOS"]} />);

    expect(screen.getByText("Dados do cliente")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Provisionar cliente" })
    ).toBeTruthy();
    expect(screen.queryByText(/tenant/i)).toBeNull();

    fireEvent.change(screen.getByLabelText("Nome da organização"), {
      target: { value: "Atlas" },
    });
    fireEvent.change(screen.getByLabelText("E-mail do responsável"), {
      target: { value: "dono@atlas.com" },
    });
    fireEvent.submit(screen.getByRole("form"));

    expect(screen.queryByText(/nascem ativos/)).toBeNull();
    expect(screen.getByText(/ativo ou trial/i)).toBeTruthy();
  });
});

describe("enum cru → rótulo", () => {
  it("observabilidade: LOGIN/LOGOUT/RECUSADO viram Entrou/Saiu/Recusado", async () => {
    const acesso = (id: string, evento: string): AcessoRow => ({
      email: "x@nebuloz.com",
      evento,
      id,
      ip: null,
      motivo: null,
      quando: "2026-09-01T00:00:00.000Z",
    });
    mocks.listPlatformHealth.mockResolvedValue({
      data: {
        acessos: [
          acesso("a1", "LOGIN"),
          acesso("a2", "LOGOUT"),
          acesso("a3", "RECUSADO"),
        ],
        integracoes: [],
        recusas: 1,
      },
      ok: true,
    });
    const { default: Page } = await import(
      "@/app/(staff)/observabilidade/page"
    );
    render(await Page());

    expect(screen.getByText("Entrou")).toBeTruthy();
    expect(screen.getByText("Saiu")).toBeTruthy();
    expect(screen.getByText("Recusado")).toBeTruthy();
    expect(screen.queryByText("LOGIN")).toBeNull();
  });

  it("atividade e audit mostram a ação com o rótulo de ACOES, não o valor gravado", async () => {
    mocks.listStaffActivity.mockResolvedValue({
      data: [
        {
          action: "updated",
          actorName: "Ana",
          createdAt: "2026-09-01T00:00:00.000Z",
          id: "s1",
          target: "atlas",
        },
      ],
      ok: true,
    });
    const { default: Atividade } = await import("@/app/(staff)/atividade/page");
    const a = render(await Atividade());
    expect(screen.getByText("Alteração")).toBeTruthy();
    expect(screen.queryByText("updated")).toBeNull();
    a.unmount();

    const evento: AuditEventoRow = {
      action: "approved",
      alvo: null,
      ator: "ana@nebuloz.com",
      diff: null,
      entityId: null,
      entityType: "tenant",
      id: "e1",
      quando: "2026-09-01T00:00:00.000Z",
      semDiff: true,
      tenantNome: "Acme",
      tenantSlug: "acme",
    };
    mocks.listAuditTenants.mockResolvedValue({ data: [], ok: true });
    mocks.listAuditEvents.mockResolvedValue({
      data: { eventos: [evento], pagina: 1, porPagina: 50, total: 1 },
      ok: true,
    });
    const { default: Audit } = await import("@/app/(staff)/audit/page");
    render(await Audit({ searchParams: Promise.resolve({}) }));
    // O select do filtro também lista "Aprovação"; a linha do evento é o
    // que importa, e "approved" cru não pode aparecer em lugar nenhum.
    expect(screen.getAllByText("Aprovação").length).toBeGreaterThan(0);
    expect(screen.queryByText("approved")).toBeNull();
  });

  it("aprovações: o subtítulo não diz 'MCP writes'", async () => {
    mocks.listPlatformApprovals.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    render(await Page());

    expect(screen.queryByText(/MCP writes/)).toBeNull();
    expect(screen.getByText(/agentes de IA/)).toBeTruthy();
  });
});

describe("financeiro — abas", () => {
  it("a aba ativa leva aria-current=page e a fila quebra linha", async () => {
    mocks.listarTitulos.mockResolvedValue({ error: "x", ok: false });
    const { default: Page } = await import(
      "@/app/(staff)/empresa/financeiro/page"
    );
    render(await Page({ searchParams: Promise.resolve({ aba: "titulos" }) }));

    const ativa = screen.getByRole("link", { name: "Títulos" });
    expect(ativa.getAttribute("aria-current")).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "DRE mensal" })
        .getAttribute("aria-current")
    ).toBeNull();
    const fila = ativa.parentElement as HTMLElement;
    expect(fila.style.flexWrap).toBe("wrap");
  });
});
