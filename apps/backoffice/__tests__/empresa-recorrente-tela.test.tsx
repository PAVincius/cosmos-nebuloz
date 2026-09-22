/** @vitest-environment jsdom */
// empresa-recorrente-tela.test.tsx — Task 5, spec 2026-09-06 §4. Prova a aba
// "Receita recorrente" (`recorrente.tsx` + `recorrente-dialogs.tsx` +
// `recorrente-dialog-nova.tsx`): os quatro cartões, a cascata do mês, a
// tabela de assinaturas (valor, degrau, franquia, uso, excedente — e a
// assinatura encerrada marcada e fora do MRR), a faixa de serviço separada, e
// os quatro diálogos de escrita — incluindo `podeEscrever={false}`
// escondendo-os.
//
// Fixture de "2026-05": a1 expande, a2 é a que encerra neste mês (fora do
// MRR de maio), a3 é nova, a4 contrai, a5 reativa — os cinco tipos de
// movimento numa competência só. "2026-04" (mês anterior) dá o MRR de entrada
// que `churnDeReceita` usa.
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Recorrente } from "@/app/(staff)/empresa/financeiro/recorrente";
import type { RecorrenteView } from "@/app/actions/empresa/recorrente";
import { formatarBRL } from "@/lib/comercial/formato";

const {
  listarRecorrenteMock,
  criarAssinaturaMock,
  alterarValorMock,
  encerrarAssinaturaMock,
  salvarCreditoDoMesMock,
  listClientsMock,
} = vi.hoisted(() => ({
  alterarValorMock: vi.fn(),
  criarAssinaturaMock: vi.fn(),
  encerrarAssinaturaMock: vi.fn(),
  listClientsMock: vi.fn(),
  listarRecorrenteMock: vi.fn(),
  salvarCreditoDoMesMock: vi.fn(),
}));

vi.mock("@/app/actions/empresa/recorrente", () => ({
  alterarValor: alterarValorMock,
  criarAssinatura: criarAssinaturaMock,
  encerrarAssinatura: encerrarAssinaturaMock,
  listarRecorrente: listarRecorrenteMock,
  salvarCreditoDoMes: salvarCreditoDoMesMock,
}));

vi.mock("@/app/actions/clients", () => ({
  listClients: listClientsMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const ESPACO_DURO = / /g;
function dinheiro(centavos: number): string {
  return formatarBRL(centavos).replace(ESPACO_DURO, " ");
}

const COMPETENCIA = "2026-05";

// biome-ignore lint/nursery/useMaxParams: fixture do brief — cinco campos posicionais deixam cada chamada de teste legível numa linha
function mud(
  assinaturaId: string,
  competencia: string,
  tipo: RecorrenteView["mudancas"][number]["tipo"],
  de: number,
  para: number
): RecorrenteView["mudancas"][number] {
  return {
    assinaturaId,
    autorNome: null,
    competencia,
    criadoEm: `${competencia}-01T00:00:00.000Z`,
    deCentavos: de,
    id: `${assinaturaId}-${competencia}-${tipo}`,
    motivo: "motivo suficiente para a mudança",
    paraCentavos: para,
    tipo,
  };
}

const A1 = {
  clienteNome: "Cliente A",
  clienteSlug: "c-a1",
  creditosMesIncluidos: 1000,
  encerradaEm: null,
  id: "a1",
  iniciouEm: "2026-01-10",
  motivoEncerramento: null,
  planoSlug: "scale-plus",
  precoCreditoExtraCentavos: 10,
  propostaId: null,
  tetoExcedenteCentavos: 5000,
  valorMensalCentavos: 150_000,
};
const A2 = {
  clienteNome: "Cliente B",
  clienteSlug: "c-a2",
  creditosMesIncluidos: 500,
  encerradaEm: "2026-05-20",
  id: "a2",
  iniciouEm: "2026-01-10",
  motivoEncerramento: "Cliente cancelou o contrato.",
  planoSlug: "scale",
  precoCreditoExtraCentavos: 10,
  propostaId: null,
  tetoExcedenteCentavos: null,
  valorMensalCentavos: 0,
};
const A3 = {
  clienteNome: "Cliente C",
  clienteSlug: "c-a3",
  creditosMesIncluidos: 800,
  encerradaEm: null,
  id: "a3",
  iniciouEm: "2026-05-05",
  motivoEncerramento: null,
  planoSlug: "starter",
  precoCreditoExtraCentavos: 8,
  propostaId: null,
  tetoExcedenteCentavos: null,
  valorMensalCentavos: 80_000,
};
const A4 = {
  clienteNome: "Cliente D",
  clienteSlug: "c-a4",
  creditosMesIncluidos: 1000,
  encerradaEm: null,
  id: "a4",
  iniciouEm: "2026-01-01",
  motivoEncerramento: null,
  planoSlug: "scale",
  precoCreditoExtraCentavos: 10,
  propostaId: null,
  tetoExcedenteCentavos: null,
  valorMensalCentavos: 150_000,
};
const A5 = {
  clienteNome: "Cliente E",
  clienteSlug: "c-a5",
  creditosMesIncluidos: 600,
  encerradaEm: null,
  id: "a5",
  iniciouEm: "2026-01-01",
  motivoEncerramento: null,
  planoSlug: "scale",
  precoCreditoExtraCentavos: 10,
  propostaId: null,
  tetoExcedenteCentavos: null,
  valorMensalCentavos: 70_000,
};

const ASSINATURAS = [A1, A2, A3, A4, A5];

const MUDANCAS = [
  mud("a1", "2026-01", "NOVO", 0, 100_000),
  mud("a1", "2026-05", "EXPANSAO", 100_000, 150_000),
  mud("a2", "2026-01", "NOVO", 0, 50_000),
  mud("a2", "2026-05", "CHURN", 50_000, 0),
  mud("a3", "2026-05", "NOVO", 0, 80_000),
  mud("a4", "2026-01", "NOVO", 0, 200_000),
  mud("a4", "2026-05", "CONTRACAO", 200_000, 150_000),
  mud("a5", "2026-01", "NOVO", 0, 60_000),
  mud("a5", "2026-03", "CHURN", 60_000, 0),
  mud("a5", "2026-05", "REATIVACAO", 0, 70_000),
];

// Franquia 1000, consumo 1200 → 120% da franquia — sinal de upgrade.
const CREDITO_A1 = {
  clienteSlug: "c-a1",
  competencia: COMPETENCIA,
  consumidos: 1200,
  excedenteCentavos: 2000,
  excedenteReprimidoCentavos: 0,
  franquia: 1000,
  id: "cr-a1",
  precoCreditoExtraCentavos: 10,
};
// Franquia 1000, consumo 200 → 20% da franquia — sinal de ocioso.
const CREDITO_A4 = {
  clienteSlug: "c-a4",
  competencia: COMPETENCIA,
  consumidos: 200,
  excedenteCentavos: 0,
  excedenteReprimidoCentavos: 0,
  franquia: 1000,
  id: "cr-a4",
  precoCreditoExtraCentavos: 10,
};

const PAYLOAD: RecorrenteView = {
  assinaturas: ASSINATURAS,
  creditos: [CREDITO_A1, CREDITO_A4],
  lancamentosDaCompetencia: {
    "1.1": 450_000,
    "1.5": 25_000,
    "1.6": 20_000,
  },
  mudancas: MUDANCAS,
};

function montar(podeEscrever = true) {
  render(
    <Recorrente
      competencia={COMPETENCIA}
      inicial={PAYLOAD}
      podeEscrever={podeEscrever}
    />
  );
}

beforeEach(() => {
  vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
  vi.clearAllMocks();
  listarRecorrenteMock.mockResolvedValue({ data: PAYLOAD, ok: true });
  criarAssinaturaMock.mockResolvedValue({ data: { id: "nova" }, ok: true });
  alterarValorMock.mockResolvedValue({ data: { id: "a1" }, ok: true });
  encerrarAssinaturaMock.mockResolvedValue({ data: { id: "a1" }, ok: true });
  salvarCreditoDoMesMock.mockResolvedValue({
    data: { clienteSlug: "c-a1", competencia: COMPETENCIA },
    ok: true,
  });
  listClientsMock.mockResolvedValue({ data: [], ok: true });
});

describe("Recorrente", () => {
  it("os quatro cartões mostram MRR, ARR, líquido do mês e churn de receita com os números do payload", () => {
    montar();

    // MRR de maio: a1 (150k) + a3 (80k) + a4 (150k) + a5 (70k) = 450k; a2 saiu.
    expect(screen.getByText(dinheiro(450_000))).toBeTruthy();
    // ARR = MRR × 12.
    expect(screen.getByText(dinheiro(5_400_000))).toBeTruthy();
    // Líquido do mês: novo 80k + expansão 50k + reativação 70k − contração
    // 50k − churn 50k = 100k.
    expect(screen.getAllByText(dinheiro(100_000)).length).toBeGreaterThan(0);
    // MRR de abril (mês anterior) = 350k; churn de maio = 50k → 14%.
    expect(screen.getByText("14%")).toBeTruthy();
  });

  it("a cascata do mês mostra os cinco tipos de movimento", () => {
    montar();

    expect(screen.getByText("Novo")).toBeTruthy();
    expect(screen.getByText("Expansão")).toBeTruthy();
    expect(screen.getByText("Contração")).toBeTruthy();
    expect(screen.getByText("Churn")).toBeTruthy();
    expect(screen.getByText("Reativação")).toBeTruthy();
  });

  it("a tabela de assinaturas mostra valor da competência, degrau, franquia, uso e excedente", () => {
    montar();

    const linha = screen.getByText("Cliente A").closest("tr");
    if (!linha) {
      throw new Error("Linha da assinatura não encontrada");
    }
    expect(within(linha).getByText("scale-plus")).toBeTruthy();
    // Valor vigente de a1 em maio: expandiu para 150k.
    expect(within(linha).getByText(dinheiro(150_000))).toBeTruthy();
    expect(within(linha).getByText("1000")).toBeTruthy();
    // Excedente: (1200 − 1000) × 10 = 2000, cobrado até o teto de 5000 → 2000.
    expect(within(linha).getByText(dinheiro(2000))).toBeTruthy();
  });

  it("assinatura encerrada aparece marcada e some do MRR do mês", () => {
    montar();

    const linha = screen.getByText("Cliente B").closest("tr");
    if (!linha) {
      throw new Error("Linha da assinatura não encontrada");
    }
    expect(within(linha).getByText("Encerrada")).toBeTruthy();
    // Sem ações de escrita numa assinatura já encerrada.
    expect(
      within(linha).queryByRole("button", { name: "Alterar valor — Cliente B" })
    ).toBeNull();
    expect(
      within(linha).queryByRole("button", { name: "Encerrar — Cliente B" })
    ).toBeNull();
    // O MRR do cartão (450k) não inclui os 50k de Cliente B.
    expect(screen.getByText(dinheiro(450_000))).toBeTruthy();
  });

  it("a receita de serviço aparece numa faixa própria, rotulada como não recorrente e fora do ARR", () => {
    montar();

    expect(screen.getByText("Receita de serviço")).toBeTruthy();
    expect(screen.getByText(/não é recorrente/)).toBeTruthy();
    // MRR e ARR viraram <abbr>, então o texto se parte em nós; o parágrafo
    // inteiro é o que se lê.
    expect(
      screen.getByText(/Projeto e consultoria avulsos/).textContent
    ).toMatch(/fora do MRR e do ARR/);
    // 1.5 (25k) + 1.6 (20k) = 45k — não soma a conta de assinatura (1.1).
    expect(screen.getByText(dinheiro(45_000))).toBeTruthy();
  });

  it("uso acima de 100% da franquia mostra o sinal de upgrade; abaixo de 30%, o de ocioso", () => {
    montar();

    const linhaA1 = screen.getByText("Cliente A").closest("tr");
    const linhaA4 = screen.getByText("Cliente D").closest("tr");
    if (!(linhaA1 && linhaA4)) {
      throw new Error("Linhas não encontradas");
    }
    expect(within(linhaA1).getByText("Upgrade")).toBeTruthy();
    expect(within(linhaA4).getByText("Ocioso")).toBeTruthy();
  });

  it("'Alterar valor' exige motivo com 10+ caracteres e chama alterarValor com a competência escolhida", async () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Alterar valor — Cliente A" })
    );

    const salvar = screen.getByRole("button", { name: "Salvar" });
    fireEvent.change(screen.getByLabelText("Novo valor mensal"), {
      target: { value: "2.000,00" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "curto" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Upgrade de degrau combinado com o cliente." },
    });
    fireEvent.change(screen.getByLabelText("Competência"), {
      target: { value: "2026-06" },
    });
    expect(salvar.hasAttribute("disabled")).toBe(false);

    fireEvent.click(salvar);

    await waitFor(() =>
      expect(alterarValorMock).toHaveBeenCalledWith({
        competencia: "2026-06",
        id: "a1",
        motivo: "Upgrade de degrau combinado com o cliente.",
        valorCentavos: 200_000,
      })
    );
  });

  it("'Encerrar' confirma em duas etapas e chama encerrarAssinatura com data e motivo", async () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Encerrar — Cliente A" })
    );

    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Cliente não renovou o contrato anual." },
    });
    fireEvent.change(screen.getByLabelText("Data do encerramento"), {
      target: { value: "2026-05-31" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Encerrar assinatura" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(encerrarAssinaturaMock).toHaveBeenCalledWith({
        data: "2026-05-31",
        id: "a1",
        motivo: "Cliente não renovou o contrato anual.",
      })
    );
  });

  it("podeEscrever={false} esconde as quatro escritas", () => {
    montar(false);

    const botaoNova = screen.getByRole("button", { name: "Nova assinatura" });
    expect(botaoNova.getAttribute("aria-disabled")).toBe("true");

    expect(
      screen.queryByRole("button", { name: "Alterar valor — Cliente A" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Encerrar — Cliente A" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Lançar consumo — Cliente A" })
    ).toBeNull();
  });
});

// Onda 8a, bloco 1: toda escrita da receita recorrente fala, nomeando o
// cliente, depois da releitura (`listarRecorrente`).
describe("Recorrente — toda escrita fala", () => {
  function status(): string | null {
    return (
      screen.queryByRole("status")?.textContent?.replace(ESPACO_DURO, " ") ??
      null
    );
  }

  it("nova assinatura: o status nomeia o cliente", async () => {
    listClientsMock.mockResolvedValue({
      data: [{ name: "Cliente Z", slug: "c-z" }],
      ok: true,
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Nova assinatura" }));
    await screen.findByRole("option", { name: "Cliente Z — c-z" });
    fireEvent.change(screen.getByLabelText("Cliente"), {
      target: { value: "c-z" },
    });
    fireEvent.change(screen.getByLabelText("Degrau"), {
      target: { value: "scale" },
    });
    fireEvent.change(screen.getByLabelText("Valor mensal"), {
      target: { value: "1.000,00" },
    });
    fireEvent.change(screen.getByLabelText("Créditos incluídos"), {
      target: { value: "500" },
    });
    fireEvent.change(screen.getByLabelText("Preço do crédito extra"), {
      target: { value: "0,10" },
    });
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Contrato anual assinado." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(status()).toBe("Assinatura de Cliente Z criada.")
    );
    expect(listarRecorrenteMock).toHaveBeenCalled();
  });

  it("alterar valor: o status nomeia o cliente, o valor novo e a competência", async () => {
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Alterar valor — Cliente A" })
    );
    fireEvent.change(screen.getByLabelText("Novo valor mensal"), {
      target: { value: "2.000,00" },
    });
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Upgrade de degrau combinado com o cliente." },
    });
    fireEvent.change(screen.getByLabelText("Competência"), {
      target: { value: "2026-06" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(status()).toBe(
        `Assinatura de Cliente A passa a ${dinheiro(200_000)} a partir de 06/2026.`
      )
    );
  });

  it("encerrar: o status nomeia o cliente", async () => {
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Encerrar — Cliente A" })
    );
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Cliente não renovou o contrato anual." },
    });
    fireEvent.change(screen.getByLabelText("Data do encerramento"), {
      target: { value: "2026-05-31" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Encerrar assinatura" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(status()).toBe("Assinatura de Cliente A encerrada.")
    );
  });

  it("crédito do mês: o status nomeia o cliente e a competência", async () => {
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Lançar consumo — Cliente A" })
    );
    fireEvent.change(screen.getByLabelText("Créditos consumidos no mês"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar consumo" }));

    await waitFor(() =>
      expect(status()).toBe("Consumo de Cliente A em 05/2026 salvo.")
    );
  });

  it("escrita recusada não fala sucesso", async () => {
    encerrarAssinaturaMock.mockResolvedValue({
      error: "Assinatura já encerrada.",
      ok: false,
    });
    montar();
    fireEvent.click(
      screen.getByRole("button", { name: "Encerrar — Cliente A" })
    );
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Cliente não renovou o contrato anual." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Encerrar assinatura" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await screen.findByText("Assinatura já encerrada.");
    expect(status()).toBeNull();
  });
});
