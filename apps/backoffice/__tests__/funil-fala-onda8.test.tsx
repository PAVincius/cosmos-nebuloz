/** @vitest-environment jsdom */
// funil-fala-onda8.test.tsx — onda 8a, bloco 4. O funil terminava em silêncio
// em cinco escritas: novo lead, perder, próxima ação, converter e editar
// estágio (mover já falava). Agora cada uma diz, nomeando o lead ou o
// estágio. Com um diálogo aberto a página fica `aria-hidden` — a frase
// aparece também dentro dele, que é onde a pessoa está.
//
// E o board: a zona "Ganho" aceitava o arraste só para recusar; agora não é
// alvo de drop. O card do lead se anunciava só pelo nome; agora diz os dias
// no estágio, o próximo passo e se está vencido.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "@/app/(staff)/funil/board";
import { type DadosFunil, Funil } from "@/app/(staff)/funil/funil";
import type { LeadRow } from "@/app/actions/leads";
import { MOTIVOS_PERDA } from "@/lib/comercial/funil";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  atualizarEstagio: vi.fn(),
  converterEmProposta: vi.fn(),
  criarLead: vi.fn(),
  lerEstagio: vi.fn(),
  listarFunil: vi.fn(),
  marcarPerdido: vi.fn(),
  moverEstagio: vi.fn(),
  registrarProximaAcao: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/leads", () => ({
  converterEmProposta: mocks.converterEmProposta,
  criarLead: mocks.criarLead,
  listarFunil: mocks.listarFunil,
  marcarPerdido: mocks.marcarPerdido,
  moverEstagio: mocks.moverEstagio,
  registrarProximaAcao: mocks.registrarProximaAcao,
}));
vi.mock("@/app/actions/funil-config", () => ({
  atualizarEstagio: mocks.atualizarEstagio,
  lerEstagio: mocks.lerEstagio,
}));

function lead(over: Partial<LeadRow>): LeadRow {
  return {
    acvEstimadoCentavos: 500_000,
    canal: { cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" },
    contatoEmail: "ana@meridian.com",
    contatoNome: "Ana",
    criadoEm: "2026-07-01T00:00:00.000Z",
    donoNome: "Vini",
    entrada: "MERIDIAN",
    estagio: "DISCOVERY",
    estagioDesde: "2026-09-01T00:00:00.000Z",
    id: "lead-1",
    motivoPerda: null,
    nome: "Meridian Corp",
    notaPerda: null,
    origem: null,
    perdidoEm: null,
    perdidoNoEstagio: null,
    proposta: null,
    proximaAcao: "Ligar",
    proximaAcaoEm: "2026-09-10T00:00:00.000Z",
    situacao: "ATIVO",
    ...over,
  };
}

const ESTAGIOS: DadosFunil["estagios"] = [
  { codigo: "LEAD", criterios: [], pesoPercent: 10, tetoDias: 7 },
  { codigo: "DISCOVERY", criterios: [], pesoPercent: 30, tetoDias: 14 },
  { codigo: "EVALUATION", criterios: [], pesoPercent: 60, tetoDias: 21 },
  { codigo: "PROPOSAL", criterios: [], pesoPercent: 80, tetoDias: 30 },
];

function dados(leads: LeadRow[]): DadosFunil {
  return {
    canais: [{ cacMedioCentavos: null, nome: "Indicação", slug: "indicacao" }],
    estagios: ESTAGIOS,
    historico: [],
    hoje: "2026-09-06T12:00:00.000Z",
    leads,
  };
}

const DADOS = dados([lead({})]);

function montar(d: DadosFunil = DADOS) {
  mocks.listarFunil.mockResolvedValue({ data: d, ok: true });
  return render(<Funil inicial={d} podeEscrever />);
}

/** O status visível para quem está no diálogo aberto. */
async function statusNoDialogo(texto: string) {
  const dialogo = screen.getByRole("dialog");
  await waitFor(() =>
    expect(
      within(dialogo)
        .queryAllByRole("status")
        .map((s) => s.textContent)
    ).toContain(texto)
  );
}

/** Registrar perda pede motivo e uma nota de 12+ caracteres. */
function registrarPerda(dialogo: HTMLElement) {
  fireEvent.click(
    within(dialogo).getByRole("button", { name: "Marcar perdido" })
  );
  fireEvent.click(
    within(dialogo).getByRole("button", { name: MOTIVOS_PERDA.PRECO })
  );
  fireEvent.change(within(dialogo).getByLabelText("O que aconteceu"), {
    target: { value: "Orçamento cortado no trimestre." },
  });
  fireEvent.click(
    within(dialogo).getByRole("button", { name: "Registrar perda" })
  );
}

beforeEach(() => {
  zerarRoteador("/funil");
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.lerEstagio.mockResolvedValue({
    data: {
      config: ESTAGIOS[1],
      mudancas: [],
    },
    ok: true,
  });
});

describe("Funil — toda escrita fala", () => {
  it("novo lead: o status nomeia o lead criado", async () => {
    mocks.criarLead.mockResolvedValue({ data: { id: "lead-9" }, ok: true });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Novo lead" }));
    fireEvent.change(screen.getByLabelText("Organização"), {
      target: { value: "Atlas SA" },
    });
    fireEvent.change(screen.getByLabelText("Próximo passo"), {
      target: { value: "Ligar para o CFO" },
    });
    fireEvent.change(screen.getByLabelText("Quando"), {
      target: { value: "2026-09-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar lead" }));

    // A busca tem o próprio status ("1 de 1"); a frase é a de outro.
    await waitFor(() =>
      expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain(
        "Lead Atlas SA criado em Lead."
      )
    );
  });

  it("próxima ação: o status nomeia o lead, o passo e a data", async () => {
    mocks.registrarProximaAcao.mockResolvedValue({
      data: { id: "lead-1" },
      ok: true,
    });
    zerarRoteador("/funil", "lead=lead-1");
    montar();
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Editar" }));
    fireEvent.change(
      within(dialogo).getByPlaceholderText("O que fazer a seguir"),
      { target: { value: "Enviar proposta" } }
    );
    const data = dialogo.querySelector('input[type="date"]');
    if (!data) {
      throw new Error("campo de data não encontrado");
    }
    fireEvent.change(data, { target: { value: "2026-09-12" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));

    await statusNoDialogo(
      "Próxima ação de Meridian Corp: «Enviar proposta» em 12/09/2026."
    );
  });

  it("perder: o status nomeia o lead e o motivo", async () => {
    mocks.marcarPerdido.mockResolvedValue({ data: { id: "lead-1" }, ok: true });
    zerarRoteador("/funil", "lead=lead-1");
    montar();
    const dialogo = screen.getByRole("dialog");
    registrarPerda(dialogo);

    await statusNoDialogo("Meridian Corp marcado como perdido — Preço.");
  });

  it("converter: o status nomeia o lead e a proposta", async () => {
    mocks.converterEmProposta.mockResolvedValue({
      data: { id: "p-1", numero: "P-2026-007" },
      ok: true,
    });
    zerarRoteador("/funil", "lead=lead-1");
    montar(dados([lead({ estagio: "EVALUATION" })]));
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Converter em proposta" })
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));

    await statusNoDialogo("Meridian Corp virou a proposta P-2026-007.");
  });

  it("editar estágio: o status nomeia o estágio", async () => {
    mocks.atualizarEstagio.mockResolvedValue({
      data: { codigo: "DISCOVERY" },
      ok: true,
    });
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: /^Abrir estágio Descoberta/ })
    );
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(
      await within(dialogo).findByRole("button", { name: "Editar estágio" })
    );
    fireEvent.change(within(dialogo).getByLabelText("Peso (%)"), {
      target: { value: "35" },
    });
    fireEvent.change(within(dialogo).getByLabelText("Por que muda"), {
      target: { value: "Leads em avaliação com capacidade fecham mais." },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Registrar mudança" })
    );

    await statusNoDialogo("Estágio Descoberta atualizado.");
  });

  it("escrita recusada não fala sucesso", async () => {
    mocks.marcarPerdido.mockResolvedValue({
      error: "Lead já convertido.",
      ok: false,
    });
    zerarRoteador("/funil", "lead=lead-1");
    montar();
    const dialogo = screen.getByRole("dialog");
    registrarPerda(dialogo);

    await within(dialogo).findByText("Lead já convertido.");
    expect(within(dialogo).queryAllByRole("status")).toEqual([]);
  });
});

describe("Board — Ganho não finge aceitar o arraste", () => {
  function montarBoard() {
    const props = {
      onConverter: vi.fn(),
      onMover: vi.fn(),
      onPerder: vi.fn(),
    };
    render(
      <Board
        estagios={ESTAGIOS}
        hoje={new Date("2026-09-06T12:00:00.000Z")}
        leads={[lead({})]}
        onAbrirEstagio={vi.fn()}
        onAbrirLead={vi.fn()}
        podeEscrever
        {...props}
      />
    );
    return props;
  }

  it("a zona Ganho não é alvo de drop: aria-disabled, sem preventDefault, nenhuma action", () => {
    const props = montarBoard();
    const zona = screen
      .getByText("Ganho vem da proposta aceita")
      .closest("[aria-disabled]");
    if (!zona) {
      throw new Error("zona Ganho sem aria-disabled");
    }
    expect(zona.getAttribute("aria-disabled")).toBe("true");

    fireEvent.dragStart(
      screen.getByRole("button", { name: /^Abrir Meridian/ })
    );
    // `dragover` não cancelado = o navegador não oferece soltar aqui.
    expect(fireEvent.dragOver(zona)).toBe(true);
    fireEvent.drop(zona);

    expect(props.onMover).not.toHaveBeenCalled();
    expect(props.onConverter).not.toHaveBeenCalled();
    expect(props.onPerder).not.toHaveBeenCalled();
    expect(screen.queryByText("Ganho só via proposta aceita.")).toBeNull();
    expect(screen.queryByText(/proposta ganha/)).toBeNull();
  });
});

describe("Board — o card se anuncia inteiro", () => {
  function nomeDoCard(l: LeadRow): string {
    render(
      <Board
        estagios={ESTAGIOS}
        hoje={new Date("2026-09-20T12:00:00.000Z")}
        leads={[l]}
        onAbrirEstagio={vi.fn()}
        onAbrirLead={vi.fn()}
        onConverter={vi.fn()}
        onMover={vi.fn()}
        onPerder={vi.fn()}
        podeEscrever
      />
    );
    const card = screen.getByRole("button", { name: /^Abrir Meridian Corp/ });
    return card.textContent ?? "";
  }

  it("nome acessível: 'Abrir' + lead + dias no estágio + próximo passo + vencido", () => {
    // 19 dias em Discovery, teto 14: vencido.
    const nome = nomeDoCard(lead({}));
    expect(nome).toMatch(/^Abrir Meridian Corp/);
    expect(nome).toContain("19 d no estágio");
    expect(nome).toContain("vencido");
    // A data sai no fuso de quem olha (`formatarData`); o formato basta.
    expect(nome).toMatch(/próximo passo \d{2}\/\d{2}\/\d{4}/);
  });

  it("dentro do teto, não diz vencido", () => {
    const nome = nomeDoCard(lead({ estagioDesde: "2026-09-15T00:00:00.000Z" }));
    expect(nome).toContain("5 d no estágio");
    expect(nome).not.toContain("vencido");
  });
});

describe("Vocabulário do funil", () => {
  it("motivos de perda em português — o valor do enum não muda", () => {
    expect(MOTIVOS_PERDA.TIMING).not.toMatch(/timing/i);
    expect(MOTIVOS_PERDA.SEM_SPONSOR).not.toMatch(/sponsor/i);
    expect(MOTIVOS_PERDA.SEM_FIT).not.toMatch(/\bfit\b/i);
    expect(Object.keys(MOTIVOS_PERDA)).toEqual([
      "PRECO",
      "TIMING",
      "SEM_SPONSOR",
      "CONCORRENTE",
      "SEM_FIT",
      "OUTRO",
    ]);
  });

  it("board e fila de gates sem fontSize numérico — só os degraus --fs-*", () => {
    const raiz = path.join(__dirname, "..", "app", "(staff)");
    for (const arquivo of ["funil/board.tsx", "scaffold/fila-de-gates.tsx"]) {
      const fonte = readFileSync(path.join(raiz, arquivo), "utf8");
      expect(fonte, arquivo).not.toMatch(/fontSize:\s*\d/);
    }
  });
});
