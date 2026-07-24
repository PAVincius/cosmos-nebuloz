// governance-gate-review.test.tsx — regression coverage for the modal-closes-
// on-failure defect (final whole-branch review, Group 1). GateReviewModal
// used to call close() unconditionally after reviewStep() settled, which
// discarded a required reject rationale the instant the server action
// failed. It must now stay open — and keep the typed rationale — until
// reviewStep() actually succeeds.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const reviewStepMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/governance", () => ({
  listGovernedEpics: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      epics: [
        {
          id: "ge-1",
          epicId: "epic-1",
          epicTitle: "Real Epic",
          governanceStatus: "review",
          investmentEstimate: 100_000,
          submittedAt: null,
          currentApprovalRequestId: "req-1",
          gateSteps: [
            { etapaOrdem: 0, roleRequired: "lpm", estado: "pending" },
          ],
        },
      ],
      kpis: {
        totalUnderGovernance: 1,
        awaitingDecision: 1,
        investmentInReview: 100_000,
      },
    },
  }),
  upsertApprovalWorkflow: vi.fn(),
}));

vi.mock("@/app/actions/governance", () => ({
  getApprovalRequest: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: "req-1",
      tenantId: "t1",
      workflowId: "wf-1",
      workflowNome: "Aprovação de Épico de Portfólio",
      targetType: "epic",
      targetId: "epic-1",
      estado: "review",
      initiatorId: "u1",
      governedEpicId: "ge-1",
      epicTitle: "Real Epic",
      steps: [
        {
          id: "step-1",
          etapaOrdem: 0,
          roleRequired: "lpm",
          approverId: null,
          estado: "pending",
          comentario: null,
          timestamp: null,
          slaDeadline: null,
          slaStatus: "ON_TRACK",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }),
  reviewStep: (...args: unknown[]) => reviewStepMock(...args),
}));

import GovernanceScreen from "../../components/cosmos/screens/governance";

describe("GateReviewModal — stays open and keeps the rationale on failure", () => {
  it("does not discard the reject rationale when reviewStep() fails", async () => {
    reviewStepMock.mockResolvedValueOnce({
      ok: false,
      error: "Falha ao registrar a decisão.",
    });

    render(<GovernanceScreen />);

    const reviewButton = await screen.findByText("Revisar gate");
    fireEvent.click(reviewButton);

    await screen.findByText("Confirmar decisão");
    fireEvent.click(screen.getByText("Rejeitar"));

    const rationale = "Escopo não alinhado com o roadmap do trimestre.";
    fireEvent.change(screen.getByPlaceholderText("Racional da decisão…"), {
      target: { value: rationale },
    });

    fireEvent.click(screen.getByText("Confirmar decisão"));

    await waitFor(() => expect(reviewStepMock).toHaveBeenCalledTimes(1));

    // Modal must still be open, with the typed rationale preserved.
    expect(screen.getByText("Confirmar decisão")).toBeTruthy();
    expect(screen.getByPlaceholderText("Racional da decisão…")).toHaveProperty(
      "value",
      rationale
    );
  });
});
