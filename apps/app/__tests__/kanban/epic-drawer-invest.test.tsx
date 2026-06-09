import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/epics/analyze-invest", () => ({
  analyzeInvest: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      compositeScore: 72,
      breakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 },
      rationale: { I: "r", N: "r", V: "r", E: "r", S: "r", T: "r" },
      isSmall: true,
    },
  }),
}));

import { EpicDrawerInvest } from "../../app/(authenticated)/dashboard/portfolio/components/epic-drawer-invest";

const epic = {
  id: "e1",
  title: "Epic",
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
  investScore: 72,
  investBreakdown: { I: 80, N: 70, V: 75, E: 65, S: 60, T: 85 },
  descriptionMd: null,
};

describe("EpicDrawerInvest", () => {
  it("shows INVEST sub-tabs", () => {
    render(<EpicDrawerInvest epic={epic} />);
    expect(screen.getByRole("tab", { name: /invest/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /star/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /granularidade/i })).toBeTruthy();
  });

  it("shows composite score when available", () => {
    render(<EpicDrawerInvest epic={epic} />);
    expect(screen.getByText("72")).toBeTruthy();
  });

  it("shows footer warning when S (Small) < 50", () => {
    const smallEpic = {
      ...epic,
      investBreakdown: { I: 80, N: 70, V: 75, E: 65, S: 40, T: 85 },
      investScore: 69,
    };
    render(<EpicDrawerInvest epic={smallEpic} />);
    expect(screen.getByText(/task grande/i)).toBeTruthy();
  });
});
