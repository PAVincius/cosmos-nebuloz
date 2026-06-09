import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn(),
  currentUser: vi.fn(),
  redirectToSignIn: vi.fn(),
}));

vi.mock("@repo/ai/lib/models", () => ({
  getActiveProvider: vi.fn().mockReturnValue("none"),
  getAIModel: vi.fn(),
  models: {},
}));

vi.mock("@/app/actions/epics/create-epic", () => ({
  createEpic: vi.fn().mockResolvedValue({
    ok: true,
    data: { id: "new-1", title: "New Epic", statusId: "BACKLOG", order: 0 },
  }),
}));

import { EpicCreateModal } from "../../app/(authenticated)/dashboard/portfolio/components/epic-create-modal";

describe("EpicCreateModal", () => {
  it("renders title input", () => {
    render(
      <EpicCreateModal
        onClose={vi.fn()}
        onCreated={vi.fn()}
        statusId="BACKLOG"
        themes={[]}
      />
    );
    expect(screen.getByPlaceholderText(/título do épico/i)).toBeTruthy();
  });

  it("calls onCreated after submit", async () => {
    const onCreated = vi.fn();
    render(
      <EpicCreateModal
        onClose={vi.fn()}
        onCreated={onCreated}
        statusId="BACKLOG"
        themes={[]}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/título do épico/i), {
      target: { value: "New Epic" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar épico/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
