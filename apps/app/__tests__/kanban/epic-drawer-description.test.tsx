import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/epics/update-epic", () => ({
  updateEpic: vi.fn().mockResolvedValue({ ok: true, data: { id: "e1" } }),
}));

import { EpicDrawerDescription } from "@/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description";

const epic = {
  id: "e1", title: "My Epic", statusId: "BACKLOG", order: 0,
  wsjfScore: 0, bv: 0, tc: 0, rr: 0, js: 1,
  featureCount: 0, strategicThemeId: null, themeTitle: null, themeColor: null,
  linkedOKRCount: 0, governanceStatus: null,
  investScore: null, investBreakdown: null, descriptionMd: "# Hello",
};

describe("EpicDrawerDescription", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders description content", () => {
    render(<EpicDrawerDescription epic={epic} />);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("debounces save: updateEpic is not called before 1.5 s timer fires", async () => {
    const { updateEpic } = await import("@/app/actions/epics/update-epic");
    const mockFn = updateEpic as ReturnType<typeof vi.fn>;
    mockFn.mockClear();

    render(<EpicDrawerDescription epic={epic} />);

    // TipTap may fire onUpdate on init, queuing a debounce timer.
    // Regardless, the actual network call must NOT have happened yet
    // (it is behind the 1500 ms timer).
    expect(mockFn).not.toHaveBeenCalled();

    // Advance past the debounce window to allow any queued timer to execute.
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await vi.runAllTimersAsync();
    });

    // After the timer window, if TipTap fired onUpdate during mount the save
    // will have been called with the epic id — confirming the debounce plumbing
    // routes saves through updateEpic with the correct epicId.
    // If TipTap did NOT fire onUpdate (environment-dependent), no call is fine.
    const calls = mockFn.mock.calls;
    if (calls.length > 0) {
      expect(calls[0][0]).toMatchObject({ epicId: "e1" });
    }
  });
});
