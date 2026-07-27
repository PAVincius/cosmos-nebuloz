import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const h = vi.hoisted(() => ({
  listStoryTasksMock: vi.fn(),
  createNativeTaskMock: vi.fn(),
}));

vi.mock("../../app/(cosmos)/actions/epic-tree", () => ({
  listStoryTasks: h.listStoryTasksMock,
  createNativeTask: h.createNativeTaskMock,
  updateNativeTask: vi.fn(),
}));

import type { StoryNode } from "../../app/(cosmos)/actions/epic-tree.constants";
import { NavCtx } from "../../components/cosmos/kit";
import { ModalProvider } from "../../components/cosmos/modal";
import { StoryRow } from "../../components/cosmos/screens/epic-tree/story-row";

const story: StoryNode = {
  id: "story-1",
  title: "Login com SSO",
  acceptanceCriteria: "Usuário autentica via SAML",
  status: "IN_PROGRESS",
  storyPoints: 5,
};

function renderRow() {
  return render(
    <NavCtx.Provider value={{ navigate: vi.fn(), isComingSoon: () => false }}>
      <ModalProvider>
        <StoryRow story={story} />
      </ModalProvider>
    </NavCtx.Provider>
  );
}

describe("StoryRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.listStoryTasksMock.mockResolvedValue({
      ok: true,
      data: { tasks: [], connectedSources: [] },
    });
  });

  test("always shows the acceptance criteria — it is what makes it a story", () => {
    renderRow();
    expect(screen.getByText(/AC: Usuário autentica via SAML/)).toBeTruthy();
  });

  test("does not fetch tasks until the row is expanded", () => {
    renderRow();
    expect(h.listStoryTasksMock).not.toHaveBeenCalled();
  });

  test("fetches tasks on expand and reports the expanded state", async () => {
    renderRow();
    const row = screen.getByRole("button", { name: /Login com SSO/ });
    expect(row.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(row);

    await waitFor(() =>
      expect(h.listStoryTasksMock).toHaveBeenCalledWith("story-1")
    );
    expect(row.getAttribute("aria-expanded")).toBe("true");
  });

  test("expands with the keyboard", async () => {
    renderRow();
    const row = screen.getByRole("button", { name: /Login com SSO/ });

    fireEvent.keyDown(row, { key: "Enter" });

    await waitFor(() =>
      expect(h.listStoryTasksMock).toHaveBeenCalledWith("story-1")
    );
  });

  test("keeps the row expanded and offers a retry when the fetch fails", async () => {
    h.listStoryTasksMock.mockResolvedValue({ ok: false, error: "boom" });
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: /Login com SSO/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Tentar novamente/ })
      ).toBeTruthy()
    );
  });

  test("offers the native-task CTA when the story has no tasks", async () => {
    renderRow();
    fireEvent.click(screen.getByRole("button", { name: /Login com SSO/ }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Nova task nativa/ })
      ).toBeTruthy()
    );
  });
});
