/** @vitest-environment jsdom */
// case-detail-risk.test.tsx — o detalhe do caso para de mostrar "1 · Baixo"
// para risco que ninguém avaliou, e ganha a entrada da tela de reavaliação.
// Antes, `rescoreCase` existia e nada o chamava (PRD FR-5).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseDetail } from "@/app/(charter)/actions/cases";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const pushMock = vi.hoisted(() => vi.fn());
const getCaseMock = vi.hoisted(() => vi.fn());
const rescoreCaseMock = vi.hoisted(() => vi.fn());
const listAuditForEntityMock = vi.hoisted(() => vi.fn());
const getSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/app/(charter)/actions/cases", () => ({
  getCase: (...a: unknown[]) => getCaseMock(...a),
  rescoreCase: (...a: unknown[]) => rescoreCaseMock(...a),
  decideCase: vi.fn(),
  submitDraftCase: vi.fn(),
}));
vi.mock("@/app/(charter)/actions/audit", () => ({
  listAuditForEntity: (...a: unknown[]) => listAuditForEntityMock(...a),
}));
vi.mock("@/app/(charter)/actions/settings", () => ({
  getSettings: (...a: unknown[]) => getSettingsMock(...a),
}));
vi.mock("@/app/(charter)/actions/risk", () => ({
  createMitigation: vi.fn(),
}));

import CaseDetailScreen from "../../components/charter/screens/case-detail";

const MOTIVO =
  "Requer papel Compliance ou Segurança — Pontuar risco e criar mitigação";

const flat = (n: number) => ({
  privacy: n,
  regulatory: n,
  security: n,
  bias: n,
  ip: n,
  operational: n,
  reputational: n,
});

function semPontuacao(over: Partial<UseCaseDetail> = {}): UseCaseDetail {
  return {
    id: "uc-1",
    code: "UC-003",
    title: "Triagem de sinistros",
    department: "Operações",
    ownerName: "Bia",
    vendorName: null,
    vendorTier: null,
    exposure: "INTERNAL",
    dataClass: "INTERNAL",
    status: "SUBMITTED",
    score: null,
    riskLabel: "sem pontuação",
    riskTone: "accent",
    slaRemaining: null,
    slaTotal: null,
    objective: "Reduzir o tempo de triagem.",
    criticality: "MEDIUM",
    hitl: null,
    approvalPath: "Segurança",
    vendorId: null,
    vendorCode: null,
    vendorCategory: null,
    vendorRegion: null,
    vendorDpa: null,
    vendorRetention: null,
    vendorMaxClass: null,
    vendorIneligible: false,
    submittedAt: "2026-09-22T00:00:00.000Z",
    severity: null,
    likelihood: null,
    risks: null,
    restrictions: [],
    blockReason: null,
    changeRequest: null,
    mitigations: [],
    decisions: [],
    can: { decide: false, score: true },
    scoreDenial: MOTIVO,
    ...over,
  };
}

const pontuado = (over: Partial<UseCaseDetail> = {}) =>
  semPontuacao({
    score: 3,
    riskLabel: "Baixo",
    riskTone: "green",
    severity: 3,
    likelihood: 1,
    risks: { ...flat(1), privacy: 3 },
    ...over,
  });

async function abrirAbaRisco() {
  await screen.findByText("Triagem de sinistros");
  fireEvent.click(screen.getByRole("button", { name: "Risco" }));
}

describe("CaseDetailScreen — risco", () => {
  beforeEach(() => {
    for (const m of [
      pushMock,
      getCaseMock,
      rescoreCaseMock,
      listAuditForEntityMock,
      getSettingsMock,
    ]) {
      m.mockReset();
    }
    listAuditForEntityMock.mockResolvedValue({ ok: true, data: [] });
    getSettingsMock.mockResolvedValue({
      ok: true,
      data: {
        members: [{ name: "Diego Prado", role: "SECURITY" }],
        roles: [{ id: "SECURITY", label: "Segurança" }],
        activeRole: "SECURITY",
      },
    });
  });

  it("caso sem pontuação: selo e KPI dizem 'sem pontuação', nunca '1 · Baixo'", async () => {
    getCaseMock.mockResolvedValue({ ok: true, data: semPontuacao() });
    render(<CaseDetailScreen param="UC-003" />);

    await screen.findByText("Triagem de sinistros");
    expect(screen.getByText("Risco sem pontuação")).toBeTruthy();
    expect(screen.queryByText(/Baixo/)).toBeNull();
  });

  it("aba Risco sem pontuação explica o default e abre a tela de pontuação", async () => {
    getCaseMock.mockResolvedValue({ ok: true, data: semPontuacao() });
    render(<CaseDetailScreen param="UC-003" />);
    await abrirAbaRisco();

    expect(screen.getByText(/padrão não é medição/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Pontuar risco/ }));

    expect(await screen.findByText("Pontuar risco · UC-003")).toBeTruthy();
  });

  it("sem o papel: 'Pontuar risco' desabilitado com o motivo nominal escrito", async () => {
    getCaseMock.mockResolvedValue({
      ok: true,
      data: semPontuacao({ can: { decide: false, score: false } }),
    });
    render(<CaseDetailScreen param="UC-003" />);
    await abrirAbaRisco();

    const botao = screen.getByRole("button", {
      name: /Pontuar risco/,
    }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(screen.getByText(MOTIVO)).toBeTruthy();
    fireEvent.click(botao);
    expect(screen.queryByText("Pontuar risco · UC-003")).toBeNull();
  });

  it("caso pontuado: reavaliar grava pela action e recarrega o caso", async () => {
    getCaseMock.mockResolvedValue({ ok: true, data: pontuado() });
    rescoreCaseMock.mockResolvedValue({
      ok: true,
      data: { score: 5, label: "Moderado" },
    });
    render(<CaseDetailScreen param="UC-003" />);
    await abrirAbaRisco();

    fireEvent.click(screen.getByRole("button", { name: /Reavaliar risco/ }));
    const modal = within(await screen.findByRole("dialog"));
    fireEvent.click(
      within(modal.getByRole("group", { name: "Privacidade" })).getByRole(
        "button",
        { name: "5" }
      )
    );
    fireEvent.change(modal.getByRole("textbox"), {
      target: { value: "Fornecedor passou a reter prompts por 30 dias." },
    });
    fireEvent.click(
      modal.getByRole("button", { name: /Registrar reavaliação/ })
    );

    await vi.waitFor(() =>
      expect(rescoreCaseMock).toHaveBeenCalledWith({
        code: "UC-003",
        risks: { ...flat(1), privacy: 5 },
        note: "Fornecedor passou a reter prompts por 30 dias.",
      })
    );
    await vi.waitFor(() => expect(getCaseMock).toHaveBeenCalledTimes(2));
  });
});
