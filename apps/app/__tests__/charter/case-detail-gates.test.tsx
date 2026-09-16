/** @vitest-environment jsdom */
// case-detail-gates.test.tsx — três defeitos independentes na tela de
// detalhe do caso:
//   1. "Registrar decisão" fingia desabilitar com `pointer-events:none`
//      (mesmo padrão de policy.tsx) — troca por GatedButton com motivo
//      visível, `disabled` de verdade.
//   2. O KPI "SLA restante" usava um tom fixo (amber para qualquer valor
//      > 2, nunca verde), divergindo de `slaTone()` em `lib/charter/rules.ts`.
//   3. A MetaCell "Revisor" mostrava `deciderRole` — o papel de quem
//      decidiu, não um revisor — rótulo e valor não batiam.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseDetail } from "@/app/(charter)/actions/cases";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const pushMock = vi.hoisted(() => vi.fn());
const getCaseMock = vi.hoisted(() => vi.fn());
const decideCaseMock = vi.hoisted(() => vi.fn());
const submitDraftCaseMock = vi.hoisted(() => vi.fn());
const listAuditForEntityMock = vi.hoisted(() => vi.fn());
const getSettingsMock = vi.hoisted(() => vi.fn());
const createMitigationMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/app/(charter)/actions/cases", () => ({
  getCase: (...a: unknown[]) => getCaseMock(...a),
  decideCase: (...a: unknown[]) => decideCaseMock(...a),
  submitDraftCase: (...a: unknown[]) => submitDraftCaseMock(...a),
}));
vi.mock("@/app/(charter)/actions/audit", () => ({
  listAuditForEntity: (...a: unknown[]) => listAuditForEntityMock(...a),
}));
vi.mock("@/app/(charter)/actions/settings", () => ({
  getSettings: (...a: unknown[]) => getSettingsMock(...a),
}));
vi.mock("@/app/(charter)/actions/risk", () => ({
  createMitigation: (...a: unknown[]) => createMitigationMock(...a),
}));

import CaseDetailScreen from "../../components/charter/screens/case-detail";

function caso(over: Partial<UseCaseDetail> = {}): UseCaseDetail {
  return {
    id: "uc-1",
    code: "UC-003",
    title: "Triagem de sinistros",
    department: "Operações",
    ownerName: "Bia",
    vendorName: "OpenAI",
    vendorTier: "REVIEW",
    exposure: "INTERNAL",
    dataClass: "INTERNAL",
    status: "SUBMITTED",
    score: 6,
    riskLabel: "Moderado",
    riskTone: "amber",
    slaRemaining: null,
    slaTotal: null,
    objective: "Reduzir o tempo de triagem.",
    criticality: "MEDIUM",
    hitl: null,
    approvalPath: "Segurança",
    vendorId: "v-1",
    vendorCode: "V-001",
    vendorCategory: "LLM",
    vendorRegion: "EUA",
    vendorDpa: false,
    vendorRetention: null,
    vendorMaxClass: null,
    vendorIneligible: false,
    submittedAt: "2026-09-01T00:00:00.000Z",
    severity: 3,
    likelihood: 2,
    risks: {},
    restrictions: [],
    blockReason: null,
    changeRequest: null,
    mitigations: [],
    decisions: [],
    can: { decide: false },
    ...over,
  };
}

describe("CaseDetailScreen — gates e leitura", () => {
  beforeEach(() => {
    for (const m of [
      pushMock,
      getCaseMock,
      decideCaseMock,
      submitDraftCaseMock,
      listAuditForEntityMock,
      getSettingsMock,
      createMitigationMock,
    ]) {
      m.mockReset();
    }
    listAuditForEntityMock.mockResolvedValue({ ok: true, data: [] });
    getSettingsMock.mockResolvedValue({
      ok: true,
      data: { members: [], roles: [], activeRole: "REQUESTER" },
    });
  });

  it("'Registrar decisão' sem permissão: botão desabilitado, motivo visível, clique não abre o modal", async () => {
    getCaseMock.mockResolvedValue({
      ok: true,
      data: caso({ can: { decide: false } }),
    });
    render(<CaseDetailScreen param="UC-003" />);

    const btn = await screen.findByRole("button", {
      name: /Registrar decisão/,
    });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Seu papel de governança não decide caso de uso")
    ).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByText(/Decisão · UC-003/)).toBeNull();
  });

  it("'Registrar decisão' com permissão: clique abre o modal de decisão", async () => {
    getCaseMock.mockResolvedValue({
      ok: true,
      data: caso({ can: { decide: true } }),
    });
    render(<CaseDetailScreen param="UC-003" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Registrar decisão/ })
    );
    expect(await screen.findByText(/Decisão · UC-003/)).toBeTruthy();
  });

  it("SLA folgado usa tom verde (slaTone), não o amber fixo de antes", async () => {
    getCaseMock.mockResolvedValue({
      ok: true,
      data: caso({ slaRemaining: 10, slaTotal: 15 }),
    });
    render(<CaseDetailScreen param="UC-003" />);

    await screen.findByText("Triagem de sinistros");
    // `KpiCard` grava o tom resolvido no id do gradiente do próprio SVG
    // decorativo (`cosmos_sig_<tone>_<icon>`) — é o único jeito de ler o tom
    // sem depender de computed style em jsdom.
    expect(document.getElementById("cosmos_sig_green_clock")).toBeTruthy();
    expect(document.getElementById("cosmos_sig_amber_clock")).toBeNull();
  });

  it("MetaCell mostra 'Decidido por', não 'Revisor', para o papel de quem decidiu", async () => {
    getCaseMock.mockResolvedValue({
      ok: true,
      data: caso({
        decisions: [
          {
            id: "d1",
            outcome: "APPROVED",
            rationale: "ok",
            conditions: [],
            deciderRole: "COMPLIANCE",
            createdAt: "2026-09-02T00:00:00.000Z",
          },
        ],
      }),
    });
    render(<CaseDetailScreen param="UC-003" />);

    await screen.findByText("Triagem de sinistros");
    expect(screen.getByText("Decidido por")).toBeTruthy();
    expect(screen.queryByText("Revisor")).toBeNull();
    expect(screen.getByText("COMPLIANCE")).toBeTruthy();
  });
});
