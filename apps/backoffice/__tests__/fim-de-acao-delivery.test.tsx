/** @vitest-environment jsdom */
// fim-de-acao-delivery.test.tsx — heurísticas 1 (status) e 7 (eficiência):
// toda escrita em Capacidade e Engajamentos tem pendente e fim nomeado.
//
// O que se prova, por tela: clicar o submit duas vezes rápido chama a action
// **uma** vez (o `disabled` durante o envio é o que segura — tirá-lo faz
// este teste cair); o rótulo troca enquanto pendente; o campo vive num
// `<form>` e submetê-lo chama o mesmo handler (é o que faz Enter funcionar);
// sucesso relê a lista pela action em vez de `window.location.reload()` e
// confirma em texto; e o estado terminal/inativo tem palavra, não só
// opacidade.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacidade } from "@/app/(staff)/capacidade/capacidade";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import { pendenteAteOFim } from "../vitest-mocks/pendente";

const mocks = vi.hoisted(() => ({
  allocatePersonAction: vi.fn(),
  createEngagementAction: vi.fn(),
  createPersonAction: vi.fn(),
  listCapacity: vi.fn(),
  listEngagements: vi.fn(),
  reload: vi.fn(),
  setEngagementStatusAction: vi.fn(),
}));

vi.mock("@/app/actions/capacity", () => ({
  allocatePersonAction: mocks.allocatePersonAction,
  createPersonAction: mocks.createPersonAction,
  listCapacity: mocks.listCapacity,
}));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: mocks.createEngagementAction,
  listEngagements: mocks.listEngagements,
  setEngagementStatusAction: mocks.setEngagementStatusAction,
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

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

const ENG_ENCERRADO: EngagementRow = {
  ...ENG,
  codigo: "ENG-02",
  id: "e2",
  nome: "Entregue",
  proximos: [],
  status: "CONCLUIDO",
};

const PESSOA: PessoaCapacidade = {
  alocacoes: [],
  ativo: true,
  email: "ana@nebuloz.ai",
  entraEm: null,
  habilidades: ["dados"],
  horasSemana: 40,
  id: "p1",
  nome: "Ana",
  observacao: null,
  ocupacaoAtual: 0,
  saiEm: null,
};

const PESSOA_INATIVA: PessoaCapacidade = {
  ...PESSOA,
  ativo: false,
  email: "bia@nebuloz.ai",
  id: "p2",
  nome: "Bia",
};

// `window.location.reload` não é espiável no jsdom (propriedade não
// configurável), mas `window.location` inteiro é — troca-se por uma cópia com
// `reload` observável e devolve-se o original ao fim.
const LOCATION_ORIGINAL = Object.getOwnPropertyDescriptor(window, "location");

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: mocks.reload },
  });
});

afterEach(() => {
  if (LOCATION_ORIGINAL) {
    Object.defineProperty(window, "location", LOCATION_ORIGINAL);
  }
});

describe("Capacidade — alocar", () => {
  function abrirAlocacao() {
    render(
      <Capacidade engajamentos={[ENG]} iniciais={[PESSOA]} podeEscrever />
    );
    fireEvent.click(screen.getByRole("button", { name: "Alocar" }));
    const form = screen.getByRole("form", { name: /Nova alocação/ });
    fireEvent.change(screen.getByLabelText("Engajamento"), {
      target: { value: "e1" },
    });
    fireEvent.change(screen.getByLabelText("Início"), {
      target: { value: "2026-09-10" },
    });
    return form;
  }

  it("clicar Alocar duas vezes rápido chama a action uma vez", async () => {
    mocks.allocatePersonAction.mockReturnValue(pendenteAteOFim());
    const form = abrirAlocacao();

    const botao = within(form).getByRole("button", { name: "Alocar" });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() =>
      expect(mocks.allocatePersonAction).toHaveBeenCalledTimes(1)
    );
  });

  it("enquanto pendente o botão diz Alocando… e fica desabilitado", async () => {
    mocks.allocatePersonAction.mockReturnValue(pendenteAteOFim());
    const form = abrirAlocacao();

    fireEvent.click(within(form).getByRole("button", { name: "Alocar" }));

    const botao = await within(form).findByRole("button", {
      name: "Alocando…",
    });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });

  it("o campo vive num <form>: submeter (Enter) chama a action", async () => {
    mocks.allocatePersonAction.mockReturnValue(pendenteAteOFim());
    const form = abrirAlocacao();

    expect(screen.getByLabelText("Início").closest("form")).toBe(form);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mocks.allocatePersonAction).toHaveBeenCalledTimes(1)
    );
  });

  it("sucesso relê a lista pela action, não recarrega a página, e confirma em texto", async () => {
    mocks.allocatePersonAction.mockResolvedValue({
      data: { id: "a1" },
      ok: true,
    });
    mocks.listCapacity.mockResolvedValue({
      data: [{ ...PESSOA, ocupacaoAtual: 50 }],
      ok: true,
    });
    const form = abrirAlocacao();

    fireEvent.click(within(form).getByRole("button", { name: "Alocar" }));

    const confirmacao = await screen.findByRole("status");
    expect(confirmacao.textContent).toContain("Ana");
    expect(confirmacao.textContent).toContain("ENG-01");
    expect(mocks.listCapacity).toHaveBeenCalledTimes(1);
    expect(mocks.reload).not.toHaveBeenCalled();
    // A ocupação nova vem do servidor, não de uma soma local.
    expect(await screen.findByText("50%")).toBeTruthy();
    expect(screen.queryByRole("form", { name: /Nova alocação/ })).toBeNull();
  });
});

describe("Capacidade — cadastrar pessoa", () => {
  function abrirCadastro() {
    render(<Capacidade engajamentos={[ENG]} iniciais={[]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Nova pessoa" }));
    const form = screen.getByRole("form", { name: /Nova pessoa/ });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Carla" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "carla@nebuloz.ai" },
    });
    return form;
  }

  it("clicar Cadastrar duas vezes rápido chama a action uma vez", async () => {
    mocks.createPersonAction.mockReturnValue(pendenteAteOFim());
    const form = abrirCadastro();

    const botao = within(form).getByRole("button", { name: "Cadastrar" });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() =>
      expect(mocks.createPersonAction).toHaveBeenCalledTimes(1)
    );
    expect(
      within(form)
        .getByRole("button", { name: "Cadastrando…" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("o campo vive num <form>: submeter (Enter) chama a action", async () => {
    mocks.createPersonAction.mockReturnValue(pendenteAteOFim());
    const form = abrirCadastro();

    expect(screen.getByLabelText("Nome").closest("form")).toBe(form);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mocks.createPersonAction).toHaveBeenCalledTimes(1)
    );
  });
});

describe("Capacidade — estado e plural", () => {
  it("pessoa inativa tem palavra, não só opacidade", () => {
    render(
      <Capacidade
        engajamentos={[]}
        iniciais={[PESSOA, PESSOA_INATIVA]}
        podeEscrever={false}
      />
    );

    expect(screen.getByText("Inativa")).toBeTruthy();
  });

  it("plural real no subtítulo: 1 pessoa, 2 pessoas", () => {
    const { unmount } = render(
      <Capacidade engajamentos={[]} iniciais={[PESSOA]} podeEscrever={false} />
    );
    expect(screen.getByText("1 pessoa")).toBeTruthy();
    unmount();

    render(
      <Capacidade
        engajamentos={[]}
        iniciais={[PESSOA, PESSOA_INATIVA]}
        podeEscrever={false}
      />
    );
    expect(screen.getByText("2 pessoas")).toBeTruthy();
    expect(screen.queryByText(/pessoa\(s\)/)).toBeNull();
  });
});

describe("Engajamentos — criar", () => {
  function abrirCriacao() {
    render(
      <Engajamentos
        clientes={[{ id: "t1", name: "Atlas", slug: "atlas" }]}
        iniciais={[]}
        podeEscrever
        servicos={[]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Novo engajamento" }));
    const form = screen.getByRole("form", { name: /Novo engajamento/ });
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "ENG-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Roadmap" },
    });
    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "t1" },
    });
    return form;
  }

  it("clicar Criar duas vezes rápido chama a action uma vez e mostra Criando…", async () => {
    mocks.createEngagementAction.mockReturnValue(pendenteAteOFim());
    const form = abrirCriacao();

    const botao = within(form).getByRole("button", {
      name: "Criar como proposto",
    });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() =>
      expect(mocks.createEngagementAction).toHaveBeenCalledTimes(1)
    );
    expect(
      within(form)
        .getByRole("button", { name: "Criando…" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("o campo vive num <form>: submeter (Enter) chama a action", async () => {
    mocks.createEngagementAction.mockReturnValue(pendenteAteOFim());
    const form = abrirCriacao();

    expect(screen.getByLabelText("Código").closest("form")).toBe(form);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mocks.createEngagementAction).toHaveBeenCalledTimes(1)
    );
  });

  it("o campo de valor diz a unidade no rótulo e a dica fica junto dele", () => {
    abrirCriacao();

    const valor = screen.getByLabelText("Valor fechado (R$)");
    expect(valor.getAttribute("placeholder")).toBe("12.000,00");
    fireEvent.change(valor, { target: { value: "5000" } });
    // A dica mostra o que será gravado — e mostra que "5000" é R$ 50,00.
    expect(screen.getByText(/grava R\$\s?50,00/)).toBeTruthy();
  });
});

describe("Engajamentos — mudar status", () => {
  it("clicar a transição duas vezes rápido chama a action uma vez e mostra pendente", async () => {
    mocks.setEngagementStatusAction.mockReturnValue(pendenteAteOFim());
    render(
      <Engajamentos clientes={[]} iniciais={[ENG]} podeEscrever servicos={[]} />
    );

    const botao = screen.getByRole("button", { name: "→ Ativo" });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() =>
      expect(mocks.setEngagementStatusAction).toHaveBeenCalledTimes(1)
    );
    expect(
      screen.getByRole("button", { name: "Mudando…" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("sucesso relê a lista pela action, não recarrega a página, e confirma em texto", async () => {
    mocks.setEngagementStatusAction.mockResolvedValue({
      data: { id: "e1" },
      ok: true,
    });
    mocks.listEngagements.mockResolvedValue({
      data: {
        itens: [
          { ...ENG, proximos: ["PAUSADO", "CONCLUIDO"], status: "ATIVO" },
        ],
        temMais: false,
      },
      ok: true,
    });
    render(
      <Engajamentos clientes={[]} iniciais={[ENG]} podeEscrever servicos={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "→ Ativo" }));

    const confirmacao = await screen.findByRole("status");
    expect(confirmacao.textContent).toContain("ENG-01");
    expect(confirmacao.textContent).toContain("Ativo");
    expect(mocks.listEngagements).toHaveBeenCalledTimes(1);
    expect(mocks.reload).not.toHaveBeenCalled();
    // As transições novas vêm do servidor.
    expect(
      await screen.findByRole("button", { name: "→ Pausado" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "→ Ativo" })).toBeNull();
  });
});

describe("Engajamentos — estado e plural", () => {
  it("engajamento terminal tem palavra, não só opacidade", () => {
    render(
      <Engajamentos
        clientes={[]}
        iniciais={[ENG, ENG_ENCERRADO]}
        podeEscrever={false}
        servicos={[]}
      />
    );

    expect(screen.getByText("Encerrado")).toBeTruthy();
  });

  it("plural real no subtítulo: 1 engajamento, 2 engajamentos", () => {
    const { unmount } = render(
      <Engajamentos
        clientes={[]}
        iniciais={[ENG]}
        podeEscrever={false}
        servicos={[]}
      />
    );
    expect(screen.getByText(/^1 engajamento ·/)).toBeTruthy();
    unmount();

    render(
      <Engajamentos
        clientes={[]}
        iniciais={[ENG, ENG_ENCERRADO]}
        podeEscrever={false}
        servicos={[]}
      />
    );
    expect(screen.getByText(/^2 engajamentos ·/)).toBeTruthy();
  });
});
