/** @vitest-environment jsdom */
// barreiras-empresa.test.tsx — [P1] exportar fornecedores para o Charter (cria
// registros no tenant do cliente, duplicata não se desfaz) e gravar a base
// legal LGPD (vai para a auditoria com o nome de quem clicou) eram um clique.
// Por item: gatilho não chama; alvo escrito; Confirmar chama com o payload;
// Voltar não chama.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Painel } from "@/app/(staff)/empresa/consentimento/painel";
import { Inventario } from "@/app/(staff)/empresa/fornecedores/inventario";
import type { ConsentimentoView } from "@/app/actions/empresa/consentimento";
import type { FornecedorDpaRow } from "@/app/actions/empresa/fornecedores";

const { exportarMock, agirMock, salvarDecisaoMock, lerMock } = vi.hoisted(
  () => ({
    agirMock: vi.fn(),
    exportarMock: vi.fn(),
    lerMock: vi.fn(),
    salvarDecisaoMock: vi.fn(),
  })
);

vi.mock("@/app/actions/empresa/fornecedores", () => ({
  aplicarAcaoDpa: agirMock,
  exportarAoCharter: exportarMock,
}));

vi.mock("@/app/actions/empresa/consentimento", () => ({
  lerConsentimento: lerMock,
  marcarParecer: vi.fn(),
  responderPergunta: vi.fn(),
  salvarDecisao: salvarDecisaoMock,
}));

function fornecedor(over: Partial<FornecedorDpaRow>): FornecedorDpaRow {
  return {
    acaoPendente: null,
    acoes: [],
    assinadoEm: null,
    bloqueiaVenda: false,
    classificacaoProvisoria: false,
    codigo: "F-01",
    donoPapel: null,
    dpaUrl: null,
    estado: "EMBUTIDO",
    evidenciaUrl: null,
    exportadoAoCharterEm: null,
    nome: "Vercel",
    notas: null,
    pedidoEm: null,
    regiao: "EUA",
    retencao: null,
    subprocessadoresUrl: null,
    transferencia: null,
    verificadoEm: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("Fornecedores — exportar para o Charter", () => {
  beforeEach(() => {
    exportarMock.mockReset();
    exportarMock.mockResolvedValue({
      data: { exportados: ["F-01", "F-02"], semCorrespondente: [] },
      ok: true,
    });
  });

  function montar() {
    return render(
      <Inventario
        iniciais={[
          fornecedor({}),
          fornecedor({ codigo: "F-02", nome: "Anthropic" }),
        ]}
        podeEscrever
      />
    );
  }

  it("o clique não exporta e diz quantos fornecedores vão para o Charter", () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Exportar para o Charter" })
    );

    expect(exportarMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        /Cria 2 fornecedores no Charter do cliente; duplicatas não são desfeitas\./
      )
    ).toBeTruthy();
  });

  it("Confirmar chama exportarAoCharter com todos os códigos", async () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Exportar para o Charter" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(exportarMock).toHaveBeenCalledTimes(1));
    expect(exportarMock).toHaveBeenCalledWith({ codigos: ["F-01", "F-02"] });
  });

  it("Voltar não exporta", () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: "Exportar para o Charter" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(exportarMock).not.toHaveBeenCalled();
  });
});

const VIEW: ConsentimentoView = {
  abertas: 0,
  avisos: [],
  camposEmAberto: [],
  decisao: {
    baseLegal: "SEM_DECISAO",
    contatoTitular: null,
    ferramenta: null,
    parecer: "PENDENTE",
    parecerEnviadoEm: null,
    parecerRecebidoEm: null,
    prazoRetencao: null,
    standingHabilitavel: null,
  },
  perguntas: [],
};

describe("Consentimento — base legal", () => {
  beforeEach(() => {
    salvarDecisaoMock.mockReset();
    salvarDecisaoMock.mockResolvedValue({ data: {}, ok: true });
    lerMock.mockReset();
    lerMock.mockResolvedValue({ data: VIEW, ok: true });
  });

  it("clicar na base não grava: aparece a pergunta com a base escolhida", () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: "Consentimento — art. 7º, I" })
    );

    expect(salvarDecisaoMock).not.toHaveBeenCalled();
    expect(
      screen.getByText(/fica registrada na auditoria com seu nome/)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });

  it("Confirmar chama salvarDecisao com a base", async () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: "Consentimento — art. 7º, I" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(salvarDecisaoMock).toHaveBeenCalledTimes(1));
    expect(salvarDecisaoMock).toHaveBeenCalledWith({
      baseLegal: "CONSENTIMENTO",
    });
  });

  it("Voltar não grava", () => {
    render(<Painel inicial={VIEW} podeEscrever />);

    fireEvent.click(
      screen.getByRole("button", { name: "Consentimento — art. 7º, I" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(salvarDecisaoMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
  });
});
