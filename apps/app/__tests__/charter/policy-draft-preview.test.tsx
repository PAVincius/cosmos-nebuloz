/** @vitest-environment jsdom */
// policy-draft-preview.test.tsx — prévia inline de rascunho gerado por IA
// (FR-2.7): gerar não persiste (só a auditoria, na action), confirmação em
// dois cliques quando já existe texto na seção, aviso de inventário vazio, e
// só "Aceitar" chama saveGeneratedDraft — molde de policy-scope.test.tsx
// (jsdom, sonner mockado, actions hoisted).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const gerarMock = vi.hoisted(() => vi.fn());
const salvarMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/(charter)/actions/policy", () => ({
  generatePolicyDraft: (...a: unknown[]) => gerarMock(...a),
  saveGeneratedDraft: (...a: unknown[]) => salvarMock(...a),
}));

import { PolicyDraftPreview } from "../../components/charter/screens/policy-draft-preview";

describe("PolicyDraftPreview", () => {
  beforeEach(() => {
    gerarMock.mockReset();
    salvarMock.mockReset();
    toastMocks.loading.mockReset();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    toastMocks.loading.mockReturnValue("toast-1");
  });

  it("clique em Gerar mostra estado de carregamento e gate o botão", async () => {
    gerarMock.mockReturnValue(new Promise(() => {})); // nunca resolve

    render(
      <PolicyDraftPreview
        bodyAtual=""
        onAccepted={vi.fn()}
        sectionId="sec-1"
        sectionName="Classificação de dados"
      />
    );
    fireEvent.click(screen.getByText("Gerar rascunho"));

    const botao = await screen.findByText(/Gerando rascunho/);
    expect(botao).toBeTruthy();
    const wrapper = botao.closest("span");
    expect(wrapper?.style.pointerEvents).toBe("none");
  });

  it("sucesso mostra o corpo e Aceitar salva com a primeira exigência fundamentada", async () => {
    gerarMock.mockResolvedValue({
      ok: true,
      data: {
        body: "Texto do rascunho gerado.",
        grounded: [
          { id: "req-1", codigo: "SEC-01", citacao: "cit-1" },
          { id: "req-2", codigo: "SEC-02", citacao: "cit-2" },
        ],
        fontes: { casos: 1, fornecedores: 1, exigencias: 2 },
      },
    });
    salvarMock.mockResolvedValue({ ok: true, data: null });
    const onAccepted = vi.fn();

    render(
      <PolicyDraftPreview
        bodyAtual=""
        onAccepted={onAccepted}
        sectionId="sec-1"
        sectionName="Classificação de dados"
      />
    );
    fireEvent.click(screen.getByText("Gerar rascunho"));
    await screen.findByDisplayValue("Texto do rascunho gerado.");

    fireEvent.click(screen.getByText("Aceitar rascunho"));

    await waitFor(() =>
      expect(salvarMock).toHaveBeenCalledWith({
        sectionId: "sec-1",
        body: "Texto do rascunho gerado.",
        groundedRequirementId: "req-1",
      })
    );
    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
  });

  it("Descartar limpa a prévia sem chamar saveGeneratedDraft", async () => {
    gerarMock.mockResolvedValue({
      ok: true,
      data: {
        body: "Rascunho a descartar.",
        grounded: [{ id: "req-1", codigo: "SEC-01", citacao: "cit-1" }],
        fontes: { casos: 1, fornecedores: 0, exigencias: 1 },
      },
    });

    render(
      <PolicyDraftPreview
        bodyAtual=""
        onAccepted={vi.fn()}
        sectionId="sec-1"
        sectionName="Classificação de dados"
      />
    );
    fireEvent.click(screen.getByText("Gerar rascunho"));
    await screen.findByDisplayValue("Rascunho a descartar.");

    fireEvent.click(screen.getByText("Descartar"));

    expect(screen.queryByDisplayValue("Rascunho a descartar.")).toBeNull();
    expect(screen.getByText("Gerar rascunho")).toBeTruthy();
    expect(salvarMock).not.toHaveBeenCalled();
  });

  it("falha na geração mostra o erro e Tentar de novo re-dispara a geração", async () => {
    gerarMock.mockResolvedValue({
      ok: false,
      error: "A geração falhou — tente de novo.",
    });

    render(
      <PolicyDraftPreview
        bodyAtual=""
        onAccepted={vi.fn()}
        sectionId="sec-1"
        sectionName="Classificação de dados"
      />
    );
    fireEvent.click(screen.getByText("Gerar rascunho"));

    expect(
      await screen.findByText("A geração falhou — tente de novo.")
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Tentar de novo"));

    await waitFor(() => expect(gerarMock).toHaveBeenCalledTimes(2));
  });

  it("seção com texto exige confirmação em dois cliques antes de gerar", async () => {
    gerarMock.mockResolvedValue({
      ok: true,
      data: {
        body: "Novo rascunho.",
        grounded: [],
        fontes: { casos: 0, fornecedores: 0, exigencias: 0 },
      },
    });

    render(
      <PolicyDraftPreview
        bodyAtual="Texto já escrito pela equipe."
        onAccepted={vi.fn()}
        sectionId="sec-1"
        sectionName="Classificação de dados"
      />
    );

    fireEvent.click(screen.getByText("Gerar rascunho"));
    expect(gerarMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Gerar por cima do texto atual?")
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Gerar por cima do texto atual?"));
    await waitFor(() => expect(gerarMock).toHaveBeenCalledTimes(1));
  });

  it("inventário vazio mostra aviso de rascunho genérico", async () => {
    gerarMock.mockResolvedValue({
      ok: true,
      data: {
        body: "Rascunho sem inventário.",
        grounded: [{ id: "req-1", codigo: "SEC-01", citacao: "cit-1" }],
        fontes: { casos: 0, fornecedores: 0, exigencias: 1 },
      },
    });

    render(
      <PolicyDraftPreview
        bodyAtual=""
        onAccepted={vi.fn()}
        sectionId="sec-1"
        sectionName="Classificação de dados"
      />
    );
    fireEvent.click(screen.getByText("Gerar rascunho"));

    expect(await screen.findByText(/Rascunho genérico/)).toBeTruthy();
  });
});
