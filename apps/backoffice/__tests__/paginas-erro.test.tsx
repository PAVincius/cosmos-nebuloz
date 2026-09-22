/** @vitest-environment jsdom */
// paginas-erro.test.tsx — crítica rodada 2 (25/40), cobertura: o padrão de
// recuperação (`FalhaAoCarregar`, NFR-4) existia e estava em 2 de 31 telas.
// As outras respondiam à falha de leitura com um `<p>` vermelho solto — sem
// botão, e em `versao` sem nem cabeçalho.
//
// Uma linha por rota: com a leitura mockada falhando, o `PageHeader` fica de
// pé (h1) e existe um "Tentar de novo". Voltar qualquer rota para o `<p>` tira
// o botão e derruba a linha dela.
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const nomes = [
    "getClient",
    "getPropostaParaEdicao",
    "getServiceDetail",
    "lerAvaliacao",
    "lerCac",
    "lerCaixa",
    "lerConsentimento",
    "lerDre",
    "lerEstadoDoDeploy",
    "lerOrcado",
    "listAccountHealth",
    "listAuditEvents",
    "listAuditTenants",
    "listBenchmark",
    "listCapacity",
    "listClients",
    "listDiagrams",
    "listEngagements",
    "listGateQueue",
    "listIpAssets",
    "listPlatformApprovals",
    "listPlatformHealth",
    "listProposals",
    "listServices",
    "listStaffActivity",
    "listTenantAudit",
    "listTenantIntegrations",
    "listTenantMembers",
    "listarAvaliacoes",
    "listarCatalogoComercial",
    "listarFornecedoresDpa",
    "listarFunil",
    "listarLancamentos",
    "listarPlanoDeContas",
    "listarProcessos",
    "listarRecorrente",
    "listarTitulos",
    "refresh",
    "requirePlatformStaff",
  ] as const;
  const m = {} as Record<(typeof nomes)[number], ReturnType<typeof vi.fn>>;
  for (const n of nomes) {
    m[n] = vi.fn();
  }
  return m;
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
// Lê o enum do Prisma via `@repo/database`, que sob jsdom tropeça no guard de
// env do @t3-oss antes de a página renderizar.
vi.mock("@/lib/modulos", () => ({ MODULOS_DA_PLATAFORMA: [] }));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/accounts", () => ({
  listAccountHealth: mocks.listAccountHealth,
}));
vi.mock("@/app/actions/approvals", () => ({
  listPlatformApprovals: mocks.listPlatformApprovals,
}));
vi.mock("@/app/actions/audit", () => ({
  listAuditEvents: mocks.listAuditEvents,
  listAuditTenants: mocks.listAuditTenants,
}));
vi.mock("@/app/actions/benchmark", () => ({
  listBenchmark: mocks.listBenchmark,
}));
vi.mock("@/app/actions/capacity", () => ({
  listCapacity: mocks.listCapacity,
}));
vi.mock("@/app/actions/catalogo-comercial", () => ({
  listarCatalogoComercial: mocks.listarCatalogoComercial,
}));
vi.mock("@/app/actions/clients", () => ({
  getClient: mocks.getClient,
  listClients: mocks.listClients,
  listStaffActivity: mocks.listStaffActivity,
}));
vi.mock("@/app/actions/diagrams", () => ({
  listDiagrams: mocks.listDiagrams,
}));
vi.mock("@/app/actions/empresa/cac", () => ({ lerCac: mocks.lerCac }));
vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: mocks.lerConsentimento,
}));
vi.mock("@/app/actions/empresa/financeiro", () => ({
  lerCaixa: mocks.lerCaixa,
  lerDre: mocks.lerDre,
  listarPlanoDeContas: mocks.listarPlanoDeContas,
}));
vi.mock("@/app/actions/empresa/fornecedores", () => ({
  listarFornecedoresDpa: mocks.listarFornecedoresDpa,
}));
vi.mock("@/app/actions/empresa/livro", () => ({
  listarLancamentos: mocks.listarLancamentos,
}));
vi.mock("@/app/actions/empresa/orcamento", () => ({
  lerOrcado: mocks.lerOrcado,
}));
vi.mock("@/app/actions/empresa/recorrente", () => ({
  listarRecorrente: mocks.listarRecorrente,
}));
vi.mock("@/app/actions/empresa/titulos", () => ({
  listarTitulos: mocks.listarTitulos,
}));
vi.mock("@/app/actions/engagements", () => ({
  listEngagements: mocks.listEngagements,
}));
vi.mock("@/app/actions/ip-library", () => ({
  listIpAssets: mocks.listIpAssets,
}));
vi.mock("@/app/actions/leads", () => ({ listarFunil: mocks.listarFunil }));
vi.mock("@/app/actions/maturidade", () => ({
  lerAvaliacao: mocks.lerAvaliacao,
  listarAvaliacoes: mocks.listarAvaliacoes,
}));
vi.mock("@/app/actions/processos", () => ({
  listarProcessos: mocks.listarProcessos,
}));
vi.mock("@/app/actions/proposals", () => ({
  listProposals: mocks.listProposals,
}));
vi.mock("@/app/actions/proposta-escopo", () => ({
  getPropostaParaEdicao: mocks.getPropostaParaEdicao,
}));
// O detalhe do cliente importa as actions de provisionamento pelos formulários
// de módulo; a falha de leitura nunca as chama, mas o import puxa o banco.
vi.mock("@/app/actions/provisioning", () => ({
  bootstrapCharterAction: vi.fn(),
  bootstrapMeridianAction: vi.fn(),
  contractModuleAction: vi.fn(),
}));
vi.mock("@/app/actions/scaffold-supervision", () => ({
  listGateQueue: mocks.listGateQueue,
}));
vi.mock("@/app/actions/services", () => ({
  getServiceDetail: mocks.getServiceDetail,
  listServices: mocks.listServices,
}));
vi.mock("@/app/actions/tenant-members", () => ({
  listTenantMembers: mocks.listTenantMembers,
}));
vi.mock("@/app/actions/tenant-observability", () => ({
  listTenantAudit: mocks.listTenantAudit,
  listTenantIntegrations: mocks.listTenantIntegrations,
}));
vi.mock("@/app/actions/versao", () => ({
  lerEstadoDoDeploy: mocks.lerEstadoDoDeploy,
}));
// Painéis pesados que a falha de leitura nunca monta — é o import que pesa.
vi.mock("@/app/(staff)/propostas/[id]/gerador", () => ({
  Gerador: () => null,
}));
vi.mock("@/app/(staff)/ferramentas/estudio", () => ({
  Estudio: () => null,
}));
vi.mock("@/app/(staff)/ferramentas/processos/mapa", () => ({
  Mapa: () => null,
}));
vi.mock("@/app/(staff)/funil/funil", () => ({ Funil: () => null }));

vi.setConfig({ testTimeout: 30_000 });

const FALHA = { error: "Banco indisponível.", ok: false } as const;
const OK_VAZIO = { data: [], ok: true } as const;

type Mock = keyof typeof mocks;

type Rota = {
  rota: string;
  importar: () => Promise<{ default: (props: never) => Promise<ReactNode> }>;
  /** A leitura que falha. */
  falha: Mock[];
  /** Leituras irmãs que respondem vazio para a página não tropeçar antes. */
  ok?: Mock[];
  props?: Record<string, unknown>;
  heading: string | RegExp;
};

const ROTAS: Rota[] = [
  {
    falha: ["listClients"],
    heading: "Carteira de clientes",
    importar: () => import("@/app/(staff)/clientes/page"),
    rota: "/clientes",
  },
  {
    falha: ["listPlatformHealth"],
    heading: "Home",
    importar: () => import("@/app/(staff)/page"),
    ok: ["listPlatformApprovals"],
    rota: "/",
  },
  {
    falha: ["listPlatformApprovals"],
    heading: "Aprovações",
    importar: () => import("@/app/(staff)/aprovacoes/page"),
    rota: "/aprovacoes",
  },
  {
    falha: ["listStaffActivity"],
    heading: "Atividade do staff",
    importar: () => import("@/app/(staff)/atividade/page"),
    rota: "/atividade",
  },
  {
    falha: ["listAuditEvents"],
    heading: "Trilha de auditoria",
    importar: () => import("@/app/(staff)/audit/page"),
    ok: ["listAuditTenants"],
    props: { searchParams: Promise.resolve({}) },
    rota: "/audit",
  },
  {
    falha: ["listBenchmark"],
    heading: "Benchmark",
    importar: () => import("@/app/(staff)/benchmark/page"),
    rota: "/benchmark",
  },
  {
    falha: ["listCapacity", "listEngagements"],
    heading: "Capacidade",
    importar: () => import("@/app/(staff)/capacidade/page"),
    rota: "/capacidade",
  },
  {
    falha: ["getClient"],
    heading: "atlas",
    importar: () => import("@/app/(staff)/clientes/[slug]/page"),
    ok: ["listTenantMembers", "listTenantIntegrations", "listTenantAudit"],
    props: { params: Promise.resolve({ slug: "atlas" }) },
    rota: "/clientes/[slug]",
  },
  {
    falha: ["listAccountHealth"],
    heading: "Saúde e renovação",
    importar: () => import("@/app/(staff)/contas/page"),
    rota: "/contas",
  },
  {
    falha: ["listEngagements", "listAuditTenants", "listServices"],
    heading: "Engajamentos",
    importar: () => import("@/app/(staff)/delivery/page"),
    rota: "/delivery",
  },
  {
    falha: ["lerCac"],
    heading: "CAC totalmente carregado",
    importar: () => import("@/app/(staff)/empresa/cac/page"),
    props: { searchParams: Promise.resolve({}) },
    rota: "/empresa/cac",
  },
  {
    falha: ["lerConsentimento"],
    heading: "Consentimento de gravação",
    importar: () => import("@/app/(staff)/empresa/consentimento/page"),
    rota: "/empresa/consentimento",
  },
  {
    falha: ["lerDre"],
    heading: "Financeiro",
    importar: () => import("@/app/(staff)/empresa/financeiro/page"),
    props: { searchParams: Promise.resolve({}) },
    rota: "/empresa/financeiro",
  },
  {
    falha: ["listarFornecedoresDpa"],
    heading: "DPA dos fornecedores",
    importar: () => import("@/app/(staff)/empresa/fornecedores/page"),
    rota: "/empresa/fornecedores",
  },
  {
    falha: ["listDiagrams"],
    heading: "Modelagem BPMN",
    importar: () => import("@/app/(staff)/ferramentas/bpmn/page"),
    ok: ["listClients"],
    rota: "/ferramentas/bpmn",
  },
  {
    falha: ["listDiagrams"],
    heading: "Diagramas",
    importar: () => import("@/app/(staff)/ferramentas/diagramas/page"),
    ok: ["listClients"],
    rota: "/ferramentas/diagramas",
  },
  {
    falha: ["listarProcessos"],
    heading: "Mapa de processos",
    importar: () => import("@/app/(staff)/ferramentas/processos/page"),
    rota: "/ferramentas/processos",
  },
  {
    falha: ["listarFunil"],
    heading: "Funil",
    importar: () => import("@/app/(staff)/funil/page"),
    rota: "/funil",
  },
  {
    falha: ["listarAvaliacoes"],
    heading: "Maturidade de IA",
    importar: () => import("@/app/(staff)/growth/readiness/page"),
    rota: "/growth/readiness",
  },
  {
    falha: ["lerAvaliacao"],
    heading: "Avaliação",
    importar: () => import("@/app/(staff)/growth/readiness/[id]/page"),
    props: { params: Promise.resolve({ id: "av-1" }) },
    rota: "/growth/readiness/[id]",
  },
  {
    falha: ["listIpAssets", "listEngagements", "listServices", "listCapacity"],
    heading: "Biblioteca de IP",
    importar: () => import("@/app/(staff)/ip/page"),
    rota: "/ip",
  },
  {
    falha: ["listPlatformHealth"],
    heading: "Observabilidade",
    importar: () => import("@/app/(staff)/observabilidade/page"),
    rota: "/observabilidade",
  },
  {
    falha: ["listProposals"],
    heading: "Propostas",
    importar: () => import("@/app/(staff)/propostas/page"),
    rota: "/propostas",
  },
  {
    falha: ["listarCatalogoComercial"],
    heading: "Gerador de proposta",
    importar: () => import("@/app/(staff)/propostas/[id]/page"),
    ok: ["listServices"],
    props: { params: Promise.resolve({ id: "nova" }) },
    rota: "/propostas/[id]",
  },
  {
    falha: ["listGateQueue"],
    heading: "Fila de gates",
    importar: () => import("@/app/(staff)/scaffold/page"),
    rota: "/scaffold",
  },
  {
    falha: ["listServices"],
    heading: "Serviços",
    importar: () => import("@/app/(staff)/servicos/page"),
    rota: "/servicos",
  },
  {
    falha: ["getServiceDetail"],
    heading: "SRV-1",
    importar: () => import("@/app/(staff)/servicos/[codigo]/page"),
    props: {
      params: Promise.resolve({ codigo: "SRV-1" }),
      searchParams: Promise.resolve({}),
    },
    rota: "/servicos/[codigo]",
  },
  {
    falha: ["lerEstadoDoDeploy"],
    heading: "Versão e schema",
    importar: () => import("@/app/(staff)/versao/page"),
    rota: "/versao",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePlatformStaff.mockResolvedValue({ canWrite: true });
});

describe("falha de leitura em toda rota: cabeçalho de pé e Tentar de novo", () => {
  it.each(ROTAS)("$rota", async ({ importar, falha, ok, props, heading }) => {
    for (const nome of falha) {
      mocks[nome].mockResolvedValue(FALHA);
    }
    for (const nome of ok ?? []) {
      mocks[nome].mockResolvedValue(OK_VAZIO);
    }
    const { default: Page } = await importar();
    render(await Page((props ?? {}) as never));

    expect(
      screen.getByRole("heading", { level: 1, name: heading })
    ).toBeTruthy();
    // `findBy`: no financeiro o corpo da aba chega por um `<Suspense>` local
    // (cabeçalho e abas ficam fora dele); nas demais rotas já está lá.
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Banco indisponível."
    );
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeTruthy();
  });
});

describe("telas que somam leituras: uma linha por leitura que falhou", () => {
  it("/delivery lista cada motivo separado, sem concatenar", async () => {
    mocks.listEngagements.mockResolvedValue({
      error: "Engajamentos fora do ar.",
      ok: false,
    });
    mocks.listAuditTenants.mockResolvedValue({
      error: "Clientes fora do ar.",
      ok: false,
    });
    mocks.listServices.mockResolvedValue(OK_VAZIO);
    const { default: Page } = await import("@/app/(staff)/delivery/page");
    render(await Page());

    const alerta = screen.getByRole("alert");
    const linhas = Array.from(alerta.querySelectorAll("p")).map(
      (p) => p.textContent
    );
    expect(linhas.some((l) => l?.includes("Engajamentos fora do ar."))).toBe(
      true
    );
    expect(linhas.some((l) => l?.includes("Clientes fora do ar."))).toBe(true);
    // Sem concatenar: nenhum parágrafo carrega os dois motivos.
    expect(
      linhas.some(
        (l) =>
          l?.includes("Engajamentos fora do ar.") &&
          l?.includes("Clientes fora do ar.")
      )
    ).toBe(false);
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeTruthy();
  });
});
