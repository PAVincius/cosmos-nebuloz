/** @vitest-environment jsdom */
// copy-operador.test.tsx — heurística 2 (correspondência com o mundo real).
//
// O que se prova aqui é que nenhum nome de função, ID de spec ou instrução de
// engenharia ("rode o seed") chega à tela. Jordan, no primeiro dia, lê o
// subtítulo de um card e precisa entender o que a tela mostra — não qual
// server action a alimenta. O texto novo diz o que o operador confere e o que
// faz aqui; o rastro para a spec fica em comentário no código, não no rótulo.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import type { LeadRow } from "@/app/actions/leads";
import type { QueueEntry } from "@/app/actions/scaffold-supervision";
import { MOTIVO_SOMENTE_LEITURA } from "@/components/write-button";
import type { ConfigEstagio } from "@/lib/comercial/funil";

const mocks = vi.hoisted(() => ({
  listAuditEvents: vi.fn(),
  listAuditTenants: vi.fn(),
  listClients: vi.fn(),
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
  listStaffActivity: vi.fn(),
  requirePlatformStaff: vi.fn(),
}));

vi.mock("@/app/actions/agregados", () => import("../vitest-mocks/agregados"));
vi.mock("@/app/actions/clients", () => ({
  listClients: mocks.listClients,
  listStaffActivity: mocks.listStaffActivity,
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
vi.mock("@/app/actions/scaffold-supervision", () => ({
  enterTenantContext: vi.fn(),
}));
vi.mock("@/app/actions/capacity", () => ({
  allocatePersonAction: vi.fn(),
  createPersonAction: vi.fn(),
}));
vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
}));
vi.mock("@/app/sign-in/form", () => ({
  SignInForm: () => <form aria-label="entrar" />,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/audit",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/** Tudo que vazou de código para a tela na crítica de design. */
const VAZAMENTO =
  /listClients|listStaffActivity|listAuditEvents|listPlatformApprovals|assertCanWrite|requirePlatformStaff|rode o seed|ondas 3|NFR-|FR-30|SG-06/;

// Importar uma página puxa o painel dela inteiro — é o import, não o render,
// que pesa; com a suíte em paralelo isso passa dos 5s padrão.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("carteira de clientes (/clientes)", () => {
  it("diz o que a lista é e que só o nome abre o detalhe", async () => {
    mocks.listClients.mockResolvedValue({ ok: true, data: [] });
    const { default: Page } = await import("@/app/(staff)/clientes/page");
    render(await Page());

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(
      screen.getByText(
        "Todos os clientes da plataforma. O nome abre o detalhe."
      )
    ).toBeTruthy();
  });
});

describe("atividade do staff", () => {
  it("o subtítulo da trilha fala de ordem, não de função", async () => {
    mocks.listStaffActivity.mockResolvedValue({ ok: true, data: [] });
    const { default: Page } = await import("@/app/(staff)/atividade/page");
    render(await Page());

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(screen.getByText("Mais recentes primeiro")).toBeTruthy();
  });
});

describe("audit explorer", () => {
  it("quando a busca falha, o subtítulo diz isso em vez do nome da função", async () => {
    mocks.listAuditTenants.mockResolvedValue({ ok: true, data: [] });
    mocks.listAuditEvents.mockResolvedValue({
      ok: false,
      error: "Banco indisponível.",
    });
    const { default: Page } = await import("@/app/(staff)/audit/page");
    render(await Page({ searchParams: Promise.resolve({}) }));

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(screen.getByText("Não foi possível carregar")).toBeTruthy();
  });
});

describe("aprovações", () => {
  it("fila vazia diz o que gera um pedido hoje, sem jargão de roadmap", async () => {
    mocks.requirePlatformStaff.mockResolvedValue({ canWrite: true });
    mocks.listPlatformApprovals.mockResolvedValue({ ok: true, data: [] });
    const { default: Page } = await import("@/app/(staff)/aprovacoes/page");
    render(await Page());

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(screen.getByText("Nada pendente")).toBeTruthy();
    // Subtítulo e vazio dizem a mesma coisa — o subtítulo listava cinco
    // operações e o vazio dizia que só uma passa (crítica rodada 4).
    expect(
      screen.getAllByText(/proposta com desconto acima de 15%/)
    ).toHaveLength(2);
  });
});

describe("observabilidade", () => {
  it("os subtítulos dizem o que o operador confere, sem ID de spec nem SQL", async () => {
    mocks.listPlatformHealth.mockResolvedValue({
      ok: true,
      data: { acessos: [], integracoes: [], recusas: 0 },
    });
    const { default: Page } = await import(
      "@/app/(staff)/observabilidade/page"
    );
    render(await Page());

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(screen.queryByText(/o select não a seleciona/)).toBeNull();
    expect(
      screen.getByText(
        "Nome, fonte e erro de cada integração — a credencial não chega a esta tela."
      )
    ).toBeTruthy();
    expect(screen.getByText("Quem entrou, quando e de onde")).toBeTruthy();
  });
});

describe("fila de gates", () => {
  it("o grupo 'Em observação' não cita o ID da regra", async () => {
    const { FilaDeGates } = await import(
      "@/app/(staff)/scaffold/fila-de-gates"
    );
    const entrada: QueueEntry = {
      ageDays: 3,
      ageLabel: "3d",
      criteriaMet: 2,
      criteriaTotal: 2,
      kind: "observing",
      orgName: "Acme",
      phase: "PILOT",
      phaseInstanceId: "pi-1",
      trackCode: "TRK-1",
      trackId: "t-1",
    };
    render(<FilaDeGates iniciais={[entrada]} />);

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(
      screen.getByText("Janela de 30 dias correndo; reabrir zera a contagem")
    ).toBeTruthy();
  });
});

describe("botão somente leitura", () => {
  it("usa a frase combinada entre as ondas, sem nome de função", () => {
    expect(MOTIVO_SOMENTE_LEITURA).toBe(
      "Somente leitura: seu papel no back-office é MEMBER. Um ADMIN precisa fazer esta ação."
    );
  });
});

describe("login", () => {
  it("diz o que a pessoa precisa ter, não qual guard a barra", async () => {
    const { default: Page } = await import("@/app/sign-in/page");
    render(<Page />);

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(
      screen.getByText(
        "Acesso restrito à equipe da Nebuloz: conta de staff da plataforma com verificação em dois fatores."
      )
    ).toBeTruthy();
  });
});

describe("funil sem configuração", () => {
  const HOJE = new Date("2026-09-06T12:00:00.000Z");

  it("board sem estágio pede a um ADMIN, não manda rodar seed", async () => {
    const { Board } = await import("@/app/(staff)/funil/board");
    const estagios: ConfigEstagio[] = [];
    const leads: LeadRow[] = [];
    render(
      <Board
        estagios={estagios}
        hoje={HOJE}
        leads={leads}
        onAbrirEstagio={vi.fn()}
        onAbrirLead={vi.fn()}
        onConverter={vi.fn()}
        onMover={vi.fn()}
        onPerder={vi.fn()}
        podeEscrever
      />
    );

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(
      screen.getByText("Nenhum estágio configurado — peça a um ADMIN.")
    ).toBeTruthy();
  });

  it("diálogo de lead sem canal pede a um ADMIN, não manda rodar seed", async () => {
    const { NovoLeadDialog } = await import(
      "@/app/(staff)/funil/novo-lead-dialog"
    );
    render(
      <NovoLeadDialog aberto canais={[]} onClose={vi.fn()} onCriar={vi.fn()} />
    );

    expect(screen.queryAllByText(VAZAMENTO)).toHaveLength(0);
    expect(
      screen.getByText("Nenhum canal cadastrado — peça a um ADMIN.")
    ).toBeTruthy();
  });
});

describe("capacidade", () => {
  it("o formulário de alocação diz quem está sendo alocado", async () => {
    const { Capacidade } = await import("@/app/(staff)/capacidade/capacidade");
    const pessoa: PessoaCapacidade = {
      alocacoes: [],
      ativo: true,
      email: "ana@nebuloz.ai",
      entraEm: null,
      habilidades: [],
      horasSemana: 40,
      id: "p-1",
      nome: "Ana Souza",
      observacao: null,
      ocupacaoAtual: 0,
      saiEm: null,
    };
    const engajamentos: EngagementRow[] = [];
    render(
      <Capacidade
        engajamentos={engajamentos}
        iniciais={[pessoa]}
        podeEscrever
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Alocar" }));

    expect(screen.getByText("Nova alocação — Ana Souza")).toBeTruthy();
  });
});
