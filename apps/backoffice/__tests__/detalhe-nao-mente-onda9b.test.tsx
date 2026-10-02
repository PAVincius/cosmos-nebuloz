/** @vitest-environment jsdom */
// detalhe-nao-mente-onda9b.test.tsx — crítica R6: o detalhe do cliente dizia
// "Usuários · 0" quando a leitura dos membros tinha falhado (o erro virava
// `[]`), e o painel mostrava um parágrafo vermelho sem saída. O plano vinha
// cru ("GALAXY") e sem tom, porque o mapa de tons usava SCALE/ENTERPRISE —
// enums que não existem no schema.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetalheDoTenant } from "@/app/(staff)/clientes/[slug]/detalhe";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  listTenantAudit: vi.fn(),
  listTenantIntegrations: vi.fn(),
  listTenantMembers: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("@/lib/modulos", () => ({ MODULOS_DA_PLATAFORMA: ["COSMOS"] }));
vi.mock("@/app/actions/clients", () => ({ getClient: mocks.getClient }));
vi.mock("@/app/actions/provisioning", () => ({
  bootstrapCharterAction: vi.fn(),
  bootstrapMeridianAction: vi.fn(),
  bootstrapScaffoldAction: vi.fn(),
  contractModuleAction: vi.fn(),
}));
vi.mock("@/app/actions/meridian-benchmark", () => ({
  getMeridianBenchmark: vi.fn(async () => ({
    ok: true,
    data: {
      enabled: false,
      agreementRef: null,
      updatedAt: null,
      isInternalTenant: false,
    },
  })),
  setMeridianBenchmarkAction: vi.fn(),
}));
vi.mock("@/app/actions/tenant-members", () => ({
  listTenantMembers: mocks.listTenantMembers,
  updateTenantMemberRoleAction: vi.fn(),
}));
vi.mock("@/app/actions/tenant-observability", () => ({
  listTenantAudit: mocks.listTenantAudit,
  listTenantIntegrations: mocks.listTenantIntegrations,
}));

vi.setConfig({ testTimeout: 30_000 });

beforeEach(async () => {
  vi.clearAllMocks();
  const { zerarRoteador } = await import("../vitest-mocks/next-navigation");
  zerarRoteador("/clientes/vanta");
});

function montar(sobre: Partial<Parameters<typeof DetalheDoTenant>[0]> = {}) {
  return render(
    <DetalheDoTenant
      acoesDeModulo={<div>ações de módulo</div>}
      auditoria={{ data: [], ok: true }}
      canWrite
      charter={<div>charter</div>}
      contratados={new Set()}
      integracoes={{ data: [], ok: true }}
      membros={{ data: [], ok: true }}
      meridian={<div>meridian</div>}
      modulos={[]}
      slug="vanta"
      {...sobre}
    />
  );
}

describe("aba cuja leitura falhou não diz zero", () => {
  it("Usuários: rótulo com '—' e o motivo, painel com 'Tentar de novo'", () => {
    montar({ membros: { error: "banco fora do ar", ok: false } });

    const aba = screen.getByRole("tab", { name: /Usuários/ });
    expect(aba.textContent).toContain("Usuários · —");
    expect(aba.textContent).not.toContain("· 0");
    expect(aba.getAttribute("title")).toContain("banco fora do ar");

    fireEvent.click(aba);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("banco fora do ar");
  });

  it("Integrações: rótulo com '—' e o motivo, painel com 'Tentar de novo'", () => {
    montar({ integracoes: { error: "timeout", ok: false } });

    const aba = screen.getByRole("tab", { name: /Integrações/ });
    expect(aba.textContent).toContain("Integrações · —");
    expect(aba.getAttribute("title")).toContain("timeout");

    fireEvent.click(aba);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("Auditoria que falhou também ganha 'Tentar de novo' no painel", () => {
    montar({ auditoria: { error: "sem permissão", ok: false } });
    fireEvent.click(screen.getByRole("tab", { name: /Trilha de auditoria/ }));
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
  });

  it("Resumo: integrações que não carregaram não viram 'OK 0 · Com erro 0'", () => {
    montar({ integracoes: { error: "timeout", ok: false } });
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText(/Integrações não carregaram: timeout/)
    ).toBeTruthy();
  });

  it("leitura que deu certo continua contando", () => {
    montar();
    expect(screen.getByRole("tab", { name: /Usuários/ }).textContent).toContain(
      "Usuários · 0"
    );
  });

  it("o painel da aba recebe foco pelo teclado e a aba usa token de fonte", () => {
    montar();
    expect(screen.getByRole("tabpanel").getAttribute("tabindex")).toBe("0");
    const aba = screen.getByRole("tab", { name: "Resumo" });
    expect(aba.getAttribute("style")).toContain("var(--fs-");
  });
});

describe("plano com o enum real e rótulo humano", () => {
  function cliente(plan: string) {
    return {
      data: {
        charter: {
          hasCompliance: true,
          hasPolicy: true,
          moduleContracted: false,
        },
        createdAt: "2026-09-01T00:00:00.000Z",
        id: "t1",
        memberCount: 3,
        meridian: {
          hasConsultant: true,
          hasTemplate: true,
          moduleContracted: false,
        },
        modules: [],
        name: "Vanta Saúde",
        plan,
        slug: "vanta-saude",
      },
      ok: true,
    };
  }

  async function renderizarPagina(plan: string) {
    mocks.requirePlatformStaff.mockResolvedValue({ canWrite: true });
    mocks.getClient.mockResolvedValue(cliente(plan));
    mocks.listTenantMembers.mockResolvedValue({ data: [], ok: true });
    mocks.listTenantIntegrations.mockResolvedValue({ data: [], ok: true });
    mocks.listTenantAudit.mockResolvedValue({ data: [], ok: true });
    const { default: Page } = await import(
      "@/app/(staff)/clientes/[slug]/page"
    );
    render(await Page({ params: Promise.resolve({ slug: "vanta-saude" }) }));
  }

  it.each([
    ["ORBIT", "Orbit"],
    ["GALAXY", "Galaxy"],
    ["NEBULA", "Nebula"],
    ["UNIVERSE", "Universe"],
  ])("%s vira '%s' com tom próprio, não neutro", async (enumCru, rotulo) => {
    await renderizarPagina(enumCru);

    const selo = screen.getByText(rotulo);
    expect(screen.queryByText(enumCru)).toBeNull();
    // Neutro é `--chip-bg`/`--ink-muted`: plano sem tom cai nele.
    expect(selo.getAttribute("style")).not.toContain("--ink-muted");
  });

  it("eyebrow no padrão Seção · faceta, e o slug continua à vista", async () => {
    await renderizarPagina("GALAXY");
    expect(screen.getByText("Plataforma · cliente")).toBeTruthy();
    expect(screen.getByText(/vanta-saude · cliente desde/)).toBeTruthy();
  });
});

describe("aba Scaffold só existe com o módulo contratado", () => {
  it("sem SCAFFOLD contratado não há aba", () => {
    montar({ contratados: new Set(["CHARTER"]) });

    expect(screen.queryByRole("tab", { name: "Scaffold" })).toBeNull();
  });

  it("com SCAFFOLD contratado a aba abre o conteúdo do Scaffold", () => {
    montar({
      contratados: new Set(["SCAFFOLD"]),
      scaffold: <div>cartão do scaffold</div>,
    });

    fireEvent.click(screen.getByRole("tab", { name: "Scaffold" }));
    expect(screen.getByText("cartão do scaffold")).toBeTruthy();
  });
});
