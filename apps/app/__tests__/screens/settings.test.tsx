// settings.test.tsx — tab-shell coverage: all 7 tabs render, switching tabs
// works, the Workspace and SAFe tabs show real data and gate their edit
// controls by the role the action layer returned (not a client-only guess),
// and not-yet-wired tabs render an honest placeholder rather than fake data.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getWorkspaceTabMock = vi.fn();
const updateWorkspaceInfoMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings", () => ({
  getWorkspaceTab: (...args: unknown[]) => getWorkspaceTabMock(...args),
  updateWorkspaceInfo: (...args: unknown[]) => updateWorkspaceInfoMock(...args),
}));

const getSafeConfigTabMock = vi.fn();
const saveArtCadenceActionMock = vi.fn();
const saveWsjfSettingsActionMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-safe", () => ({
  getSafeConfigTab: (...args: unknown[]) => getSafeConfigTabMock(...args),
  saveArtCadenceAction: (...args: unknown[]) =>
    saveArtCadenceActionMock(...args),
  saveWsjfSettingsAction: (...args: unknown[]) =>
    saveWsjfSettingsActionMock(...args),
}));

const getMembersTabMock = vi.fn();
const inviteMemberActionMock = vi.fn();
const updateMemberRoleActionMock = vi.fn();
const removeMemberActionMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-members", () => ({
  getMembersTab: (...args: unknown[]) => getMembersTabMock(...args),
  inviteMemberAction: (...args: unknown[]) => inviteMemberActionMock(...args),
  updateMemberRoleAction: (...args: unknown[]) =>
    updateMemberRoleActionMock(...args),
  removeMemberAction: (...args: unknown[]) => removeMemberActionMock(...args),
}));

const getAuditTabMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-audit", () => ({
  getAuditTab: (...args: unknown[]) => getAuditTabMock(...args),
}));

import SettingsScreen from "../../components/cosmos/screens/settings";

const WORKSPACE_DATA = {
  tenant: {
    id: "t1",
    name: "Acme",
    slug: "acme",
    logo: null,
    plan: "ORBIT",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  membersCount: 3,
  currentUserRole: "MEMBER",
};

const SAFE_DATA = {
  arts: [
    {
      id: "art-1",
      name: "ART Nebulosa",
      status: "ACTIVE",
      piCadenceWeeks: 10,
      sprintLengthWeeks: 2,
      ipSprintEnabled: true,
    },
  ],
  wsjf: null,
  currentUserRole: "MEMBER",
};

const MEMBERS_DATA = {
  members: [
    {
      userId: "u1",
      name: "Marina Alves",
      email: "marina@cosmos.local",
      image: null,
      role: "ADMIN",
    },
    {
      userId: "u2",
      name: "Bruno Silva",
      email: "bruno@cosmos.local",
      image: null,
      role: "PO",
    },
  ],
  currentUserRole: "MEMBER",
  currentUserId: "u2",
};

const AUDIT_DATA = {
  items: [
    {
      id: "log-1",
      actorName: "Marina Alves",
      action: "created",
      entityType: "Epic",
      entityId: "epic-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  page: 1,
  hasNext: false,
  hasPrev: false,
};

describe("SettingsScreen", () => {
  it("renders the tab shell with all 7 tabs and the Workspace tab active by default", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    render(<SettingsScreen />);

    expect(screen.getByText("Settings")).toBeTruthy();
    for (const label of [
      "Workspace",
      "Membros",
      "Segurança",
      "Auditoria",
      "Notificações",
      "SAFe",
      "Faturamento",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(await screen.findByText("Acme")).toBeTruthy();
  });

  it("renders Workspace fields read-only for a non-ADMIN role", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    render(<SettingsScreen />);

    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(screen.getByText("Somente leitura")).toBeTruthy();
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });

  it("shows editable fields and a save control for an ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" },
    });
    render(<SettingsScreen />);

    expect(await screen.findByText("Editável (ADMIN)")).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
  });

  it("switches to the SAFe tab and renders real ART cadence read-only for a non-privileged role", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getSafeConfigTabMock.mockResolvedValueOnce({ ok: true, data: SAFE_DATA });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "SAFe" }));

    expect(await screen.findByText("ART Nebulosa")).toBeTruthy();
    // MEMBER can't edit cadence — no numeric input, no "Salvar" button on the row.
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("shows honest placeholders (not fake data) for tabs not yet wired", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Segurança" }));
    expect(
      await screen.findByText(/ainda não wireada nesta versão/)
    ).toBeTruthy();
  });

  it("shows the error state when the workspace action fails", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({ ok: false, error: "boom" });
    render(<SettingsScreen />);

    expect(
      await screen.findByText("Não foi possível carregar os dados.")
    ).toBeTruthy();
  });

  it("switches to the Membros tab and shows the real member list without invite/remove controls for a non-ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getMembersTabMock.mockResolvedValueOnce({ ok: true, data: MEMBERS_DATA });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Membros" }));

    expect(await screen.findByText("Marina Alves")).toBeTruthy();
    expect(screen.getByText("Bruno Silva")).toBeTruthy();
    expect(screen.queryByText("Convidar")).toBeNull();
    expect(screen.queryByText("Remover")).toBeNull();
  });

  it("shows invite/remove controls on the Membros tab for an ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getMembersTabMock.mockResolvedValueOnce({
      ok: true,
      data: { ...MEMBERS_DATA, currentUserRole: "ADMIN", currentUserId: "u1" },
    });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Membros" }));

    expect(await screen.findByText("Convidar")).toBeTruthy();
    // Self (u1) has no Remover button; the other member does.
    expect(screen.getAllByText("Remover")).toHaveLength(1);
  });

  it("switches to the Auditoria tab and renders real, tenant-scoped log entries", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getAuditTabMock.mockResolvedValueOnce({ ok: true, data: AUDIT_DATA });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Auditoria" }));

    expect(await screen.findByText("Marina Alves")).toBeTruthy();
    expect(screen.getByText("created")).toBeTruthy();
    expect(screen.getByText(/Epic · epic-1/)).toBeTruthy();
    expect(screen.getByText("Exportar CSV")).toBeTruthy();
  });

  it("shows an honest empty state on the Auditoria tab with zero entries", async () => {
    getWorkspaceTabMock.mockResolvedValueOnce({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getAuditTabMock.mockResolvedValueOnce({
      ok: true,
      data: { items: [], page: 1, hasNext: false, hasPrev: false },
    });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Auditoria" }));

    expect(
      await screen.findByText("Nenhum evento de auditoria registrado ainda.")
    ).toBeTruthy();
    expect(screen.queryByText("Exportar CSV")).toBeNull();
  });
});
