/** @vitest-environment jsdom */
// permission-matrix.test.tsx — crítica de a11y (Sam, leitor de tela): a
// matriz de permissões marca cada célula com ícone check/slash + `title`, e
// significado só por ícone+cor não chega a quem usa leitor de tela (title
// não é lido de forma confiável, e cor nunca é). Cada célula precisa de nome
// acessível dizendo papel, permissão e se é permitido ou negado.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const getSettingsMock = vi.hoisted(() => vi.fn());
const setMemberCharterRoleMock = vi.hoisted(() => vi.fn());
const setNotificationTriggerMock = vi.hoisted(() => vi.fn());
const updateWorkspaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/settings", () => ({
  getSettings: (...a: unknown[]) => getSettingsMock(...a),
  setMemberCharterRole: (...a: unknown[]) => setMemberCharterRoleMock(...a),
  setNotificationTrigger: (...a: unknown[]) => setNotificationTriggerMock(...a),
  updateWorkspace: (...a: unknown[]) => updateWorkspaceMock(...a),
}));

import SettingsScreen from "../../components/charter/screens/settings";

function baseSettings() {
  return {
    ok: true as const,
    data: {
      workspace: {
        name: "Aurora Bank",
        slug: "aurora",
        industry: null,
        geo: null,
        posture: "MODERATE",
        employees: null,
        logRetentionDays: 365,
      },
      roles: [
        { id: "COMPLIANCE", label: "Compliance" },
        { id: "LEGAL", label: "Legal" },
        { id: "SECURITY", label: "Segurança" },
        { id: "HR", label: "People Ops" },
        { id: "REQUESTER", label: "Requester" },
        { id: "EXEC", label: "Executivo" },
        { id: "AUDITOR", label: "Auditor" },
      ],
      permissions: [
        {
          id: "case.decide",
          label: "Decidir caso de uso",
          grants: ["COMPLIANCE", "LEGAL", "SECURITY"],
        },
      ],
      activeRole: "COMPLIANCE",
      activeUserId: "cuser0000000000000000001",
      notifications: [],
      members: [],
      unassignedMembers: [],
    },
  };
}

describe("Matriz de permissões — nome acessível por célula", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    toastMocks.loading.mockReset();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    getSettingsMock.mockResolvedValue(baseSettings());
  });

  it("célula concedida anuncia papel, permissão e 'permitido'", async () => {
    render(<SettingsScreen />);
    fireEvent.click(await screen.findByText("Papéis e permissões"));
    await screen.findByText("Decidir caso de uso");

    const cells = screen.getAllByRole("cell");
    const concedida = cells.find((c) =>
      (c.getAttribute("aria-label") ?? "").includes(
        "Compliance: Decidir caso de uso"
      )
    );
    expect(concedida?.getAttribute("aria-label")).toBe(
      "Compliance: Decidir caso de uso — permitido"
    );
  });

  it("célula negada anuncia papel, permissão e 'negado'", async () => {
    render(<SettingsScreen />);
    fireEvent.click(await screen.findByText("Papéis e permissões"));
    await screen.findByText("Decidir caso de uso");

    const cells = screen.getAllByRole("cell");
    const negada = cells.find((c) =>
      (c.getAttribute("aria-label") ?? "").includes(
        "People Ops: Decidir caso de uso"
      )
    );
    expect(negada?.getAttribute("aria-label")).toBe(
      "People Ops: Decidir caso de uso — negado"
    );
  });
});
