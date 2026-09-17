/** @vitest-environment jsdom */
// sucesso-no-lugar.test.tsx — heurística 1 (status): o sucesso precisa ser
// dito, e dito junto do controle que agiu. Trocar papel, salvar pesos e
// conversão do CAC eram mudos; a confirmação da Capacidade morava no topo da
// página, longe da linha; e "Alocar" montava o formulário acima da lista sem
// foco. Tudo passa a usar o mesmo `<Confirmacao>` (role=status, polite).
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacidade } from "@/app/(staff)/capacidade/capacidade";
import { AbaUsuarios } from "@/app/(staff)/clientes/[slug]/abas/usuarios";
import { Painel } from "@/app/(staff)/empresa/cac/painel";
import { PainelDeEnvio } from "@/app/(staff)/propostas/[id]/gerador-envio";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { CacView } from "@/app/actions/empresa/cac";
import type { EngagementRow } from "@/app/actions/engagements";
import type { TenantMemberRow } from "@/app/actions/tenant-members";
import { Confirmacao } from "@/components/confirmacao";

const mocks = vi.hoisted(() => ({
  allocatePersonAction: vi.fn(),
  listCapacity: vi.fn(),
  salvarAlocacao: vi.fn(),
  salvarConversao: vi.fn(),
  salvarParcelas: vi.fn(),
  updateTenantMemberRoleAction: vi.fn(),
}));

vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: mocks.updateTenantMemberRoleAction,
}));
vi.mock("@/app/actions/empresa/cac", () => ({
  salvarAlocacao: mocks.salvarAlocacao,
  salvarConversao: mocks.salvarConversao,
  salvarParcelas: mocks.salvarParcelas,
}));
vi.mock("@/app/actions/capacity", () => ({
  allocatePersonAction: mocks.allocatePersonAction,
  listCapacity: mocks.listCapacity,
}));
vi.mock("@/components/seletor-de-periodo", () => ({
  SeletorDePeriodo: () => null,
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<Confirmacao>", () => {
  it("é um status polite com o texto", () => {
    render(<Confirmacao>Pesos salvos</Confirmacao>);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Pesos salvos");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("tom neutro troca as cores, não o papel", () => {
    render(<Confirmacao tom="neutro">Nada mudou</Confirmacao>);
    const status = screen.getByRole("status");
    expect(status.style.background).not.toBe("var(--green-soft)");
  });
});

const MEMBRO: TenantMemberRow = {
  desde: "2026-09-01T00:00:00.000Z",
  email: "ana@atlas.com.br",
  id: "m-1",
  nome: "Ana",
  role: "DEV",
};

describe("Usuários — trocar papel confirma em texto, na linha", () => {
  it("depois de Confirmar, a linha diz 'Papel de Ana agora é PO'", async () => {
    mocks.updateTenantMemberRoleAction.mockResolvedValue({
      data: { id: "m-1" },
      ok: true,
    });
    render(<AbaUsuarios canWrite membros={[MEMBRO]} slug="atlas-energia" />);

    fireEvent.change(screen.getByLabelText("Papel de ana@atlas.com.br"), {
      target: { value: "PO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("Papel de Ana agora é PO");
    // Junto do controle: dentro da mesma linha do select, não no rodapé.
    const linha = screen
      .getByLabelText("Papel de ana@atlas.com.br")
      .closest("tr");
    expect(linha).not.toBeNull();
    expect(within(linha as HTMLElement).getByRole("status")).toBe(status);
  });

  it("erro do servidor não confirma nada", async () => {
    mocks.updateTenantMemberRoleAction.mockResolvedValue({
      error: "Último ADMIN não pode sair",
      ok: false,
    });
    render(<AbaUsuarios canWrite membros={[MEMBRO]} slug="atlas-energia" />);

    fireEvent.change(screen.getByLabelText("Papel de ana@atlas.com.br"), {
      target: { value: "PO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await screen.findByText("Último ADMIN não pode sair");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Gerador — botão de salvar diz o que aconteceu", () => {
  const base = {
    cliente: "Atlas",
    editavel: true,
    onEnviar: vi.fn(),
    podeEnviar: true,
    precisaAprovacao: false,
    somenteLeitura: false,
    titulo: "Proposta",
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem edição pendente diz 'Sem alterações' e fica desabilitado", () => {
    render(
      <PainelDeEnvio {...base} salvando={false} sujo={false} temRascunho />
    );
    const botao = screen.getByRole("button", { name: "Sem alterações" });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });

  it("com edição pendente diz 'Salvar alterações'; sem rascunho, 'Criar rascunho'", () => {
    const { rerender } = render(
      <PainelDeEnvio {...base} salvando={false} sujo temRascunho />
    );
    expect(
      screen.getByRole("button", { name: "Salvar alterações" })
    ).toBeTruthy();
    rerender(
      <PainelDeEnvio
        {...base}
        salvando={false}
        sujo={false}
        temRascunho={false}
      />
    );
    expect(screen.getByRole("button", { name: "Criar rascunho" })).toBeTruthy();
  });

  it("ao terminar de gravar diz 'Salvo' por alguns segundos e depois 'Sem alterações'", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <PainelDeEnvio {...base} salvando sujo temRascunho />
    );
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeTruthy();

    rerender(
      <PainelDeEnvio {...base} salvando={false} sujo={false} temRascunho />
    );
    expect(screen.getByRole("button", { name: "Salvo" })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole("button", { name: "Sem alterações" })).toBeTruthy();
  });

  it("gravação que falha (segue sujo) não diz 'Salvo'", () => {
    const { rerender } = render(
      <PainelDeEnvio {...base} salvando sujo temRascunho />
    );
    rerender(<PainelDeEnvio {...base} salvando={false} sujo temRascunho />);
    expect(screen.queryByRole("button", { name: "Salvo" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Salvar alterações" })
    ).toBeTruthy();
  });
});

const CAC: CacView = {
  alocacoes: [],
  competenciaEditavel: "2026-09",
  competencias: ["2026-09"],
  conversao: {
    convDiscoveryEvaluationPercent: null,
    convEvaluationPropostaPercent: null,
    convLeadDiscoveryPercent: null,
    convPropostaAceitaPercent: null,
  },
  editavel: true,
  intervalo: { ate: "2026-09-30", de: "2026-09-01" },
  mensalidadeReferenciaCentavos: null,
  parcelas: {
    "4.1": 100_000,
    "4.2": 100_000,
    "4.3": null,
    "4.4": null,
    "4.5": null,
    "4.6": null,
    clientesGanhos: null,
    entregaDiagnosticoCentavos: null,
  },
  resultado: {
    cacCentavos: null,
    paybackMeses: null,
    porProduto: [],
    preenchidas: 2,
    total: 8,
  },
  sugestaoClientesGanhos: 3,
};

describe("CAC — pesos e conversão confirmam em texto", () => {
  it("Salvar pesos → 'Pesos salvos' junto do botão", async () => {
    mocks.salvarAlocacao.mockResolvedValue({ data: CAC, ok: true });
    render(<Painel inicial={CAC} podeEscrever />);

    const botao = screen.getByRole("button", { name: "Salvar pesos" });
    fireEvent.click(botao);

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("Pesos salvos");
    // Mesmo cartão do botão — não o topo da página.
    const cartao =
      botao.closest("section") ?? botao.parentElement?.parentElement;
    expect(cartao?.contains(status)).toBe(true);
  });

  it("Salvar conversão → 'Conversão salva'", async () => {
    mocks.salvarConversao.mockResolvedValue({ data: CAC, ok: true });
    render(<Painel inicial={CAC} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar conversão" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("Conversão salva");
  });

  it("erro ao salvar pesos não confirma", async () => {
    mocks.salvarAlocacao.mockResolvedValue({
      error: "Soma passa de 100%",
      ok: false,
    });
    render(<Painel inicial={CAC} podeEscrever />);

    fireEvent.click(screen.getByRole("button", { name: "Salvar pesos" }));

    await screen.findByText("Soma passa de 100%");
    expect(screen.queryByRole("status")).toBeNull();
  });
});

const ENG: EngagementRow = {
  clienteNome: "Atlas",
  clienteSlug: "atlas",
  codigo: "ENG-01",
  fimEm: null,
  id: "e1",
  inicioEm: "2026-09-01",
  nome: "Diagnóstico",
  proximos: ["ATIVO", "CANCELADO"],
  status: "PROPOSTO",
  valorCentavos: 1_200_000,
};

const PESSOA: PessoaCapacidade = {
  alocacoes: [],
  ativo: true,
  email: "ana@nebuloz.com",
  entraEm: null,
  habilidades: [],
  horasSemana: 40,
  id: "p1",
  nome: "Ana",
  observacao: null,
  ocupacaoAtual: 0,
  saiEm: null,
};

const PESSOA_B: PessoaCapacidade = {
  ...PESSOA,
  email: "bia@nebuloz.com",
  id: "p2",
  nome: "Bia",
};

describe("Capacidade — formulário e confirmação na linha", () => {
  it("clicar Alocar monta o formulário na linha da pessoa e foca o primeiro campo", () => {
    render(
      <Capacidade
        engajamentos={[ENG]}
        iniciais={[PESSOA, PESSOA_B]}
        podeEscrever
      />
    );
    const [alocarAna] = screen.getAllByRole("button", { name: "Alocar" });
    fireEvent.click(alocarAna);

    const form = screen.getByRole("form", { name: /Nova alocação — Ana/ });
    const primeiroCampo = screen.getByLabelText("Engajamento");
    expect(document.activeElement).toBe(primeiroCampo);
    // Dentro do <li> da Ana, não acima da lista.
    const linha = screen.getByText("Ana").closest("li");
    expect(linha?.contains(form)).toBe(true);
  });

  it("o botão que fecha o formulário diz Fechar", () => {
    render(
      <Capacidade engajamentos={[ENG]} iniciais={[PESSOA]} podeEscrever />
    );
    fireEvent.click(screen.getByRole("button", { name: "Alocar" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("form", { name: /Nova alocação/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Nova pessoa" }));
    expect(screen.getByRole("form", { name: /Nova pessoa/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("form", { name: /Nova pessoa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("sucesso confirma dentro da linha da pessoa alocada", async () => {
    mocks.allocatePersonAction.mockResolvedValue({
      data: { id: "a1" },
      ok: true,
    });
    mocks.listCapacity.mockResolvedValue({
      data: [{ ...PESSOA, ocupacaoAtual: 50 }, PESSOA_B],
      ok: true,
    });
    render(
      <Capacidade
        engajamentos={[ENG]}
        iniciais={[PESSOA, PESSOA_B]}
        podeEscrever
      />
    );
    const [alocarAna] = screen.getAllByRole("button", { name: "Alocar" });
    fireEvent.click(alocarAna);
    fireEvent.change(screen.getByLabelText("Engajamento"), {
      target: { value: "e1" },
    });
    fireEvent.change(screen.getByLabelText("Início"), {
      target: { value: "2026-09-10" },
    });
    const form = screen.getByRole("form", { name: /Nova alocação/ });
    fireEvent.click(within(form).getByRole("button", { name: "Alocar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("Ana");
    expect(status.textContent).toContain("ENG-01");
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: /Nova alocação/ })).toBeNull()
    );
    const linhaAna = screen.getByText("Ana").closest("li");
    expect(linhaAna?.contains(status)).toBe(true);
    const linhaBia = screen.getByText("Bia").closest("li");
    expect(linhaBia?.contains(status)).toBe(false);
  });
});
