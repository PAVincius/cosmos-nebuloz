/** @vitest-environment jsdom */
// fim-de-acao-comercial.test.tsx — heurísticas 1 (status) e 7 (eficiência)
// no Catálogo e na Biblioteca de IP: o botão de gravar trava e troca o rótulo
// enquanto pendente (segundo clique não cria um segundo registro), o campo
// vive num `<form>` (Enter submete), o estado inativo tem palavra além da
// opacidade, o link do ativo é clicável e o plural é real.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Biblioteca } from "@/app/(staff)/ip/biblioteca";
import { Catalogo } from "@/app/(staff)/servicos/catalogo";
import type { IpAssetDetail, IpAssetRow } from "@/app/actions/ip-library";
import type { ServiceRow } from "@/app/actions/services";
import { zerarRoteador } from "../vitest-mocks/next-navigation";
import { pendenteAteOFim } from "../vitest-mocks/pendente";

const mocks = vi.hoisted(() => ({
  createServiceAction: vi.fn(),
  getIpAsset: vi.fn(),
  setServiceAtivoAction: vi.fn(),
  updateIpAssetAction: vi.fn(),
}));

vi.mock("@/app/actions/services", () => ({
  createServiceAction: mocks.createServiceAction,
  setServiceAtivoAction: mocks.setServiceAtivoAction,
}));
vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
  getIpAsset: mocks.getIpAsset,
  registrarReusoAction: vi.fn(),
  updateIpAssetAction: mocks.updateIpAssetAction,
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

const SERVICO: ServiceRow = {
  ativo: true,
  codigo: "SV-01",
  descricao: null,
  duracao: null,
  entregaveis: [],
  exigeLab: false,
  id: "s1",
  modalidade: "PROJETO",
  moduloVinculado: null,
  nome: "Kickoff",
  papeis: [],
  precoBaseCentavos: 100_000,
  preRequisitos: [],
  trilha: "readiness",
  unidade: "projeto",
  unidadeDeCobranca: "PROJETO",
};

const SERVICO_INATIVO: ServiceRow = {
  ...SERVICO,
  ativo: false,
  codigo: "SV-02",
  id: "s2",
  nome: "Antigo",
};

function ativoDeIp(over: Partial<IpAssetRow> = {}): IpAssetRow {
  return {
    atualizadoEm: "2026-09-01T00:00:00.000Z",
    descricao: null,
    dono: null,
    horasPoupadas: 0,
    id: "a1",
    licenca: "NENHUMA",
    link: null,
    maturidade: "RASCUNHO",
    nome: "Playbook Um",
    origem: null,
    procedencia: "INTERNO",
    reusos: 0,
    servicos: [],
    slug: "a1",
    tipo: "PLAYBOOK",
    versoes: 1,
    ...over,
  };
}

function detalhe(row: IpAssetRow): IpAssetDetail {
  return { ...row, conteudo: `conteudo-${row.id}`, historico: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/servicos");
});

describe("Catálogo — cadastrar serviço", () => {
  function abrirCadastro() {
    render(<Catalogo iniciais={[]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Novo serviço" }));
    const form = screen.getByRole("form", { name: /Novo serviço/ });
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "SV-09" },
    });
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Diagnóstico" },
    });
    return form;
  }

  it("clicar Cadastrar duas vezes rápido chama a action uma vez e diz Cadastrando…", async () => {
    mocks.createServiceAction.mockReturnValue(pendenteAteOFim());
    const form = abrirCadastro();

    const botao = within(form).getByRole("button", { name: "Cadastrar" });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() =>
      expect(mocks.createServiceAction).toHaveBeenCalledTimes(1)
    );
    expect(
      within(form)
        .getByRole("button", { name: "Cadastrando…" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("o campo vive num <form>: submeter (Enter) chama a action", async () => {
    mocks.createServiceAction.mockReturnValue(pendenteAteOFim());
    const form = abrirCadastro();

    expect(screen.getByLabelText("Código").closest("form")).toBe(form);
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mocks.createServiceAction).toHaveBeenCalledTimes(1)
    );
  });
});

describe("Catálogo — estado e plural", () => {
  it("serviço fora do catálogo tem palavra, não só opacidade — nos dois papéis", () => {
    const { unmount } = render(
      <Catalogo iniciais={[SERVICO, SERVICO_INATIVO]} podeEscrever />
    );
    expect(screen.getByText("Inativo")).toBeTruthy();
    unmount();

    render(
      <Catalogo iniciais={[SERVICO, SERVICO_INATIVO]} podeEscrever={false} />
    );
    expect(screen.getByText("Inativo")).toBeTruthy();
  });

  it("plural real no subtítulo: 1 ativo de 2, 2 ativos de 3", () => {
    const { unmount } = render(
      <Catalogo iniciais={[SERVICO, SERVICO_INATIVO]} podeEscrever={false} />
    );
    expect(screen.getByText("1 ativo de 2")).toBeTruthy();
    unmount();

    render(
      <Catalogo
        iniciais={[SERVICO, { ...SERVICO, id: "s3" }, SERVICO_INATIVO]}
        podeEscrever={false}
      />
    );
    expect(screen.getByText("2 ativos de 3")).toBeTruthy();
  });
});

describe("Biblioteca — salvar revisão", () => {
  async function abrirEditorSujo() {
    const row = ativoDeIp();
    mocks.getIpAsset.mockResolvedValue({ data: detalhe(row), ok: true });
    zerarRoteador("/ip", "ativo=a1");
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={[row]}
        pessoas={[]}
        podeEscrever
        servicos={[]}
      />
    );
    const editor = await screen.findByDisplayValue("conteudo-a1");
    fireEvent.change(editor, { target: { value: "conteudo-a1 editado" } });
    mocks.getIpAsset.mockClear();
  }

  it("clicar Salvar revisão duas vezes rápido chama a action uma vez e diz Salvando…", async () => {
    mocks.updateIpAssetAction.mockReturnValue(pendenteAteOFim());
    await abrirEditorSujo();

    const botao = screen.getByRole("button", { name: "Salvar revisão" });
    fireEvent.click(botao);
    fireEvent.click(botao);

    await waitFor(() =>
      expect(mocks.updateIpAssetAction).toHaveBeenCalledTimes(1)
    );
    expect(
      screen.getByRole("button", { name: "Salvando…" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("sucesso relê o ativo e confirma em texto", async () => {
    const row = ativoDeIp({ versoes: 2 });
    mocks.updateIpAssetAction.mockResolvedValue({
      data: { id: "a1", versao: 2 },
      ok: true,
    });
    await abrirEditorSujo();
    mocks.getIpAsset.mockResolvedValue({
      data: { ...detalhe(row), conteudo: "conteudo-a1 editado" },
      ok: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar revisão" }));

    const confirmacao = await screen.findByRole("status");
    expect(confirmacao.textContent).toMatch(/Revisão v2 salva/);
    // O `pendente` só cai quando a transição inteira resolve — um tick depois
    // da confirmação aparecer.
    const botao = await screen.findByRole("button", { name: "Sem alterações" });
    expect(botao.hasAttribute("disabled")).toBe(true);
  });
});

describe("Biblioteca — link e plural", () => {
  it("o link do ativo é um <a> que abre em nova aba", async () => {
    const row = ativoDeIp({ link: "https://drive.example/playbook" });
    mocks.getIpAsset.mockResolvedValue({ data: detalhe(row), ok: true });
    zerarRoteador("/ip", "ativo=a1");
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={[row]}
        pessoas={[]}
        podeEscrever={false}
        servicos={[]}
      />
    );
    await screen.findByDisplayValue("conteudo-a1");

    const link = screen.getByRole("link", {
      name: "https://drive.example/playbook",
    });
    expect(link.getAttribute("href")).toBe("https://drive.example/playbook");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("plural real nos KPIs e nas lacunas: 1 comprovado, 2 serviços sem ativo", () => {
    const comprovado = ativoDeIp({ maturidade: "COMPROVADO" });
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={[comprovado]}
        pessoas={[]}
        podeEscrever={false}
        servicos={[SERVICO, { ...SERVICO, codigo: "SV-03", id: "s3" }]}
      />
    );

    expect(screen.getByText("1 comprovado em campo")).toBeTruthy();
    expect(screen.getByText("2 serviços sem ativo vinculado")).toBeTruthy();
    expect(screen.queryByText(/\(s\)/)).toBeNull();
  });
});
