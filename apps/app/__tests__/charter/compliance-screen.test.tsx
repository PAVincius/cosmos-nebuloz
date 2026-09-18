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

const listRequirementSetsMock = vi.fn();
const getComplianceMapMock = vi.fn();
const importRequirementSetMock = vi.fn();
const listCapabilitiesMock = vi.fn();
const getComplianceCanMock = vi.fn();
const setCoverageMock = vi.fn();
const exportComplianceMapMock = vi.fn();
const adoptSetVersionMock = vi.fn();
const publishSetVersionMock = vi.fn();

vi.mock("@/app/(charter)/actions/compliance", () => ({
  listRequirementSets: (...args: unknown[]) => listRequirementSetsMock(...args),
  getComplianceMap: (...args: unknown[]) => getComplianceMapMock(...args),
  importRequirementSet: (...args: unknown[]) =>
    importRequirementSetMock(...args),
  listCapabilities: (...args: unknown[]) => listCapabilitiesMock(...args),
  getComplianceCan: (...args: unknown[]) => getComplianceCanMock(...args),
  setCoverage: (...args: unknown[]) => setCoverageMock(...args),
  adoptSetVersion: (...args: unknown[]) => adoptSetVersionMock(...args),
  publishSetVersion: (...args: unknown[]) => publishSetVersionMock(...args),
}));
vi.mock("@/app/(charter)/actions/compliance-export", () => ({
  exportComplianceMap: (...args: unknown[]) => exportComplianceMapMock(...args),
}));

import ComplianceScreen from "../../components/charter/screens/compliance";

import { map, row, set } from "./compliance-screen.fixtures";

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
    getComplianceCanMock.mockReset();
    setCoverageMock.mockReset();
    exportComplianceMapMock.mockReset();
    adoptSetVersionMock.mockReset();
    publishSetVersionMock.mockReset();
    // Padrão neutro: a maioria dos testes não mexe no editor de cobertura.
    // Os que mexem sobrescrevem com capacidades reais.
    listCapabilitiesMock.mockResolvedValue({ ok: true, data: [] });
    // Padrão permissivo: a maioria dos testes não é sobre o gate de
    // compliance.edit — só o describe dedicado a ele sobrescreve para false.
    getComplianceCanMock.mockResolvedValue({ ok: true, data: { edit: true } });
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

  it("mostra a fração e nomeia as lacunas quando a evidência tem denominador", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            status: "ATENDE",
            capabilityId: "POLICY_LINK",
            evidencia: {
              total: 12,
              de: 14,
              amostra: ["USE_CASE · UC-001 Triagem"],
              lacunas: [
                "USE_CASE · UC-013 Sumarizador",
                "USE_CASE · UC-014 Chat interno",
              ],
            },
          }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    expect(await screen.findByText("12 de 14")).toBeTruthy();
    expect(screen.getByText(/2 fora da política/)).toBeTruthy();
    expect(screen.getByText(/UC-013 Sumarizador/)).toBeTruthy();
  });

  it("trunca lacunas em 3 nomes e soma o resto no sufixo", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            status: "ATENDE",
            capabilityId: "POLICY_LINK",
            evidencia: {
              total: 9,
              de: 14,
              amostra: ["USE_CASE · UC-001 Triagem"],
              lacunas: [
                "USE_CASE · UC-013 Sumarizador",
                "USE_CASE · UC-014 Chat interno",
                "USE_CASE · UC-015 Triagem de ticket",
                "VENDOR · V-003 Fornecedor de tradução",
                "VENDOR · V-004 Fornecedor de anotação",
              ],
            },
          }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    expect(await screen.findByText(/5 fora da política/)).toBeTruthy();
    // As três primeiras vêm nomeadas...
    expect(screen.getByText(/UC-013 Sumarizador/)).toBeTruthy();
    expect(screen.getByText(/UC-014 Chat interno/)).toBeTruthy();
    expect(screen.getByText(/UC-015 Triagem de ticket/)).toBeTruthy();
    // ...a quarta e a quinta não — só somadas no sufixo.
    expect(screen.queryByText(/V-003/)).toBeNull();
    expect(screen.queryByText(/V-004/)).toBeNull();
    expect(screen.getByText(/e mais 2/)).toBeTruthy();
  });

  it("evidência sem denominador segue mostrando só a contagem", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({
        linhas: [
          row({
            status: "ATENDE",
            capabilityId: "POLICY_ATTESTATION",
            evidencia: { total: 37, amostra: [] },
          }),
        ],
      }),
    });

    render(<ComplianceScreen />);

    expect(await screen.findByText("37 aceites")).toBeTruthy();
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

  // ── Gate de compliance.edit (Bloqueio "CoverageEditor sem gate") ─────────

  it("papel sem compliance.edit vê 'Definir veredito' desabilitado, com o motivo", async () => {
    // LEGAL, SECURITY, EXEC e AUDITOR têm compliance.map sem compliance.edit
    // (packages/rbac/src/charter-matrix.ts) — para eles o botão precisa
    // ficar visível (o usuário sabe que a ação existe) e desabilitado, nunca
    // escondido nem clicável até falhar no servidor.
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [row()] }),
    });
    getComplianceCanMock.mockResolvedValue({ ok: true, data: { edit: false } });

    render(<ComplianceScreen />);

    const botao = (await screen.findByRole("button", {
      name: /definir veredito/i,
    })) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(botao.title).toContain("Compliance");

    fireEvent.click(botao);
    // Desabilitado de verdade, não só apagado visualmente: o clique não abre
    // o editor nem chega perto de setCoverage.
    expect(screen.queryByLabelText("Status")).toBeNull();
    expect(setCoverageMock).not.toHaveBeenCalled();
  });

  // ── ImportQuickAddForm (estado vazio) ─────────────────────────────────────

  it("ImportQuickAddForm aceita várias linhas e chama importRequirementSet com todas as exigências", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [] });
    importRequirementSetMock.mockResolvedValue({
      ok: true,
      data: { id: "set-novo", total: 2 },
    });

    render(<ComplianceScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /importar conjunto de exigências/i,
      })
    );

    // getByPlaceholderText em vez de getByLabelText: Field separa <label> e
    // <input>/<textarea> como irmãos ligados só por htmlFor/id, e a
    // resolução de label→control por essa associação não é confiável neste
    // ambiente de teste — placeholder é um atributo direto, sem ambiguidade.
    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "RFP Banco Aurora 2026" },
    });
    fireEvent.change(screen.getByPlaceholderText(/4\.2\.1/), {
      target: {
        value:
          "4.2.1 | RFP §4.2.1 | Retenção de dados por 5 anos\n" +
          "4.2.2 | RFP §4.2.2 | Criptografia em repouso obrigatória",
      },
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
          {
            codigo: "4.2.2",
            citacao: "RFP §4.2.2",
            resumo: "Criptografia em repouso obrigatória",
          },
        ],
      })
    );
  });

  it("recusa linha malformada nomeando a linha, sem chamar a action", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [] });

    render(<ComplianceScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /importar conjunto de exigências/i,
      })
    );

    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "RFP Banco Aurora 2026" },
    });
    // Segunda linha não tem os dois separadores "|" — igual a colar uma
    // linha da RFP que não seguiu o formato pedido no hint do campo.
    fireEvent.change(screen.getByPlaceholderText(/4\.2\.1/), {
      target: {
        value:
          "4.2.1 | RFP §4.2.1 | Retenção de dados por 5 anos\n" +
          "linha colada sem separador nenhum",
      },
    });

    // Nomeia a linha ofensora — mesma disciplina de importRequirementSet
    // para código duplicado, não um "formato inválido" genérico.
    expect(await screen.findByText(/Linha 2:/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));
    expect(importRequirementSetMock).not.toHaveBeenCalled();
  });

  it("botão permanente de importar (Bloqueio 1) funciona mesmo com conjuntos já existentes", async () => {
    // Antes da correção, ImportQuickAddForm só renderizava dentro do galho
    // sets.length === 0 — inalcançável assim que a seed de regulação (Task
    // 10) grava os 4 conjuntos globais. Este teste teria falhado nessa
    // versão: nenhum botão "Importar exigências" existia com conjuntos.
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [row()] }),
    });

    render(<ComplianceScreen />);
    await screen.findByText("4.2.1"); // mapa carregou — não é o estado vazio

    fireEvent.click(
      screen.getByRole("button", { name: /^importar exigências$/i })
    );

    expect(
      await screen.findByPlaceholderText("ex: RFP Banco Aurora 2026")
    ).toBeTruthy();
  });

  // ── Publicar nova versão de um conjunto existente (Task 12 — fecha o
  //    bloqueio: publishSetVersion ganha caller de produção) ───────────────

  it("importar com conjunto selecionado publica versão em vez de conjunto novo", async () => {
    listRequirementSetsMock.mockResolvedValue({
      ok: true,
      data: [set({ id: "set-v1", nome: "RFP Cliente", versao: "1" })],
    });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [] }),
    });
    publishSetVersionMock.mockResolvedValue({
      ok: true,
      data: { id: "set-v2", afetadas: 1 },
    });

    render(<ComplianceScreen />);
    // Espera o conjunto carregar — sem isso o seletor "Substitui um conjunto
    // existente" abriria sem a opção "set-v1" para escolher.
    await screen.findByText("1 conjunto de exigências");

    fireEvent.click(
      screen.getByRole("button", { name: /^importar exigências$/i })
    );

    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "RFP Cliente" },
    });
    fireEvent.change(screen.getByPlaceholderText(/4\.2\.1/), {
      target: { value: "A-1 | §1 | Resumo" },
    });
    fireEvent.change(screen.getByLabelText("Substitui um conjunto existente"), {
      target: { value: "set-v1" },
    });
    fireEvent.change(screen.getByLabelText("Versão"), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    await waitFor(() =>
      expect(publishSetVersionMock).toHaveBeenCalledWith(
        expect.objectContaining({ supersedesId: "set-v1", versao: "2" })
      )
    );
    expect(importRequirementSetMock).not.toHaveBeenCalled();
  });

  it("importar sem selecionar conjunto segue criando conjunto novo", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [] });
    importRequirementSetMock.mockResolvedValue({
      ok: true,
      data: { id: "novo", total: 1 },
    });

    render(<ComplianceScreen />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: /importar conjunto de exigências/i,
      })
    );

    fireEvent.change(screen.getByPlaceholderText("ex: RFP Banco Aurora 2026"), {
      target: { value: "RFP Nova" },
    });
    fireEvent.change(screen.getByPlaceholderText(/4\.2\.1/), {
      target: { value: "A-1 | §1 | Resumo" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^importar$/i }));

    await waitFor(() => expect(importRequirementSetMock).toHaveBeenCalled());
    expect(publishSetVersionMock).not.toHaveBeenCalled();
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

  // ── Adotar a versão nova do conjunto ativo (Task 11) ──────────────────────

  it("oferece adotar quando o conjunto em uso tem sucessor", async () => {
    listRequirementSetsMock.mockResolvedValue({
      ok: true,
      data: [
        set({
          id: "set-v1",
          supersededById: "set-v2",
          diff: { alteradas: 7, novas: 2, removidas: 1 },
        }),
      ],
    });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [row()] }),
    });
    adoptSetVersionMock.mockResolvedValue({
      ok: true,
      data: { transportadas: 9, emRevisao: 7, novas: 2 },
    });

    render(<ComplianceScreen />);

    expect(
      await screen.findByText(/7 alteradas, 2 novas, 1 removida/)
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Adotar a versão nova"));

    await waitFor(() =>
      expect(adoptSetVersionMock).toHaveBeenCalledWith({ setId: "set-v2" })
    );
  });

  it("conjunto sem sucessor não mostra aviso de versão", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [row()] }),
    });

    render(<ComplianceScreen />);
    await screen.findByText("4.2.1"); // mapa carregou — não é o estado vazio

    expect(screen.queryByText("Adotar a versão nova")).toBeNull();
  });

  it("cai no conjunto com cobertura do tenant, não no sucessor vazio — é onde mora o aviso de adoção", async () => {
    // listRequirementSets ordena por importadoEm desc: set-v2 (o sucessor,
    // sem nenhum veredito do tenant ainda) vem primeiro na lista, exatamente
    // como o seed publicando uma v2 nova deixaria. Sem o critério de
    // temCobertura, activeId cairia em set-v2 e o aviso abaixo — que só o
    // antecessor carrega (supersededById + diff) — nunca apareceria sozinho.
    listRequirementSetsMock.mockResolvedValue({
      ok: true,
      data: [
        set({ id: "set-v2", nome: "Reg", versao: "2" }),
        set({
          id: "set-v1",
          nome: "Reg",
          versao: "1",
          temCobertura: true,
          supersededById: "set-v2",
          diff: { alteradas: 1, novas: 1, removidas: 0 },
        }),
      ],
    });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ setId: "set-v1", linhas: [] }),
    });

    render(<ComplianceScreen />);

    // Sem clique nenhum: a carga limpa já abre set-v1 e mostra o aviso.
    expect(
      await screen.findByText(/1 alteradas, 1 novas, 0 removida/)
    ).toBeTruthy();
    expect(getComplianceMapMock).toHaveBeenCalledWith("set-v1");
  });

  it('dropdown "Substitui um conjunto existente" nunca oferece um conjunto global', async () => {
    // publishSetVersion recusa supersedesId de conjunto global no servidor —
    // este teste escopa a asserção ao select de dentro do Field (por label),
    // não à tela toda: o Select do header (linha ~908 de compliance.tsx)
    // lista todos os conjuntos, inclusive o global, então um getByText solto
    // acharia o nome do global ali e passaria mesmo com o dropdown de
    // "substituir" quebrado.
    listRequirementSetsMock.mockResolvedValue({
      ok: true,
      data: [
        set({ id: "set-global", nome: "EU AI Act", versao: "1", global: true }),
        set({ id: "set-tenant", nome: "RFP Banco Aurora", versao: "1" }),
      ],
    });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [] }),
    });

    render(<ComplianceScreen />);
    await screen.findByText("2 conjuntos de exigências");

    fireEvent.click(
      screen.getByRole("button", { name: /^importar exigências$/i })
    );

    const supersedesSelect = screen.getByLabelText(
      "Substitui um conjunto existente"
    ) as HTMLSelectElement;
    const labels = Array.from(supersedesSelect.options).map(
      (o) => o.textContent
    );

    expect(labels).not.toContain("EU AI Act (v1)");
    expect(labels).toContain("RFP Banco Aurora (v1)");
  });

  // ── Observações menores da onda de conformidade ───────────────────────────

  it('pluraliza "removida/removidas" no banner de versão nova', async () => {
    listRequirementSetsMock.mockResolvedValue({
      ok: true,
      data: [
        set({
          id: "set-v1",
          supersededById: "set-v2",
          diff: { alteradas: 0, novas: 0, removidas: 2 },
        }),
      ],
    });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [] }),
    });

    render(<ComplianceScreen />);

    expect(await screen.findByText(/2 removidas\./)).toBeTruthy();
  });

  it("conjunto sem exigências mostra estado vazio com CTA de importar, não um texto seco", async () => {
    listRequirementSetsMock.mockResolvedValue({ ok: true, data: [set()] });
    getComplianceMapMock.mockResolvedValue({
      ok: true,
      data: map({ linhas: [] }),
    });

    render(<ComplianceScreen />);
    await screen.findByText("1 conjunto de exigências");

    fireEvent.click(
      await screen.findByRole("button", {
        name: /importar exigências para este conjunto/i,
      })
    );

    expect(
      await screen.findByPlaceholderText("ex: RFP Banco Aurora 2026")
    ).toBeTruthy();
  });
});
