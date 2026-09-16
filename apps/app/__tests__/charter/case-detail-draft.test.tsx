/** @vitest-environment jsdom */
// case-detail-draft.test.tsx — o rascunho ganha saída no detalhe do caso. Até
// aqui `DECIDABLE` (SUBMITTED/REVIEW/CHANGES) era o único status com botão no
// PageHeader: um rascunho salvo pelo intake não tinha como virar submissão.
// Agora DRAFT mostra "Submeter para revisão", que chama `submitDraftCase` com
// o id do caso; a action decide (sem `disabled` preventivo), e a recusa do
// gate chega em `res.error` — toast **e** Callout com o motivo e o link para
// ajustar o fornecedor. `sonner` é mockado (não `useActionToast`) para provar
// que o wrapper real chama `toast.error` com a mensagem do servidor, no
// padrão de `policy-scope.test.tsx`. Asserção sobre conteúdo, sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseDetail } from "@/app/(charter)/actions/cases";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

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

/** O tenant real: rascunho com fornecedor em REVIEW, sem classe máxima. */
function rascunho(over: Partial<UseCaseDetail> = {}): UseCaseDetail {
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
    status: "DRAFT",
    score: 6,
    riskLabel: "Moderado",
    riskTone: "amber",
    slaRemaining: null,
    slaTotal: null,
    objective: "Reduzir o tempo de triagem.",
    criticality: "MEDIUM",
    hitl: null,
    approvalPath: null,
    vendorId: "v-1",
    vendorCode: "V-001",
    vendorCategory: "LLM",
    vendorRegion: "EUA",
    vendorDpa: false,
    vendorRetention: null,
    vendorMaxClass: null,
    vendorIneligible: false,
    submittedAt: null,
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

const MOTIVO =
  "Fornecedor sem classe máxima de dado — postura contratual não permite nenhum uso.";

describe("CaseDetailScreen em rascunho", () => {
  beforeEach(() => {
    for (const m of [
      pushMock,
      getCaseMock,
      decideCaseMock,
      submitDraftCaseMock,
      listAuditForEntityMock,
      getSettingsMock,
      createMitigationMock,
      toastMocks.loading,
      toastMocks.success,
      toastMocks.error,
    ]) {
      m.mockReset();
    }
    toastMocks.loading.mockReturnValue("toast-1");
    getCaseMock.mockResolvedValue({ ok: true, data: rascunho() });
    listAuditForEntityMock.mockResolvedValue({ ok: true, data: [] });
    getSettingsMock.mockResolvedValue({
      ok: true,
      data: { members: [], roles: [], activeRole: "REQUESTER" },
    });
  });

  it("DRAFT mostra 'Submeter para revisão' e chama a action com o id do caso", async () => {
    submitDraftCaseMock.mockResolvedValue({
      ok: true,
      data: { code: "UC-003", path: "Segurança" },
    });
    render(<CaseDetailScreen param="UC-003" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Submeter para revisão/ })
    );

    await waitFor(() =>
      expect(submitDraftCaseMock).toHaveBeenCalledWith({ caseId: "uc-1" })
    );
    await waitFor(() =>
      expect(toastMocks.success).toHaveBeenCalledWith(
        expect.stringMatching(/Segurança/),
        expect.anything()
      )
    );
    // Recarrega o caso: o status mudou no servidor.
    await waitFor(() =>
      expect(getCaseMock.mock.calls.length).toBeGreaterThan(1)
    );
  });

  it("recusa do gate vira toast e Callout com link para ajustar o fornecedor", async () => {
    // Mock atrasado: o botão precisa continuar na tela enquanto a action roda,
    // e só depois da resposta o Callout aparece.
    let resolver: (v: unknown) => void = () => {
      // substituído abaixo
    };
    submitDraftCaseMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        })
    );
    render(<CaseDetailScreen param="UC-003" />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Submeter para revisão/ })
    );
    expect(screen.queryByText(MOTIVO)).toBeNull();

    resolver({ ok: false, error: MOTIVO });

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(MOTIVO, { id: "toast-1" })
    );
    expect(await screen.findByText(MOTIVO)).toBeTruthy();
    const link = screen.getByRole("link", {
      name: /Ajustar fornecedor OpenAI/,
    });
    expect(link.getAttribute("href")).toBe("/charter/vendor/V-001");
    // O botão continua disponível: a action decide, a tela mostra o motivo.
    expect(
      screen.getByRole("button", { name: /Submeter para revisão/ })
    ).toBeTruthy();
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("fora de rascunho o botão não existe", async () => {
    getCaseMock.mockResolvedValue({
      ok: true,
      data: rascunho({ status: "SUBMITTED", submittedAt: "2026-09-01" }),
    });
    render(<CaseDetailScreen param="UC-003" />);

    await screen.findByText("Triagem de sinistros");

    expect(
      screen.queryByRole("button", { name: /Submeter para revisão/ })
    ).toBeNull();
  });
});
