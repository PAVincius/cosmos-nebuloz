/** @vitest-environment jsdom */
// compliance-screen.test.tsx — cobre os seis estados que a tela de
// conformidade precisa mostrar honestamente: evidência real numa linha
// ATENDE (nunca um selo), "evidência indisponível" quando a consulta falhou
// (nunca a evidência antiga), REVISAR destacado com o motivo, a contagem de
// sem-veredito na tela — não só no export —, estado vazio com CTA de
// importar e estado de erro sem nenhuma linha. Asserção sobre conteúdo, sem
// snapshot: um ajuste de Tailwind não pode quebrar este arquivo.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ComplianceMap,
  MapRow,
  SetRow,
} from "@/app/(charter)/actions/compliance";

const listRequirementSetsMock = vi.fn();
const getComplianceMapMock = vi.fn();
const importRequirementSetMock = vi.fn();
const exportComplianceMapMock = vi.fn();

vi.mock("@/app/(charter)/actions/compliance", () => ({
  listRequirementSets: (...args: unknown[]) => listRequirementSetsMock(...args),
  getComplianceMap: (...args: unknown[]) => getComplianceMapMock(...args),
  importRequirementSet: (...args: unknown[]) =>
    importRequirementSetMock(...args),
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

describe("ComplianceScreen", () => {
  beforeEach(() => {
    listRequirementSetsMock.mockReset();
    getComplianceMapMock.mockReset();
    importRequirementSetMock.mockReset();
    exportComplianceMapMock.mockReset();
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
});
