/** @vitest-environment jsdom */
// radio-tabs-e-tabela-a11y.test.tsx — persona Sam (leitor de tela e
// teclado). Três grupos de escolha única eram botões com `aria-pressed`, que o
// leitor anuncia como "botão pressionado" sem dizer "1 de 5"; a régua de
// aceitação da IP marcava cada critério só por cor e um glifo `aria-hidden`;
// as abas do detalhe do cliente eram `<button>` sem `role="tab"`; a tabela de
// clientes tinha `<th>` sem `scope`; e os campos de dia/mês da entrada de
// data tinham `width: 2ch` em `border-box` com 10px de padding+borda — dois
// dígitos não cabiam.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormularioDeCapacidade } from "@/app/(staff)/capacidade/formulario";
import { DetalheDoTenant } from "@/app/(staff)/clientes/[slug]/detalhe";
import { ClientesTabela } from "@/app/(staff)/clientes-tabela";
import { Avaliacao } from "@/app/(staff)/growth/readiness/[id]/avaliacao";
import { RegistrarAtivo } from "@/app/(staff)/ip/registrar";
import type { AvaliacaoDetalhe } from "@/app/actions/maturidade";
import { EntradaDeData } from "@/components/entrada-de-data";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("@/app/actions/maturidade", () => ({
  concluirAvaliacao: vi.fn(),
  responder: vi.fn().mockResolvedValue({ data: {}, ok: true }),
}));
vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
}));
vi.mock("@/app/actions/capacity", () => ({
  createPersonAction: vi.fn(),
}));
vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: vi.fn(),
}));
vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/clientes/vanta");
});

const PATROCINIO = "Existe patrocínio executivo com orçamento próprio para IA?";

function avaliacao(over: Partial<AvaliacaoDetalhe> = {}): AvaliacaoDetalhe {
  return {
    autorNome: "Vini",
    concluidaEm: null,
    criadoEm: "2026-09-01T00:00:00.000Z",
    id: "av-1",
    leadId: null,
    leadNome: null,
    nivelGeral: null,
    organizacao: "Acme",
    respondidos: 0,
    respostas: [],
    rubricaVersao: "v1",
    scoreGeral: null,
    status: "RASCUNHO",
    ...over,
  };
}

describe("Readiness — nível do critério é rádio", () => {
  it("cada critério é um radiogroup com a pergunta como nome e cinco rádios", () => {
    render(<Avaliacao inicial={avaliacao()} podeEscrever />);
    const grupo = screen.getByRole("radiogroup", { name: PATROCINIO });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(5);
    expect(within(grupo).queryByRole("radio", { checked: true })).toBeNull();
  });

  it("o nível gravado aparece marcado; escolher outro marca o novo", () => {
    render(
      <Avaliacao
        inicial={avaliacao({
          respostas: [
            { criterioId: "estrategia.patrocinio", nivel: 2, nota: null },
          ],
        })}
        podeEscrever
      />
    );
    const grupo = screen.getByRole("radiogroup", { name: PATROCINIO });
    expect(
      within(grupo).getByRole("radio", { checked: true }).getAttribute("value")
    ).toBe("2");

    fireEvent.click(within(grupo).getAllByRole("radio")[4]);
    expect(
      within(grupo).getByRole("radio", { checked: true }).getAttribute("value")
    ).toBe("4");
  });
});

describe("IP — procedência e licença são rádio; serviços seguem alternáveis", () => {
  function montar() {
    render(
      <RegistrarAtivo
        engajamentos={[]}
        onCriado={vi.fn()}
        onErro={vi.fn()}
        pessoas={[]}
        servicos={[
          {
            ativo: true,
            codigo: "SV-01",
            descricao: null,
            duracao: null,
            entregaveis: [],
            id: "s1",
            modalidade: "PROJETO",
            nome: "Diagnóstico",
            precoBaseCentavos: 100,
            trilha: "GERAL",
            unidade: "projeto",
            unidadeDeCobranca: "PROJETO",
          } as never,
        ]}
      />
    );
  }

  it("Procedência: quatro rádios, 'Investimento interno' marcado de início", () => {
    montar();
    const grupo = screen.getByRole("radiogroup", { name: "Procedência" });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(4);
    expect(
      within(grupo).getByRole("radio", {
        checked: true,
        name: "Investimento interno",
      })
    ).toBeTruthy();
    fireEvent.click(within(grupo).getByRole("radio", { name: "LAB" }));
    expect(
      within(grupo).getByRole("radio", { checked: true, name: "LAB" })
    ).toBeTruthy();
  });

  it("Licença de terceiro: cinco rádios, 'Nenhuma' marcado de início", () => {
    montar();
    const grupo = screen.getByRole("radiogroup", {
      name: "Licença de terceiro",
    });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(5);
    expect(
      within(grupo).getByRole("radio", { checked: true, name: "Nenhuma" })
    ).toBeTruthy();
  });

  it("serviços continuam botões alternáveis (escolha múltipla)", () => {
    montar();
    const chip = screen.getByRole("button", { name: "SV-01 · Diagnóstico" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });

  it("a régua diz 'atende' ou 'falta' em texto para cada critério", () => {
    montar();
    const marcas = screen.getAllByText(/^(atende|falta)$/);
    // Seis critérios (IP-R1…R6), cada um com a palavra — não só cor e glifo.
    expect(marcas).toHaveLength(6);
    expect(marcas.some((m) => m.textContent === "falta")).toBe(true);
  });
});

describe("Capacidade — tipo de pessoa é rádio", () => {
  it("Pessoa e Terceiro são rádios num grupo chamado 'Tipo'; Terceiro exige 'Sai em'", () => {
    render(<FormularioDeCapacidade onCriada={vi.fn()} onErro={vi.fn()} />);
    const grupo = screen.getByRole("radiogroup", { name: "Tipo" });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(2);
    expect(
      within(grupo).getByRole("radio", { checked: true, name: /Pessoa/ })
    ).toBeTruthy();

    fireEvent.click(within(grupo).getByRole("radio", { name: /Terceiro/ }));
    expect(
      within(grupo).getByRole("radio", { checked: true, name: /Terceiro/ })
    ).toBeTruthy();
  });
});

describe("Detalhe do cliente — abas de verdade", () => {
  function montar() {
    render(
      <DetalheDoTenant
        acoesDeModulo={null}
        auditoria={{ data: [], ok: true }}
        canWrite={false}
        charter={null}
        contratados={new Set()}
        integracoes={{ data: [], ok: true }}
        membros={{ data: [], ok: true }}
        meridian={null}
        modulos={[]}
        slug="vanta"
      />
    );
  }

  it("tablist com tabs, aria-selected e o painel ligado por aria-controls", () => {
    montar();
    const lista = screen.getByRole("tablist");
    const abas = within(lista).getAllByRole("tab");
    expect(abas.length).toBeGreaterThan(1);
    const ativa = within(lista).getByRole("tab", { selected: true });
    expect(ativa.textContent).toBe("Resumo");
    const painel = screen.getByRole("tabpanel");
    expect(ativa.getAttribute("aria-controls")).toBe(painel.id);
    expect(painel.getAttribute("aria-labelledby")).toBe(ativa.id);
  });

  it("clicar noutra aba troca a seleção; ArrowRight move o foco e a seleção", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: /Usuários/ }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toMatch(
      /Usuários/
    );

    const atual = screen.getByRole("tab", { selected: true });
    fireEvent.keyDown(atual, { key: "ArrowRight" });
    const seguinte = screen.getByRole("tab", { selected: true });
    expect(seguinte).not.toBe(atual);
    expect(document.activeElement).toBe(seguinte);
    // Só a aba ativa entra na ordem de Tab; as outras ficam em tabindex=-1.
    for (const aba of screen.getAllByRole("tab")) {
      expect(aba.getAttribute("tabindex")).toBe(aba === seguinte ? "0" : "-1");
    }
  });
});

describe("Carteira de clientes — cabeçalho com scope", () => {
  it("todo <th> tem scope=col", () => {
    render(<ClientesTabela clientes={[]} />);
    const cabecalhos = screen.getAllByRole("columnheader");
    expect(cabecalhos.length).toBeGreaterThan(2);
    for (const th of cabecalhos) {
      expect(th.getAttribute("scope")).toBe("col");
    }
  });
});

describe("EntradaDeData — dois dígitos cabem", () => {
  it("dia e mês somam padding e borda ao 2ch (border-box); ano ao 4ch", () => {
    render(
      <EntradaDeData onChange={vi.fn()} rotulo="Início" valor="2026-01-31" />
    );
    expect(screen.getByLabelText("Início — dia").style.width).toBe(
      "calc(2ch + 10px)"
    );
    expect(screen.getByLabelText("Início — mês").style.width).toBe(
      "calc(2ch + 10px)"
    );
    expect(screen.getByLabelText("Início — ano").style.width).toBe(
      "calc(4ch + 10px)"
    );
  });
});
