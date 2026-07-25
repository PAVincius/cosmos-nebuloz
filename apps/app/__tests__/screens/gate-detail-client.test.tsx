// gate-detail-client.test.tsx — regression coverage for 2c: resubmission
// after a terminal rejection. reviewStep() never clears
// GovernedEpic.currentApprovalRequestId on rejection (only cancelApprovalRequest
// does), so gating "Enviar para aprovação" on the pointer's mere existence
// would leave the button permanently hidden after any rejection even though
// submitEpicForApproval only blocks duplicates while a request is open/in_review.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
      estado: "rejected",
      initiatorId: "u1",
      governedEpicId: "ge-1",
      epicTitle: "Real Epic",
      steps: [
        {
          id: "step-1",
          etapaOrdem: 0,
          roleRequired: "lpm",
          approverId: "u2",
          estado: "rejected",
          comentario: "Não alinhado",
          timestamp: new Date(),
          slaDeadline: null,
          slaStatus: "ON_TRACK",
        },
        {
          id: "step-2",
          etapaOrdem: 1,
          roleRequired: "finance",
          approverId: null,
          estado: "skipped",
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
  reviewStep: vi.fn(),
  submitEpicForApproval: vi.fn(),
}));

import GateDetailClient from "../../components/cosmos/screens/gate-detail-client";

const REJECTED_INITIAL = {
  id: "ge-1",
  epicId: "epic-1",
  epicTitle: "Real Epic",
  epicLifecycleStatus: "ANALYZING",
  governanceStatus: "rejected",
  investmentEstimate: 100_000,
  valueStreamId: null,
  themeId: null,
  guardrailFlags: [],
  // Not cleared by reviewStep() on rejection — this is the crux of 2c.
  currentApprovalRequestId: "req-1",
  submittedAt: null,
} as const;

describe("GateDetailClient — resubmission after rejection (2c)", () => {
  it("still offers 'Enviar para aprovação' when the request is terminally rejected", async () => {
    render(
      <GateDetailClient epicId="epic-1" initial={REJECTED_INITIAL as never} />
    );

    expect(await screen.findByText("Enviar para aprovação")).toBeTruthy();
  });

  it("does not offer resubmission while a request is genuinely still open/in_review", () => {
    render(
      <GateDetailClient
        epicId="epic-1"
        initial={
          {
            ...REJECTED_INITIAL,
            governanceStatus: "review",
          } as never
        }
      />
    );

    expect(screen.queryByText("Enviar para aprovação")).toBeNull();
  });
});
