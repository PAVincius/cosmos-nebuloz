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
    fireEvent.click(screen.getByRole("button", { name: "Membros" }));
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
});
