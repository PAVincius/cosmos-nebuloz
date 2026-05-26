import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

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
  it("renders description content", () => {
    render(<EpicDrawerDescription epic={epic} />);
    expect(screen.getByText("Hello")).toBeTruthy();
  });
});
