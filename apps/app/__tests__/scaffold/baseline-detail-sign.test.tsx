import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// As duas saídas de AWAITING. `signBusinessCase` e `contestBusinessCase`
// tinham zero chamadores fora de testes: o caso ia para assinatura e ficava
// lá — sem assinatura, SG-04 nunca deixava a ASSESS fechar.

const h = vi.hoisted(() => ({
  getBusinessCase: vi.fn(),
  signBusinessCase: vi.fn(),
  contestBusinessCase: vi.fn(),
  exportBusinessCase: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(scaffold)/actions/business-case", () => ({
  getBusinessCase: h.getBusinessCase,
  signBusinessCase: h.signBusinessCase,
  contestBusinessCase: h.contestBusinessCase,
  submitForSignature: vi.fn(),
  newVersionFromSigned: vi.fn(),
}));
vi.mock("@/app/(scaffold)/actions/export", () => ({
  exportBusinessCase: h.exportBusinessCase,
}));

import BaselineDetailScreen from "@/components/scaffold/screens/baseline-detail";

const BC_ID = "clx0000000000000000000bc1";
const VER_ID = "clx000000000000000000ver2";

function awaiting() {
  return {
    id: BC_ID,
    code: "BC-104",
    trackId: "trk1",
    trackCode: "TR-104",
    processName: "Triagem",
    state: "AWAITING",
    currentVersionId: VER_ID,
    signedVersionId: null,
    windowStart: null,
    windowMonths: 12,
    cadence: "monthly",
    benefitKind: "COST_AVOIDED",
    benefitHard: true,
    benefitAnnualCents: 12_000_000,
    benefitBasis: "Horas de analista",
    financeReviewedAt: null,
    signalInitiativeRef: null,
    metrics: [
      {
        key: "cycle",
        label: "Tempo de ciclo",
        unit: "h",
        baseValue: "48",
        targetValue: "24",
        direction: "DOWN",
        confidence: "MEASURED",
        sourceLabel: "ERP",
        sampleLabel: "90 dias",
      },
    ],
    versions: [
      {
        id: VER_ID,
        label: "v2",
        state: "AWAITING",
        note: "",
        authoredAt: new Date("2026-09-01"),
        signedAt: null,
        signedByLabel: null,
        contentHash: "abcd1234",
      },
    ],
    openContest: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getBusinessCase.mockResolvedValue({ ok: true, data: awaiting() });
  h.signBusinessCase.mockResolvedValue({ ok: true, data: undefined });
  h.contestBusinessCase.mockResolvedValue({ ok: true, data: undefined });
});

describe("caso de negócio — assinar", () => {
  it("leva o nome de quem assina e a versão vigente", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: /^assinar$/i }));

    const submit = screen.getByRole("button", { name: /assinar v2/i });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(/quem assina/i), {
      target: { value: "Marina Costa" },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(h.signBusinessCase).toHaveBeenCalledTimes(1));
    expect(h.signBusinessCase.mock.calls[0][0]).toEqual({
      businessCaseId: BC_ID,
      versionId: VER_ID,
      signedByLabel: "Marina Costa",
    });
  });
});

describe("caso de negócio — contestar", () => {
  it("exige objeção de verdade e manda os quatro campos", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: /contestar/i }));

    const submit = screen.getByRole("button", { name: /registrar objeção/i });
    fireEvent.change(screen.getByLabelText(/quem contesta/i), {
      target: { value: "Dr. Paulo" },
    });
    fireEvent.change(screen.getByLabelText(/papel/i), {
      target: { value: "Diretor médico" },
    });
    fireEvent.change(screen.getByLabelText(/^objeção/i), {
      target: { value: "curta" },
    });
    fireEvent.change(screen.getByLabelText(/o que precisa mudar/i), {
      target: { value: "Separar erro clínico de erro de transcrição." },
    });
    // Objeção de 5 caracteres não passa — silêncio com botão.
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(/^objeção/i), {
      target: {
        value:
          "A taxa de 12% mistura divergência de opinião clínica com erro de transcrição.",
      },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(h.contestBusinessCase).toHaveBeenCalledTimes(1));
    expect(h.contestBusinessCase.mock.calls[0][0]).toMatchObject({
      businessCaseId: BC_ID,
      versionId: VER_ID,
      byLabel: "Dr. Paulo",
      roleLabel: "Diretor médico",
      asks: "Separar erro clínico de erro de transcrição.",
    });
  });

  it("recusa do servidor fica no modal, não derruba a tela", async () => {
    h.signBusinessCase.mockResolvedValueOnce({
      ok: false,
      error: "Esta versão do caso de negócio não é mais editável.",
      code: "VERSION_IMMUTABLE",
    });
    render(<BaselineDetailScreen param={BC_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: /^assinar$/i }));
    fireEvent.change(screen.getByLabelText(/quem assina/i), {
      target: { value: "Marina Costa" },
    });
    fireEvent.click(screen.getByRole("button", { name: /assinar v2/i }));

    expect(await screen.findByText(/não é mais editável/i)).toBeDefined();
    // Modal continua aberto com o nome digitado.
    expect(
      (screen.getByLabelText(/quem assina/i) as HTMLInputElement).value
    ).toBe("Marina Costa");
  });
});

describe("caso de negócio — exportar contrato v2", () => {
  it("não oferece exportar sem assinatura", async () => {
    render(<BaselineDetailScreen param={BC_ID} />);
    await screen.findByText("Contrato com o Signal");
    expect(screen.queryByRole("button", { name: /exportar v2/i })).toBeNull();
  });

  it("assinado, pede o shape v2 e baixa o arquivo com o código do caso", async () => {
    const signed = { ...awaiting(), state: "SIGNED", signedVersionId: VER_ID };
    h.getBusinessCase.mockResolvedValue({ ok: true, data: signed });
    h.exportBusinessCase.mockResolvedValue({
      ok: true,
      data: { schema: "signal-baseline/v2", metrics: [] },
    });
    // jsdom não implementa createObjectURL; o que importa é o nome do arquivo.
    const createUrl = vi.fn(() => "blob:test");
    const revokeUrl = vi.fn();
    Object.assign(URL, {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(<BaselineDetailScreen param={BC_ID} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /exportar v2/i })
    );

    await waitFor(() => expect(h.exportBusinessCase).toHaveBeenCalledTimes(1));
    expect(h.exportBusinessCase.mock.calls[0][0]).toEqual({
      businessCaseId: BC_ID,
      shape: "v2",
    });
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("BC-104-signal-v2.json");
    expect(revokeUrl).toHaveBeenCalledWith("blob:test");
    click.mockRestore();
  });
});
