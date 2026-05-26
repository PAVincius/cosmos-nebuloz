import { vi, describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/epics/create-epic", () => ({
  createEpic: vi.fn().mockResolvedValue({ ok: true, data: { id: "new-1", title: "New Epic", statusId: "BACKLOG", order: 0 } }),
}));

import { EpicCreateModal } from "../../app/(authenticated)/dashboard/portfolio/components/epic-create-modal";

describe("EpicCreateModal", () => {
  it("renders title input", () => {
    render(<EpicCreateModal statusId="BACKLOG" onClose={vi.fn()} onCreated={vi.fn()} themes={[]} />);
    expect(screen.getByPlaceholderText(/título do épico/i)).toBeTruthy();
  });

  it("calls onCreated after submit", async () => {
    const onCreated = vi.fn();
    render(<EpicCreateModal statusId="BACKLOG" onClose={vi.fn()} onCreated={onCreated} themes={[]} />);
    fireEvent.change(screen.getByPlaceholderText(/título do épico/i), { target: { value: "New Epic" } });
    fireEvent.click(screen.getByRole("button", { name: /criar épico/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
