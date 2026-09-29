import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Editor do caso de negócio. `saveDraft` tinha zero chamadores fora de testes:
// sem tela para as métricas, nenhum caso chegava a "Enviar para assinatura" e
// nenhuma trilha passava da Fase 1 (SG-04).

const h = vi.hoisted(() => ({
  getBusinessCase: vi.fn(),
  saveDraft: vi.fn(),
  submitForSignature: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(scaffold)/actions/business-case", () => ({
  getBusinessCase: h.getBusinessCase,
  saveDraft: h.saveDraft,
  submitForSignature: h.submitForSignature,
  signBusinessCase: vi.fn(),
  contestBusinessCase: vi.fn(),
  newVersionFromSigned: vi.fn(),
}));
vi.mock("@/app/(scaffold)/actions/export", () => ({
  exportBusinessCase: vi.fn(),
}));

import BaselineDetailScreen from "@/components/scaffold/screens/baseline-detail";

const BC_ID = "clx0000000000000000000bc1";
const VER_ID = "clx000000000000000000ver1";

function draft(over: Record<string, unknown> = {}) {
  return {
    id: BC_ID,
    code: "BC-104",
    trackId: "trk1",
    trackCode: "TR-104",
    processName: "Triagem",
    state: "DRAFT",
    currentVersionId: VER_ID,
    signedVersionId: null,
    windowStart: null,
    windowMonths: null,
    cadence: null,
    benefitKind: "COST_AVOIDED",
    benefitHard: false,
    benefitAnnualCents: null,
    benefitBasis: "",
    financeReviewedAt: null,
    signalInitiativeRef: null,
    metrics: [],
    versions: [
      {
        id: VER_ID,
        label: "v1",
        state: "DRAFT",
        note: "",
        authoredAt: new Date("2026-09-01"),
        signedAt: null,
        signedByLabel: null,
        contentHash: null,
      },
    ],
    openContest: null,
    ...over,
  };
}

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillValid() {
  fill(/^Rótulo/, "Cycle time da triagem");
  fill(/^Unidade/, "min");
  fill(/^Linha de base/, "46");
  fill(/^Meta/, "34");
  fill(/^Fonte/, "Log do sistema de fila");
  fill(/^Amostra/, "4 semanas");
  fill(/^Janela de apuração/, "6");
  fill(/^Base do benefício/, "Horas de triagem evitadas.");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getBusinessCase.mockResolvedValue({ ok: true, data: draft() });
  h.saveDraft.mockResolvedValue({ ok: true, data: undefined });
});

describe("editor do caso de negócio", () => {
  it("rascunho mostra o editor", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    expect(await screen.findByLabelText(/^Rótulo/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /salvar rascunho/i })
    ).toBeDefined();
  });

  it("enviado para assinatura, o editor some: a versão está congelada", async () => {
    h.getBusinessCase.mockResolvedValue({
      ok: true,
      data: draft({ state: "AWAITING" }),
    });
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByText("BC-104 · v1");
    expect(screen.queryByLabelText(/^Rótulo/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /salvar rascunho/i })
    ).toBeNull();
  });

  it("salva o que foi digitado, no formato que saveDraft aceita", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));

    await waitFor(() => expect(h.saveDraft).toHaveBeenCalledTimes(1));
    expect(h.saveDraft.mock.calls[0]?.[0]).toMatchObject({
      businessCaseId: BC_ID,
      windowMonths: 6,
      cadence: "monthly",
      benefitBasis: "Horas de triagem evitadas.",
      metrics: [
        {
          key: "cycle-time-da-triagem",
          label: "Cycle time da triagem",
          baseValue: "46",
          targetValue: "34",
          direction: "DOWN",
        },
      ],
    });
  });

  it("formulário inválido não chega ao servidor e diz o que falta", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/métrica 1/i);
    expect(alert.textContent).toMatch(/base do benefício/i);
    expect(h.saveDraft).not.toHaveBeenCalled();
  });

  it("meta do lado errado da direção é recusada na tela", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    fillValid();
    fill(/^Meta/, "50");
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/menor/i);
    expect(h.saveDraft).not.toHaveBeenCalled();
  });

  it("recusa do servidor aparece no editor, sem perder o que foi digitado", async () => {
    h.saveDraft.mockResolvedValue({
      ok: false,
      error: "Esta versão do caso de negócio não é mais editável.",
      code: "VERSION_IMMUTABLE",
    });
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "não é mais editável"
    );
    expect((screen.getByLabelText(/^Rótulo/) as HTMLInputElement).value).toBe(
      "Cycle time da triagem"
    );
  });

  it("adiciona e remove métricas", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    fireEvent.click(screen.getByRole("button", { name: /adicionar métrica/i }));
    expect(screen.getAllByLabelText(/^Rótulo/)).toHaveLength(2);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /remover métrica/i,
      })[1] as HTMLElement
    );
    expect(screen.getAllByLabelText(/^Rótulo/)).toHaveLength(1);
  });

  it("a última métrica não se remove: promessa vazia não se assina", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    expect(
      screen.getByRole("button", { name: /remover métrica/i })
    ).toHaveProperty("disabled", true);
  });

  it("carrega o que já foi salvo", async () => {
    h.getBusinessCase.mockResolvedValue({
      ok: true,
      data: draft({
        windowMonths: 12,
        cadence: "quarterly",
        benefitBasis: "Base salva",
        benefitAnnualCents: 123_456,
        metrics: [
          {
            key: "cycle",
            label: "Cycle salvo",
            unit: "h",
            baseValue: "48.0000",
            targetValue: "24.0000",
            direction: "DOWN",
            confidence: "MEASURED",
            sourceLabel: "s",
            sampleLabel: "a",
          },
        ],
      }),
    });
    render(<BaselineDetailScreen param={BC_ID} />);
    const label = (await screen.findByLabelText(/^Rótulo/)) as HTMLInputElement;
    expect(label.value).toBe("Cycle salvo");
    expect(
      (screen.getByLabelText(/^Linha de base/) as HTMLInputElement).value
    ).toBe("48");
    expect(
      (screen.getByLabelText(/^Janela de apuração/) as HTMLInputElement).value
    ).toBe("12");
    expect(
      (screen.getByLabelText(/^Benefício anual/) as HTMLInputElement).value
    ).toBe("1234,56");
  });

  it("depois de salvar, recarrega o caso para o envio à assinatura enxergar as métricas", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByLabelText(/^Rótulo/);
    fillValid();
    const before = h.getBusinessCase.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));
    await waitFor(() =>
      expect(h.getBusinessCase.mock.calls.length).toBeGreaterThan(before)
    );
  });
});
