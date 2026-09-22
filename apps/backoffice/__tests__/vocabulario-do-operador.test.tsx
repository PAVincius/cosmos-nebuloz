/** @vitest-environment jsdom */
// vocabulario-do-operador.test.tsx — heurísticas 1 (status), 2 (mundo real)
// e 8 (a11y), rodada 3.
//
// - Sucesso mudo: enviar da lista de propostas só trocava a badge; salvar
//   processo, lançamento e diagrama terminavam em `recarregar()` sem frase.
// - "tenant" em texto de UI vira "cliente"; "tenant system" fica só onde é o
//   identificador do schema. Papéis crus no `<select>` ganham rótulo humano.
// - Sigla sem expansão (ACV, MRR, ARR, DPA) vira `<abbr title>` com a
//   expansão visível na primeira ocorrência da tela.
// - Submit cinza diz o campo que falta, como o gerador de propostas já faz.
// - `Campo`: hint e erro descrevem o input; `WriteButton` bloqueado continua
//   no Tab e anuncia o motivo; `<th>` fora do `Tabela` tem `scope`.
// - `<title>` por tela e eyebrow lido do `nav.ts`, não repetido à mão.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AbaUsuarios } from "@/app/(staff)/clientes/[slug]/abas/usuarios";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { Lancamentos } from "@/app/(staff)/empresa/financeiro/lancamentos";
import { Recorrente } from "@/app/(staff)/empresa/financeiro/recorrente";
import { Mapa } from "@/app/(staff)/ferramentas/processos/mapa";
import { Lista } from "@/app/(staff)/growth/readiness/lista";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import type { ProposalRow } from "@/app/actions/proposals";
import type { TenantMemberRow } from "@/app/actions/tenant-members";
import { Campo, Erro } from "@/components/campo";
import { itemDaRota, tituloDaAba } from "@/components/nav";
import { WriteButton } from "@/components/write-button";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  atualizarLancamento: vi.fn(),
  atualizarProcesso: vi.fn(),
  criarAvaliacao: vi.fn(),
  criarLancamento: vi.fn(),
  criarProcesso: vi.fn(),
  listEngagements: vi.fn(),
  listarLancamentos: vi.fn(),
  listarProcessos: vi.fn(),
  submitProposalAction: vi.fn(),
  updateTenantMemberRoleAction: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: mocks.submitProposalAction,
}));
vi.mock("@/app/actions/processos", () => ({
  atualizarProcesso: mocks.atualizarProcesso,
  criarLigacao: vi.fn(),
  criarProcesso: mocks.criarProcesso,
  excluirLigacao: vi.fn(),
  excluirProcesso: vi.fn(),
  listarProcessos: mocks.listarProcessos,
}));
vi.mock("@/app/actions/empresa/livro", () => ({
  atualizarLancamento: mocks.atualizarLancamento,
  criarLancamento: mocks.criarLancamento,
  excluirLancamento: vi.fn(),
  listarLancamentos: mocks.listarLancamentos,
}));
vi.mock("@/app/actions/empresa/recorrente", () => ({
  alterarValor: vi.fn(),
  criarAssinatura: vi.fn(),
  encerrarAssinatura: vi.fn(),
  listarRecorrente: vi.fn(),
}));
vi.mock("@/app/actions/clients", () => ({
  listClients: vi.fn(),
}));
vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: mocks.updateTenantMemberRoleAction,
}));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: vi.fn(),
  listEngagements: mocks.listEngagements,
  setEngagementStatusAction: vi.fn(),
}));
vi.mock("@/app/actions/services", () => ({
  createServiceAction: vi.fn(),
  setServiceAtivoAction: vi.fn(),
}));
vi.mock("@/app/actions/maturidade", () => ({
  criarAvaliacao: mocks.criarAvaliacao,
}));

const PROPOSTA: ProposalRow = {
  acvCentavos: 100_000,
  cliente: "Atlas Energia",
  criadoEm: "2026-09-01T00:00:00.000Z",
  descontoPercent: 0,
  id: "prop-1",
  numero: "P-0001",
  status: "RASCUNHO",
  titulo: "Atlas — plataforma",
  totalCentavos: 100_000,
};

const CONTAS: ContaView[] = [
  {
    ativa: true,
    centroDeCusto: "comercial",
    conta: "4.1",
    grupo: 4,
    nome: "Publicidade paga",
    ordem: 0,
  },
];

const MEMBRO: TenantMemberRow = {
  desde: "2026-09-01T00:00:00.000Z",
  email: "ana@atlas.com.br",
  id: "m-1",
  nome: "Ana",
  role: "DEV",
};

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
});

describe("Sucesso dito em texto, no lugar", () => {
  it("Propostas — enviar pela linha confirma «título» enviada, na linha", async () => {
    mocks.submitProposalAction.mockResolvedValue({
      data: { status: "ENVIADA" },
      ok: true,
    });
    render(<Propostas iniciais={[PROPOSTA]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Atlas — plataforma");
    expect(status.textContent).toMatch(/enviada/);
    expect(status.closest("li")?.textContent).toContain("P-0001");
  });

  it("Mapa — salvar um processo novo confirma pelo código depois da releitura", async () => {
    const DADOS = { diagramas: [], ligacoes: [], processos: [] };
    mocks.listarProcessos.mockResolvedValue({ data: DADOS, ok: true });
    mocks.criarProcesso.mockResolvedValue({ data: { id: "novo" }, ok: true });
    zerarRoteador("/ferramentas/processos");
    render(<Mapa inicial={DADOS} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Novo processo" }));
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "PZ-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Onboarding" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Recebe o cliente novo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("PZ-09");
    expect(mocks.listarProcessos).toHaveBeenCalled();
  });

  it("Lançamentos — criar confirma pela descrição depois da releitura", async () => {
    const PAYLOAD = { contas: CONTAS, linhas: [] };
    mocks.listarLancamentos.mockResolvedValue({ data: PAYLOAD, ok: true });
    mocks.criarLancamento.mockResolvedValue({ data: { id: "novo" }, ok: true });
    render(
      <Lancamentos
        contaFiltro={null}
        inicial={PAYLOAD}
        intervalo={{ ate: "2026-09-30", de: "2026-09-01" }}
        podeEscrever
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Novo lançamento" }));
    fireEvent.change(screen.getByLabelText("Competência"), {
      target: { value: "2026-09" },
    });
    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-09-15" },
    });
    fireEvent.change(screen.getByLabelText("Conta"), {
      target: { value: "4.1" },
    });
    fireEvent.change(screen.getByLabelText("Descrição"), {
      target: { value: "Nova despesa" },
    });
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "1.234,56" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Nova despesa");
    expect(mocks.listarLancamentos).toHaveBeenCalled();
  });
});

describe("Vocabulário do operador: cliente, não tenant", () => {
  it("Usuários — textos dizem cliente; 'tenant system' fica só como identificador", () => {
    render(<AbaUsuarios canWrite={false} membros={[MEMBRO]} slug="atlas" />);
    expect(screen.getByText(/Papel dentro do cliente/)).toBeTruthy();
    expect(screen.getByText(/administra o cliente/)).toBeTruthy();
    expect(
      screen.getByText(/seu papel no tenant system é MEMBER/)
    ).toBeTruthy();
    expect(screen.queryByText(/tenant do cliente/)).toBeNull();
  });

  it("Usuários — vazio fala em cliente", () => {
    render(<AbaUsuarios canWrite membros={[]} slug="atlas" />);
    expect(screen.getByText(/Este cliente não tem membro algum/)).toBeTruthy();
  });

  it("Usuários — as opções do select têm rótulo humano, o valor segue o enum", () => {
    render(<AbaUsuarios canWrite membros={[MEMBRO]} slug="atlas" />);
    const membro = screen.getByRole("option", {
      name: "Membro",
    }) as HTMLOptionElement;
    expect(membro.value).toBe("MEMBER");
    expect(
      (
        screen.getByRole("option", {
          name: "Administrador",
        }) as HTMLOptionElement
      ).value
    ).toBe("ADMIN");
  });
});

describe("Siglas com expansão", () => {
  it("Recorrente — MRR e ARR são <abbr> com título e expansão visível na primeira vez", () => {
    render(
      <Recorrente
        competencia="2026-09"
        inicial={{
          assinaturas: [],
          creditos: [],
          lancamentosDaCompetencia: {},
          mudancas: [],
        }}
        podeEscrever={false}
      />
    );
    const mrr = screen.getAllByText("MRR")[0];
    expect(mrr.tagName).toBe("ABBR");
    expect(mrr.getAttribute("title")).toMatch(/receita recorrente mensal/i);
    expect(mrr.parentElement?.textContent?.toLowerCase()).toContain(
      "receita recorrente mensal"
    );
  });
});

describe("Submit cinza diz o que falta", () => {
  it("Engajamentos — com o formulário vazio, a frase nomeia código, nome e cliente", () => {
    render(
      <Engajamentos
        clientes={[{ id: "t1", name: "Atlas", slug: "atlas" }]}
        iniciais={[]}
        podeEscrever
        servicos={[]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Novo engajamento" }));
    const falta = screen.getByText(/Para criar:/);
    expect(falta.textContent).toMatch(/código/i);
    expect(falta.textContent).toMatch(/nome/i);
    expect(falta.textContent).toMatch(/cliente/i);

    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "ENG-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Roadmap" },
    });
    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "t1" },
    });
    expect(screen.queryByText(/Para criar:/)).toBeNull();
  });

  it("Catálogo — a frase some quando código e nome estão preenchidos", () => {
    render(<Catalogo iniciais={[]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Novo serviço" }));
    expect(screen.getByText(/Para cadastrar:/).textContent).toMatch(/código/i);
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "SV-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Diagnóstico" },
    });
    expect(screen.queryByText(/Para cadastrar:/)).toBeNull();
  });

  it("Nova avaliação — sem organização, a frase diz o que falta", () => {
    render(<Lista avaliacoes={[]} podeEscrever totalDeCriterios={8} />);
    expect(screen.getByText(/Para criar:/).textContent).toMatch(/organização/i);
    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "Atlas" },
    });
    expect(screen.queryByText(/Para criar:/)).toBeNull();
  });
});

describe("Campo — hint e erro ligados ao input", () => {
  it("o input é descrito pelo hint e, com erro, também pelo erro e fica aria-invalid", () => {
    const { rerender } = render(
      <Campo hint="ex. ENG-01" htmlFor="c1" label="Código">
        <input id="c1" />
      </Campo>
    );
    const input = screen.getByLabelText("Código");
    const descritoPor = input.getAttribute("aria-describedby") ?? "";
    expect(descritoPor).not.toBe("");
    const hint = document.getElementById(descritoPor.split(" ")[0]);
    expect(hint?.textContent).toBe("ex. ENG-01");
    expect(input.getAttribute("aria-invalid")).toBeNull();

    rerender(
      <Campo
        erro="Código já existe"
        hint="ex. ENG-01"
        htmlFor="c1"
        label="Código"
      >
        <input id="c1" />
      </Campo>
    );
    const comErro = screen.getByLabelText("Código");
    expect(comErro.getAttribute("aria-invalid")).toBe("true");
    const ids = (comErro.getAttribute("aria-describedby") ?? "").split(" ");
    const textos = ids.map((id) => document.getElementById(id)?.textContent);
    expect(textos).toContain("ex. ENG-01");
    expect(textos).toContain("Código já existe");
    expect(screen.getByRole("alert").textContent).toBe("Código já existe");
  });

  it("Erro solto continua um alert", () => {
    render(<Erro>Falhou</Erro>);
    expect(screen.getByRole("alert").textContent).toBe("Falhou");
  });
});

describe("WriteButton bloqueado continua no Tab", () => {
  it("recebe foco, anuncia o motivo e ignora o clique", () => {
    const onClick = vi.fn();
    render(
      <WriteButton canWrite={false} onClick={onClick}>
        Contratar módulo
      </WriteButton>
    );
    const botao = screen.getByRole("button", { name: /Contratar módulo/ });
    expect(botao.getAttribute("aria-disabled")).toBe("true");
    expect(botao.hasAttribute("disabled")).toBe(false);
    botao.focus();
    expect(document.activeElement).toBe(botao);
    fireEvent.click(botao);
    expect(onClick).not.toHaveBeenCalled();
    const motivo = document.getElementById(
      botao.getAttribute("aria-describedby") ?? ""
    );
    expect(motivo?.textContent).toMatch(/MEMBER/);
  });
});

/** Os `page.tsx` desta frente — os da 6a ficam de fora. */
const RAIZ = path.resolve(__dirname, "../app/(staff)");
const FORA = new Set([
  "clientes/[slug]/page.tsx",
  "empresa/financeiro/page.tsx",
  "servicos/[codigo]/page.tsx",
  "growth/readiness/[id]/page.tsx",
  "propostas/[id]/page.tsx",
  "empresa/cac/page.tsx",
  // Só redireciona para `/` desde a rodada 5 — não tem tela, nem título.
  "home/page.tsx",
]);

function paginas(dir = RAIZ): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      return paginas(p);
    }
    return e.name === "page.tsx" ? [p] : [];
  });
}

describe("<title> por tela e eyebrow do nav.ts", () => {
  const minhas = paginas()
    .map((p) => path.relative(RAIZ, p))
    .filter((p) => !FORA.has(p));

  it("tituloDaAba lê o rótulo do menu", () => {
    expect(tituloDaAba("/funil")).toBe(
      `${itemDaRota("/funil")?.label} — Back-office Nebuloz`
    );
  });

  it.each(minhas)("%s exporta metadata com tituloDaAba", (rel) => {
    const fonte = readFileSync(path.join(RAIZ, rel), "utf8");
    expect(fonte).toMatch(/export const metadata = \{[^}]*tituloDaAba\(/);
  });

  it.each(minhas)("%s não escreve o eyebrow à mão", (rel) => {
    const fonte = readFileSync(path.join(RAIZ, rel), "utf8");
    expect(fonte).not.toMatch(/eyebrow="/);
  });
});

describe("<th> fora do Tabela tem scope", () => {
  it.each([
    "benchmark/page.tsx",
    "growth/readiness/lista.tsx",
    "empresa/financeiro/orcado.tsx",
    "audit/page.tsx",
    "clientes/[slug]/observabilidade.tsx",
  ])("%s", (rel) => {
    const fonte = readFileSync(path.join(RAIZ, rel), "utf8");
    const ths = fonte.match(/<th\b[^>]*>/gs) ?? [];
    expect(ths.length).toBeGreaterThan(0);
    for (const th of ths) {
      expect(th).toMatch(/scope=/);
    }
  });
});
