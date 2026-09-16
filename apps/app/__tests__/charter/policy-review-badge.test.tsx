/** @vitest-environment jsdom */
// policy-review-badge.test.tsx — política sem data de revisão não mostra
// "Revisão em — dias": um badge que carrega um traço no lugar do número é um
// fato sem valor ocupando a linha de meta. Sem `nextReview`, o badge some.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PolicyView } from "@/app/(charter)/actions/policy";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const pushMock = vi.hoisted(() => vi.fn());
const getPolicyMock = vi.hoisted(() => vi.fn());
const getOnboardingMock = vi.hoisted(() => vi.fn());
const getPolicyScopeMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicy: (...a: unknown[]) => getPolicyMock(...a),
  getPolicyScope: (...a: unknown[]) => getPolicyScopeMock(...a),
  editSection: vi.fn(),
  getVersionDiff: vi.fn(),
  publishPolicyVersion: vi.fn(),
  setSectionStatus: vi.fn(),
  linkPolicy: vi.fn(),
  unlinkPolicy: vi.fn(),
  saveGeneratedDraft: vi.fn(),
}));
vi.mock("@/app/(charter)/actions/policy-generate", () => ({
  generatePolicyDraft: vi.fn(),
}));
vi.mock("@/app/(charter)/actions/onboarding", () => ({
  getOnboarding: (...a: unknown[]) => getOnboardingMock(...a),
}));

import PolicyScreen from "../../components/charter/screens/policy";

function politica(over: Partial<PolicyView> = {}): PolicyView {
  return {
    id: "pol-1",
    name: "Política de Uso de IA",
    version: null,
    publishedAt: null,
    nextReview: null,
    daysToReview: null,
    scope: null,
    sections: [],
    versions: [],
    blockers: [],
    canPublish: false,
    can: { edit: true, publish: true },
    ...over,
  };
}

describe("PolicyScreen — badge de revisão", () => {
  beforeEach(() => {
    getPolicyMock.mockReset();
    getOnboardingMock.mockReset();
    getPolicyScopeMock.mockReset();
    getOnboardingMock.mockResolvedValue({ ok: true, data: null });
    getPolicyScopeMock.mockResolvedValue({ ok: true, data: null });
  });

  it("sem data de revisão, o badge 'Revisão em' não aparece", async () => {
    getPolicyMock.mockResolvedValue({ ok: true, data: politica() });
    render(<PolicyScreen />);

    expect(await screen.findByText("Política de Uso de IA")).toBeTruthy();
    expect(screen.queryByText(/Revisão em/)).toBeNull();
  });

  it("com data de revisão, o badge mostra os dias", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({ nextReview: "2027-01-01", daysToReview: 120 }),
    });
    render(<PolicyScreen />);

    expect(await screen.findByText("Revisão em 120 dias")).toBeTruthy();
  });
});
