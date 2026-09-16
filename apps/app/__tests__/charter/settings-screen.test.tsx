/** @vitest-environment jsdom */
// settings-screen.test.tsx — troca de papel de governança exige confirmação
// (crítica de design: um clique errado no Select revogava papel de alguém
// sem aviso). Molde de policy-scope.test.tsx: sonner mockado, actions
// hoisted, asserção sobre conteúdo renderizado. `setMemberCharterRole` NÃO
// pode ser chamada pelo onChange direto — só pela confirmação do modal.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const COMPLIANCE_ID = "cuser0000000000000000001";
const LEGAL_ID = "cuser0000000000000000002";

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
        {
          id: "vendor.approve",
          label: "Aprovar fornecedor / mudar tier",
          grants: ["COMPLIANCE", "SECURITY"],
        },
        {
          id: "policy.edit",
          label: "Editar política",
          grants: ["COMPLIANCE", "LEGAL"],
        },
      ],
      activeRole: "COMPLIANCE",
      activeUserId: COMPLIANCE_ID,
      notifications: [],
      members: [
        {
          userId: COMPLIANCE_ID,
          name: "Bia",
          email: "bia@x.com",
          role: "COMPLIANCE",
        },
        {
          userId: LEGAL_ID,
          name: "Caio",
          email: "caio@x.com",
          role: "SECURITY",
        },
      ],
      unassignedMembers: [],
    },
  };
}

describe("SettingsScreen — troca de papel de governança", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    setMemberCharterRoleMock.mockReset();
    setNotificationTriggerMock.mockReset();
    updateWorkspaceMock.mockReset();
    toastMocks.loading.mockReset();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    toastMocks.loading.mockReturnValue("toast-1");
    getSettingsMock.mockResolvedValue(baseSettings());
  });

  async function renderNaAbaPermissoes() {
    render(<SettingsScreen />);
    fireEvent.click(await screen.findByText("Papéis e permissões"));
    await screen.findByLabelText("Papel de Caio");
  }

  it("mudar o Select não chama setMemberCharterRole antes de confirmar", async () => {
    await renderNaAbaPermissoes();

    fireEvent.change(screen.getByLabelText("Papel de Caio"), {
      target: { value: "LEGAL" },
    });

    expect(await screen.findByText("Trocar papel de Caio?")).toBeTruthy();
    expect(setMemberCharterRoleMock).not.toHaveBeenCalled();
  });

  it("confirmar chama setMemberCharterRole com userId e role exatos", async () => {
    setMemberCharterRoleMock.mockResolvedValue({ ok: true, data: null });
    await renderNaAbaPermissoes();

    fireEvent.change(screen.getByLabelText("Papel de Caio"), {
      target: { value: "LEGAL" },
    });
    await screen.findByText("Trocar papel de Caio?");
    fireEvent.click(screen.getByText("Trocar papel"));

    await waitFor(() =>
      expect(setMemberCharterRoleMock).toHaveBeenCalledWith({
        userId: LEGAL_ID,
        role: "LEGAL",
      })
    );
  });

  it("cancelar não chama a action e o Select volta ao valor anterior", async () => {
    await renderNaAbaPermissoes();

    const select = screen.getByLabelText("Papel de Caio") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "LEGAL" } });
    await screen.findByText("Trocar papel de Caio?");

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() =>
      expect(screen.queryByText("Trocar papel de Caio?")).toBeNull()
    );
    expect(setMemberCharterRoleMock).not.toHaveBeenCalled();
    expect(select.value).toBe("SECURITY");
  });

  it("erro do servidor mostra toast com res.error e o Select volta ao valor anterior", async () => {
    setMemberCharterRoleMock.mockResolvedValue({
      ok: false,
      error: "Esta é a última pessoa com papel Compliance.",
    });
    await renderNaAbaPermissoes();

    const select = screen.getByLabelText("Papel de Caio") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "LEGAL" } });
    await screen.findByText("Trocar papel de Caio?");
    fireEvent.click(screen.getByText("Trocar papel"));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Esta é a última pessoa com papel Compliance.",
        { id: "toast-1" }
      )
    );
    expect(select.value).toBe("SECURITY");
  });

  it("rebaixar o próprio papel mostra aviso explícito no modal", async () => {
    await renderNaAbaPermissoes();

    fireEvent.change(screen.getByLabelText("Papel de Bia"), {
      target: { value: "LEGAL" },
    });

    expect(await screen.findByText("Trocar papel de Bia?")).toBeTruthy();
    expect(
      screen.getByText("Você está alterando o seu próprio papel de governança.")
    ).toBeTruthy();
  });

  it("mostra a consequência derivada da matriz de permissões (perde acesso)", async () => {
    await renderNaAbaPermissoes();

    // Caio é SECURITY (case.decide, vendor.approve); vira HR (nenhuma das
    // duas) — perde as duas.
    fireEvent.change(screen.getByLabelText("Papel de Caio"), {
      target: { value: "HR" },
    });

    await screen.findByText("Trocar papel de Caio?");
    expect(
      screen.getByText(
        "Perde acesso a: Decidir caso de uso, Aprovar fornecedor / mudar tier."
      )
    ).toBeTruthy();
  });
});
