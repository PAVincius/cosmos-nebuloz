/** @vitest-environment jsdom */
// compliance-screen.test.tsx — cobre os seis estados que a tela de
// conformidade precisa mostrar honestamente: evidência real numa linha
// ATENDE (nunca um selo), "evidência indisponível" quando a consulta falhou
// (nunca a evidência antiga), REVISAR destacado com o motivo, a contagem de
// sem-veredito na tela — não só no export —, estado vazio com CTA de
// importar e estado de erro sem nenhuma linha. Asserção sobre conteúdo, sem
// snapshot: um ajuste de Tailwind não pode quebrar este arquivo.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ComplianceMap,
  MapRow,
  SetRow,
} from "@/app/(charter)/actions/compliance";

const listRequirementSetsMock = vi.fn();
const getComplianceMapMock = vi.fn();
const importRequirementSetMock = vi.fn();
const listCapabilitiesMock = vi.fn();
const setCoverageMock = vi.fn();
const exportComplianceMapMock = vi.fn();

vi.mock("@/app/(charter)/actions/compliance", () => ({
  listRequirementSets: (...args: unknown[]) => listRequirementSetsMock(...args),
  getComplianceMap: (...args: unknown[]) => getComplianceMapMock(...args),
  importRequirementSet: (...args: unknown[]) =>
    importRequirementSetMock(...args),
  listCapabilities: (...args: unknown[]) => listCapabilitiesMock(...args),
  setCoverage: (...args: unknown[]) => setCoverageMock(...args),
}));
vi.mock("@/app/(charter)/actions/compliance-export", () => ({
  exportComplianceMap: (...args: unknown[]) => exportComplianceMapMock(...args),
}));

import ComplianceScreen from "../../components/charter/screens/compliance";

const set = (over: Partial<SetRow> = {}): SetRow => ({
  id: "set-1",
  nome: "RFP Banco Aurora",
  origem: "RFP",
  versao: "1",
  total: 1,
  ...over,
});

const row = (over: Partial<MapRow> = {}): MapRow => ({
  requirementId: "req-1",
  codigo: "4.2.1",
  citacao: "RFP §4.2.1",
  resumo: "Aceite individual de política deve ser rastreável por pessoa",
  peso: null,
  status: "SEM_VEREDITO",
  comentario: null,
  capabilityId: null,
  capabilityLabel: null,
  evidencia: null,
  evidenciaErro: null,
  ...over,
});

const map = (over: Partial<ComplianceMap> = {}): ComplianceMap => ({
  setId: "set-1",
  nome: "RFP Banco Aurora",
  semVeredito: 0,
  linhas: [],
  ...over,
});

type BlobCall = { parts: unknown[]; type?: string };

/**
 * Substitui o `Blob` global por um stub que só grava os argumentos do
 * construtor. jsdom, neste ambiente, não implementa `.text()`/`.arrayBuffer()`
 * em `Blob` — inspecionar os argumentos do construtor é mais direto de
 * qualquer forma para provar que o base64 foi decodificado *antes* de
 * `new Blob(...)`, que é exatamente o ponto onde um erro de encoding
 * corromperia o arquivo sem lançar exceção nenhuma.
 */
function stubBlob(): { calls: BlobCall[]; restore: () => void } {
  const OriginalBlob = globalThis.Blob;
  const calls: BlobCall[] = [];
  class RecordingBlob {
    constructor(parts: unknown[] = [], options?: { type?: string }) {
      calls.push({ parts, type: options?.type });
    }
  }
  // @ts-expect-error — stub de teste, não é um Blob de verdade
  globalThis.Blob = RecordingBlob;
  return {
    calls,
    restore: () => {
      globalThis.Blob = OriginalBlob;
    },
  };
}

describe("ComplianceScreen", () => {
  beforeEach(() => {
    listRequirementSetsMock.mockReset();
    getComplianceMapMock.mockReset();
    importRequirementSetMock.mockReset();
    listCapabilitiesMock.mockReset();
    setCoverageMock.mockReset();
    exportComplianceMapMock.mockReset();
    // Padrão neutro: a maioria dos testes não mexe no editor de cobertura.
    // Os que mexem sobrescrevem com capacidades reais.
    listCapabilitiesMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("linha ATENDE mostra a evidência real, não um selo", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            status: "ATENDE",
            capabilityId: "POLICY_ATTESTATION",
            capabilityLabel:
              "Aceite individual de política, com revalidação por versão",
            evidencia: { total: 37, amostra: ["Bia Santos · 12/07/2026"] },
          }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    // A prova é a contagem, não um ícone de check isolado. "Atende" também
    // aparece no KPI de contagem — por isso getAllByText, não getByText.
    expect(await screen.findByText(/37 aceites/i)).toBeTruthy();
    expect(screen.getAllByText("Atende").length).toBeGreaterThan(0);
  });

  it("linha com evidenciaErro mostra 'evidência indisponível' e nunca a evidência", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            status: "ATENDE",
            capabilityId: "POLICY_ATTESTATION",
            // Preenchido de propósito mesmo com erro: prova que a tela
            // prioriza o erro sobre uma evidência que porventura já exista
            // no objeto, não só o caso em que evidencia é null.
            evidencia: { total: 99, amostra: [] },
            evidenciaErro: "Falha ao buscar evidência: timeout na capacidade.",
          }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    expect(await screen.findByText(/evidência indisponível/i)).toBeTruthy();
    expect(screen.queryByText(/99/)).toBeNull();
  });

  it("linha REVISAR aparece destacada com o motivo", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            status: "REVISAR",
            comentario:
              "Cláusula mudou de redação na v2 — confirmar se a capacidade ainda cobre.",
          }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    expect(await screen.findByText("Revisar")).toBeTruthy();
    expect(screen.getByText(/Cláusula mudou de redação na v2/i)).toBeTruthy();
  });

  it("mostra a contagem de sem-veredito na tela, não só no export", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        semVeredito: 3,
        linhas: [
          row({ requirementId: "r-1" }),
          row({ requirementId: "r-2" }),
          row({ requirementId: "r-3" }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    expect(
      await screen.findByText(/3 de 3 exigências sem veredito registrado/i)
    ).toBeTruthy();
  });

  it("estado vazio (nenhum conjunto) mostra CTA de importar", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [] });

    render(<ComplianceScreen />);

    expect(
      await screen.findByRole("button", {
        name: /importar conjunto de exigências/i,
      })
    ).toBeTruthy();
    // Sem conjunto, não existe setId válido para consultar — chamar mesmo
    // assim seria um fetch fantasma.
    expect(getComplianceMapMock).not.toHaveBeenCalled();
  });

  it("estado de erro não renderiza nenhuma linha", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: false,
      error: "Conjunto de exigências não encontrado.",
    });

    render(<ComplianceScreen />);

    expect(
      await screen.findByText("Conjunto de exigências não encontrado.")
    ).toBeTruthy();
    expect(screen.queryByText("4.2.1")).toBeNull();
    expect(screen.queryByText("Atende")).toBeNull();
  });

  // ── Editor de cobertura (fecha o gap: sem isto nenhuma ação do usuário
  //    produz CharterCoverage, e o mapa nunca sai de SEM_VEREDITO) ──────────

  it("sugere capacidade por palavra-chave, mas não decide sozinha", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            requirementId: "req-9",
            codigo: "6.1.2",
            citacao: "RFP §6.1.2",
            resumo: "Aceite individual de política deve ser registrado",
            status: "SEM_VEREDITO",
          }),
        ],
      }),
    });
    listCapabilitiesMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "POLICY_ATTESTATION",
          label: "Aceite individual de política, com revalidação por versão",
        },
        {
          id: "VENDOR_TIER",
          label: "Fornecedor classificado como aprovado, restrito ou bloqueado",
        },
      ],
    });
    setCoverageMock.mockResolvedValue({ ok: true, data: null });

    render(<ComplianceScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /definir veredito/i })
    );

    // Pré-selecionado pela sobreposição de palavras com o resumo/citação —
    // mas ainda não gravado: abrir o editor sozinho não chama setCoverage.
    const capabilitySelect = screen.getByLabelText(
      "Capacidade que prova"
    ) as HTMLSelectElement;
    expect(capabilitySelect.value).toBe("POLICY_ATTESTATION");
    expect(setCoverageMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "ATENDE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar veredito/i }));

    await waitFor(() =>
      expect(setCoverageMock).toHaveBeenCalledWith({
        requirementId: "req-9",
        status: "ATENDE",
        capabilityId: "POLICY_ATTESTATION",
        comentario: undefined,
      })
    );
  });

  it("desabilita Atende/Parcial até uma capacidade ser escolhida", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            requirementId: "req-10",
            codigo: "9.9.9",
            citacao: "RFP §9.9.9",
            // De propósito sem nenhuma palavra em comum com os rótulos das
            // capacidades abaixo — a sugestão deve devolver "" (nenhuma).
            resumo: "Empresa mantém registro físico de visitantes na recepção",
            status: "SEM_VEREDITO",
          }),
        ],
      }),
    });
    listCapabilitiesMock.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "POLICY_ATTESTATION",
          label: "Aceite individual de política, com revalidação por versão",
        },
      ],
    });

    render(<ComplianceScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /definir veredito/i })
    );

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    const atendeOption = Array.from(statusSelect.options).find(
      (o) => o.value === "ATENDE"
    );
    const capabilitySelect = screen.getByLabelText(
      "Capacidade que prova"
    ) as HTMLSelectElement;
    expect(capabilitySelect.value).toBe("");
    expect(atendeOption?.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Capacidade que prova"), {
      target: { value: "POLICY_ATTESTATION" },
    });

    expect(atendeOption?.disabled).toBe(false);
  });

  // ── ImportQuickAddForm (estado vazio) ─────────────────────────────────────

  it("ImportQuickAddForm preenche, envia e chama importRequirementSet com o que foi digitado", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [] });
    importRequirementSetMock.mockResolvedValue({
      ok: true,
      data: { id: "set-novo", total: 1 },
    });

    render(<ComplianceScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /importar conjunto de exigências/i,
      })
    );

    // getByPlaceholderText em vez de getByLabelText: Field separa <label> e
    // <input> como irmãos ligados só por htmlFor/id, e a resolução de
    // label→control por essa associação não é confiável neste ambiente de
    // teste — placeholder é um atributo direto, sem ambiguidade.
    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "RFP Banco Aurora 2026" },
    });
    fireEvent.change(screen.getByPlaceholderText("ex: 4.2.1"), {
      target: { value: "4.2.1" },
    });
    fireEvent.change(screen.getByPlaceholderText("ex: RFP §4.2.1"), {
      target: { value: "RFP §4.2.1" },
    });
    fireEvent.change(screen.getByPlaceholderText("O que a exigência pede"), {
      target: { value: "Retenção de dados por 5 anos" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    await waitFor(() =>
      expect(importRequirementSetMock).toHaveBeenCalledWith({
        nome: "RFP Banco Aurora 2026",
        origem: "RFP",
        requisitos: [
          {
            codigo: "4.2.1",
            citacao: "RFP §4.2.1",
            resumo: "Retenção de dados por 5 anos",
          },
        ],
      })
    );
  });

  // ── Download do export (base64 x utf8 — errar aqui corrompe o arquivo
  //    sem lançar erro nenhum, o tipo de bug que ninguém percebe sozinho) ───

  it("exporta CSV como texto puro (utf8), sem decodificar", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [row()] }),
    });
    const csvContent = "codigo,status\n4.2.1,SEM_VEREDITO\n";
    exportComplianceMapMock.mockResolvedValue({
      ok: true,
      data: {
        filename: "charter-mapa-set-1.csv",
        mimeType: "text/csv",
        content: csvContent,
        encoding: "utf8",
      },
    });

    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
    const blobStub = stubBlob();

    try {
      render(<ComplianceScreen />);
      fireEvent.click(await screen.findByRole("button", { name: /exportar/i }));

      await waitFor(() =>
        expect(exportComplianceMapMock).toHaveBeenCalledWith({
          setId: "set-1",
          format: "csv",
        })
      );
      await waitFor(() => expect(blobStub.calls).toHaveLength(1));
      // utf8: o conteúdo vira Blob como string, sem tocar em base64.
      expect(blobStub.calls[0].parts).toEqual([csvContent]);
      expect(blobStub.calls[0].type).toBe("text/csv;charset=utf-8");
    } finally {
      blobStub.restore();
    }
  });

  it("decodifica PDF em base64 antes de montar o Blob — senão o arquivo corrompe", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [row()] }),
    });
    // "%PDF-" em bytes — início real de um arquivo PDF.
    const pdfBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const base64 = Buffer.from(pdfBytes).toString("base64");
    exportComplianceMapMock.mockResolvedValue({
      ok: true,
      data: {
        filename: "charter-mapa-set-1.pdf",
        mimeType: "application/pdf",
        content: base64,
        encoding: "base64",
      },
    });

    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:fake"),
      revokeObjectURL: vi.fn(),
    });
    const blobStub = stubBlob();

    try {
      render(<ComplianceScreen />);
      await screen.findByRole("button", { name: /exportar/i });

      fireEvent.change(screen.getByLabelText("Formato de exportação"), {
        target: { value: "pdf" },
      });
      fireEvent.click(screen.getByRole("button", { name: /exportar/i }));

      await waitFor(() =>
        expect(exportComplianceMapMock).toHaveBeenCalledWith({
          setId: "set-1",
          format: "pdf",
        })
      );
      await waitFor(() => expect(blobStub.calls).toHaveLength(1));
      // base64: se o encoding-check no componente regredir, isto vira
      // [base64] (a string crua) em vez de [Uint8Array com os bytes reais) —
      // o PDF sairia corrompido sem nenhum erro lançado.
      const [part] = blobStub.calls[0].parts;
      expect(part).toBeInstanceOf(Uint8Array);
      expect(Array.from(part as Uint8Array)).toEqual(Array.from(pdfBytes));
      expect(blobStub.calls[0].type).toBe("application/pdf");
    } finally {
      blobStub.restore();
    }
  });
});
