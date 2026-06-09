import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/epics/update-epic", () => ({
  updateEpic: vi.fn().mockResolvedValue({ ok: true, data: { id: "e1" } }),
}));

let capturedOnUpdate:
  | ((args: { editor: { getHTML: () => string } }) => void)
  | null = null;

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn((options) => {
    if (options?.onUpdate) {
      capturedOnUpdate = options.onUpdate;
    }
    return {
      getText: () => "Hello",
      getHTML: () => "<h1>Hello</h1>",
    };
  }),
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor">Editor</div>
  ),
}));

import { EpicDrawerDescription } from "@/app/(authenticated)/dashboard/portfolio/components/epic-drawer-description";

const epic = {
  id: "e1",
  title: "My Epic",
  statusId: "BACKLOG",
  order: 0,
  wsjfScore: 0,
  bv: 0,
  tc: 0,
  rr: 0,
  js: 1,
  featureCount: 0,
  strategicThemeId: null,
  themeTitle: null,
  themeColor: null,
  linkedOKRCount: 0,
  governanceStatus: null,
  investScore: null,
  investBreakdown: null,
  descriptionMd: "# Hello",
};

describe("EpicDrawerDescription", () => {
  beforeEach(() => {
    capturedOnUpdate = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders editor", () => {
    render(<EpicDrawerDescription epic={epic} />);
    expect(screen.getByTestId("editor")).toBeTruthy();
  });

  it("debounces save: calls updateEpic after 1.5s", async () => {
    const { updateEpic } = await import("@/app/actions/epics/update-epic");
    const mockFn = updateEpic as ReturnType<typeof vi.fn>;
    mockFn.mockClear();

    render(<EpicDrawerDescription epic={epic} />);

    // Trigger onUpdate via the captured callback
    expect(capturedOnUpdate).not.toBeNull();
    act(() => {
      capturedOnUpdate!({ editor: { getHTML: () => "<p>Updated</p>" } });
    });

    // Before timer fires — not yet saved
    expect(mockFn).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
    });

    // Now saved
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn.mock.calls[0][0]).toMatchObject({ epicId: "e1" });
  });
});
