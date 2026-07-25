// settings-members-tab.test.tsx — regression coverage for the real id
// contract (HIGH fix): updateMemberRoleAction/removeMemberAction must be
// called with the TenantMember.id (membership row id) the server actions
// look up by (`where: { id: memberId, tenantId }`), never with the
// User.id. Before the fix the component passed `member.userId`, so every
// role change / removal returned NOT_FOUND server-side — this test fails
// against that code because it asserts the mocked action receives the
// membership id, not the user id.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn().mockReturnValue("toast-1"),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const actionMocks = vi.hoisted(() => ({
  getMembersTab: vi.fn(),
  inviteMemberAction: vi.fn(),
  updateMemberRoleAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));
vi.mock("@/app/(cosmos)/actions/settings-members", () => ({
  getMembersTab: actionMocks.getMembersTab,
  inviteMemberAction: actionMocks.inviteMemberAction,
  updateMemberRoleAction: actionMocks.updateMemberRoleAction,
  removeMemberAction: actionMocks.removeMemberAction,
}));

import { ModalProvider } from "../../components/cosmos/modal";
import SettingsMembersTab from "../../components/cosmos/screens/settings-members-tab";

// Membership id ("mem-123") deliberately differs from the user id
// ("user-1") — if the component ever regresses to sending userId, the
// assertions below catch it.
const MEMBERS_DATA = {
  members: [
    {
      id: "mem-123",
      userId: "user-1",
      name: "Ana Costa",
      email: "ana@cosmos.local",
      image: null,
      role: "MEMBER",
    },
  ],
  currentUserRole: "ADMIN",
  currentUserId: "admin-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  actionMocks.getMembersTab.mockResolvedValue({ ok: true, data: MEMBERS_DATA });
  actionMocks.updateMemberRoleAction.mockResolvedValue({
    ok: true,
    data: { updated: true },
  });
  actionMocks.removeMemberAction.mockResolvedValue({
    ok: true,
    data: { removed: true },
  });
});

function renderTab() {
  return render(
    <ModalProvider>
      <SettingsMembersTab />
    </ModalProvider>
  );
}

describe("SettingsMembersTab — real id contract", () => {
  it("sends the TenantMember.id (not userId) when changing a role", async () => {
    renderTab();

    const select = await screen.findByDisplayValue("Membro");
    fireEvent.change(select, { target: { value: "ADMIN" } });

    await waitFor(() =>
      expect(actionMocks.updateMemberRoleAction).toHaveBeenCalled()
    );
    expect(actionMocks.updateMemberRoleAction).toHaveBeenCalledWith(
      "mem-123",
      "ADMIN"
    );
    expect(actionMocks.updateMemberRoleAction).not.toHaveBeenCalledWith(
      "user-1",
      "ADMIN"
    );
  });

  it("sends the TenantMember.id (not userId) when removing a member", async () => {
    renderTab();

    await screen.findByText("Ana Costa");
    const rowRemoveButton = screen.getByRole("button", { name: "Remover" });
    fireEvent.click(rowRemoveButton);

    // Modal confirmation button — a second "Remover" appears once open.
    const confirmButtons = await screen.findAllByRole("button", {
      name: "Remover",
    });
    fireEvent.click(confirmButtons.at(-1) as HTMLElement);

    await waitFor(() =>
      expect(actionMocks.removeMemberAction).toHaveBeenCalled()
    );
    expect(actionMocks.removeMemberAction).toHaveBeenCalledWith("mem-123");
    expect(actionMocks.removeMemberAction).not.toHaveBeenCalledWith("user-1");
  });
});
