/** @vitest-environment jsdom */
// titulos-abas-orfaos-onda7.test.tsx — crítica rodada 4 (30/40), polish /
// clarify / distill:
//
// - `Secao` embrulha o `SectionCard` com `as="h2"` por padrão: 63 dos 83
//   cartões ainda eram `<div>` e o leitor de tela não tinha seção para pular.
// - Seis rotas sem `<title>`: as dinâmicas ganham `generateMetadata` com o
//   nome do que abriram; CAC ganha `metadata` do menu.
// - `error.tsx` mostra o `digest` em mono quando existe — é o que o suporte
//   pede.
// - `ConfirmarAcao` fecha com Esc; a topbar fica `inert` junto com o `<main>`
//   enquanto a gaveta está aberta.
// - `editar.tsx` usava um `<output>` próprio em vez da `Confirmacao`.
// - Jargão: "tenant" vira "cliente"; ACV/TCV ganham `Sigla`; o enum do
//   módulo vira rótulo; o subtítulo de Aprovações diz o que passa hoje.
// - `<th scope>` nas tabelas do Financeiro e da observabilidade.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbaResumo } from "@/app/(staff)/clientes/[slug]/abas/resumo";
import { DetalheDoServico } from "@/app/(staff)/servicos/[codigo]/detalhe";
import type { ServiceDetail } from "@/app/actions/services";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Secao } from "@/components/secao";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  getPropostaParaEdicao: vi.fn(),
  getServiceDetail: vi.fn(),
  lerAvaliacao: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({
  authClient: { signOut: vi.fn() },
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: vi.fn().mockResolvedValue({ canWrite: true }),
}));
vi.mock("@/lib/modulos", () => ({ MODULOS_DA_PLATAFORMA: [] }));
vi.mock("@/app/actions/clients", () => ({ getClient: mocks.getClient }));
vi.mock("@/app/actions/tenant-members", () => ({
  listTenantMembers: vi.fn(),
}));
vi.mock("@/app/actions/tenant-observability", () => ({
  listTenantAudit: vi.fn(),
  listTenantIntegrations: vi.fn(),
}));
vi.mock("@/app/actions/services", () => ({
  getServiceDetail: mocks.getServiceDetail,
  listServices: vi.fn(),
  updateServiceAction: vi.fn(),
}));
vi.mock("@/app/actions/maturidade", () => ({
  lerAvaliacao: mocks.lerAvaliacao,
}));
vi.mock("@/app/actions/proposta-escopo", () => ({
  getPropostaParaEdicao: mocks.getPropostaParaEdicao,
}));
vi.mock("@/app/actions/catalogo-comercial", () => ({
  listarCatalogoComercial: vi.fn(),
}));
vi.mock("@/app/actions/empresa/cac", () => ({ lerCac: vi.fn() }));
// O detalhe do cliente importa as actions de provisionamento pelos formulários
// de módulo; o import puxa o banco mesmo sem chamá-las.
vi.mock("@/app/actions/provisioning", () => ({
  bootstrapCharterAction: vi.fn(),
  bootstrapMeridianAction: vi.fn(),
  contractModuleAction: vi.fn(),
}));
vi.mock("@/app/(staff)/propostas/[id]/gerador", () => ({
  Gerador: () => null,
}));

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Secao — o cartão com título de seção", () => {
  it("é um h2 por padrão e aceita h3 para cartão aninhado", () => {
    render(
      <Secao title="Dados">
        <Secao as="h3" title="Módulos">
          x
        </Secao>
      </Secao>
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Dados" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Módulos" })
    ).toBeTruthy();
  });
});

const SERVICO: ServiceDetail = {
  ativo: true,
  codigo: "SV-09",
  descricao: "Mapa do que existe.",
  duracao: "3 semanas",
  entregaveis: ["Relatório"],
  exigeLab: false,
  id: "svc-1",
  modalidade: "PROJETO",
  moduloVinculado: "COSMOS",
  nome: "Diagnóstico de dados",
  papeis: ["Consultor"],
  precoBaseCentavos: 1_250_000,
  preRequisitos: [{ codigo: "SV-01", existe: true, nome: "Kickoff" }],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
  // Com uso: os cartões "Em propostas" e "Em engajamentos" só existem quando
  // há o que listar — são os sete cartões da tela.
  uso: {
    engajamentos: [{ id: "e1", nome: "Eng", status: "ATIVO" }],
    propostas: [
      {
        cliente: "Atlas",
        id: "p1",
        numero: "P-001",
        precoUnitCentavos: 100,
        quantidade: 1,
        status: "ENVIADA",
      },
    ],
  },
};

describe("detalhe do serviço — toda seção é um h2", () => {
  it("renderiza pelo menos 7 headings de nível 2", () => {
    render(<DetalheDoServico servico={SERVICO} />);
    expect(
      screen.getAllByRole("heading", { level: 2 }).length
    ).toBeGreaterThanOrEqual(7);
  });
});

describe("títulos de aba das rotas que não tinham", () => {
  it("cliente: nome — Cliente — Back-office Nebuloz", async () => {
    mocks.getClient.mockResolvedValue({ data: { name: "Atlas" }, ok: true });
    const { generateMetadata } = await import(
      "@/app/(staff)/clientes/[slug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "atlas" }),
    });
    expect(meta.title).toBe("Atlas — Cliente — Back-office Nebuloz");
  });

  it("cliente que não carregou cai no título do menu", async () => {
    mocks.getClient.mockResolvedValue({ error: "x", ok: false });
    const { generateMetadata } = await import(
      "@/app/(staff)/clientes/[slug]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "atlas" }),
    });
    expect(meta.title).toBe("Clientes — Back-office Nebuloz");
  });

  it("serviço: nome — Serviço — Back-office Nebuloz", async () => {
    mocks.getServiceDetail.mockResolvedValue({ data: SERVICO, ok: true });
    const { generateMetadata } = await import(
      "@/app/(staff)/servicos/[codigo]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ codigo: "SV-09" }),
    });
    expect(meta.title).toBe(
      "Diagnóstico de dados — Serviço — Back-office Nebuloz"
    );
  });

  it("avaliação: organização — Readiness — Back-office Nebuloz", async () => {
    mocks.lerAvaliacao.mockResolvedValue({
      data: { organizacao: "Acme" },
      ok: true,
    });
    const { generateMetadata } = await import(
      "@/app/(staff)/growth/readiness/[id]/page"
    );
    const meta = await generateMetadata({
      params: Promise.resolve({ id: "av-1" }),
    });
    expect(meta.title).toBe("Acme — Readiness — Back-office Nebuloz");
  });

  it("proposta: cliente — Proposta; nova: Nova proposta", async () => {
    mocks.getPropostaParaEdicao.mockResolvedValue({
      data: { clienteNome: "Acme" },
      ok: true,
    });
    const { generateMetadata } = await import(
      "@/app/(staff)/propostas/[id]/page"
    );
    expect(
      (await generateMetadata({ params: Promise.resolve({ id: "p-1" }) })).title
    ).toBe("Acme — Proposta — Back-office Nebuloz");
    expect(
      (await generateMetadata({ params: Promise.resolve({ id: "nova" }) }))
        .title
    ).toBe("Nova proposta — Back-office Nebuloz");
    // "nova" não lê nada.
    expect(mocks.getPropostaParaEdicao).toHaveBeenCalledTimes(1);
  });

  it("CAC usa o rótulo do menu", async () => {
    const { metadata } = await import("@/app/(staff)/empresa/cac/page");
    expect(metadata.title).toBe("CAC — Back-office Nebuloz");
  });
});

describe("error.tsx — código para o suporte", () => {
  it("mostra o digest em mono quando existe; sem digest, nada", async () => {
    const { default: Erro } = await import("@/app/(staff)/error");
    const erro = Object.assign(new Error("boom"), { digest: "abc123" });
    const { unmount } = render(<Erro error={erro} reset={vi.fn()} />);

    const codigo = screen.getByText(/Código para o suporte/);
    expect(codigo.textContent).toContain("abc123");
    expect(codigo.querySelector(".mono")?.textContent).toBe("abc123");
    unmount();

    render(<Erro error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.queryByText(/Código para o suporte/)).toBeNull();
  });
});

describe("ConfirmarAcao — Esc é Voltar", () => {
  it("com o foco dentro da pergunta, Escape fecha sem confirmar", () => {
    const onConfirmar = vi.fn();
    const onVoltar = vi.fn();
    render(
      <ConfirmarAcao
        alvo="COSMOS · acme"
        consequencia="x"
        onConfirmar={onConfirmar}
        onVoltar={onVoltar}
        rotulo="Cancelar"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const grupo = screen.getByRole("group", { name: "Cancelar" });

    fireEvent.keyDown(
      within(grupo).getByRole("button", { name: "Confirmar" }),
      {
        key: "Escape",
      }
    );

    expect(screen.queryByRole("group")).toBeNull();
    expect(onConfirmar).not.toHaveBeenCalled();
    expect(onVoltar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });
});

describe("gaveta aberta — a topbar também fica inert", () => {
  it("o alternador de tema está dentro de um ancestral inert", async () => {
    const { ShellChrome } = await import("@/components/chrome");
    render(
      <ShellChrome
        staff={{ canWrite: true, email: "ana@nebuloz.ai", name: "Ana" }}
      >
        x
      </ShellChrome>
    );
    const tema = screen.getByRole("button", { name: /Mudar para tema/ });
    expect(tema.closest("[inert]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));

    expect(tema.closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("main").hasAttribute("inert")).toBe(true);
  });
});

describe("jargão e rótulos", () => {
  it("resumo do cliente: o módulo aparece com rótulo, não com o enum", () => {
    render(
      <AbaResumo
        acoesDeModulo={null}
        integracoes={[]}
        modulos={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
      />
    );
    expect(screen.getByText("Cosmos")).toBeTruthy();
    expect(screen.queryByText("COSMOS")).toBeNull();
  });
});
