import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock dnd-kit to avoid needing a DndContext provider
vi.mock("@dnd-kit/core", () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: (_el: unknown) => {},
    setActivatorNodeRef: (_el: unknown) => {},
    transform: null,
    isDragging: false,
  }),
}));

// Mock cn utility
vi.mock("@repo/design-system/lib/utils", () => ({
  cn: (...args: unknown[]) =>
    args
      .flat()
      .filter((x) => typeof x === "string" && x)
      .join(" "),
}));

import { DEFAULT_CARD_CFG } from "@/app/(authenticated)/dashboard/portfolio/components/card-config-panel";
import {
  investColor,
  investLabel,
  KanbanCard,
} from "@/app/(authenticated)/dashboard/portfolio/components/kanban-card";
import type { PortfolioEpic } from "@/app/actions/epics/get-portfolio";

// Always-revealed cfg for tests that assert visible INVEST/BLOCKED elements
const REVEAL_CFG = { ...DEFAULT_CARD_CFG, hoverReveal: false };

// Top-level regex constants (Biome: useTopLevelRegex)
const RE_BLOCKED = /BLOCKED/;
const RE_OKR_2 = /2 OKRs/;
const RE_5_FEATURES = /5 features/;
const RE_1_FEATURE = /1 feature/;

// ── Pure unit tests ───────────────────────────────────────────────────────────

describe("investColor", () => {
  it("returns muted classes for null score", () => {
    expect(investColor(null)).toContain("bg-muted");
  });

  it("returns green classes for score >= 70", () => {
    expect(investColor(70)).toContain("bg-green-50");
    expect(investColor(100)).toContain("bg-green-50");
  });

  it("returns yellow classes for score >= 50 and < 70", () => {
    expect(investColor(50)).toContain("bg-yellow-50");
    expect(investColor(69)).toContain("bg-yellow-50");
  });

  it("returns red classes for score < 50", () => {
    expect(investColor(0)).toContain("bg-red-50");
    expect(investColor(49)).toContain("bg-red-50");
  });
});

describe("investLabel", () => {
  it("returns INVEST? for null", () => {
    expect(investLabel(null)).toBe("INVEST?");
  });

  it("returns rounded score label", () => {
    expect(investLabel(72.6)).toBe("INVEST 73");
    expect(investLabel(50)).toBe("INVEST 50");
  });
});

// ── Component tests ───────────────────────────────────────────────────────────

afterEach(() => cleanup());

function makeEpic(overrides: Partial<PortfolioEpic> = {}): PortfolioEpic {
  return {
    id: "epic-1",
    title: "My Epic Title",
    statusId: "status-1",
    lifecycleStatus: "active",
    order: 0,
    wsjfScore: 4.5,
    bv: 8,
    tc: 5,
    rr: 3,
    js: 2,
    featureCount: 3,
    completedFeatureCount: 0,
    topFeatures: [],
    strategicThemeId: null,
    themeTitle: null,
    themeColor: null,
    linkedOKRCount: 0,
    governanceStatus: null,
    investScore: null,
    investBreakdown: null,
    descriptionMd: null,
    epicType: "EPIC",
    dueDate: null,
    ...overrides,
  };
}

describe("KanbanCard component", () => {
  it("renders the epic title", () => {
    render(<KanbanCard epic={makeEpic()} />);
    expect(screen.getByText("My Epic Title")).toBeDefined();
  });

  it("shows no progress bar when score is null", () => {
    render(<KanbanCard epic={makeEpic({ investScore: null })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows green-fill INVEST bar for score >= 70", () => {
    render(
      <KanbanCard cfg={REVEAL_CFG} epic={makeEpic({ investScore: 75 })} />
    );
    const bar = screen.getByRole("progressbar", { name: "INVEST 75" });
    const fill = bar.querySelector(
      '[data-testid="invest-bar-fill"]'
    ) as HTMLElement;
    expect(fill.className).toContain("bg-green-500");
  });

  it("shows yellow-fill INVEST bar for score between 50 and 69", () => {
    render(
      <KanbanCard cfg={REVEAL_CFG} epic={makeEpic({ investScore: 55 })} />
    );
    const bar = screen.getByRole("progressbar", { name: "INVEST 55" });
    const fill = bar.querySelector(
      '[data-testid="invest-bar-fill"]'
    ) as HTMLElement;
    expect(fill.className).toContain("bg-yellow-500");
  });

  it("shows red-fill INVEST bar for score < 50", () => {
    render(
      <KanbanCard cfg={REVEAL_CFG} epic={makeEpic({ investScore: 30 })} />
    );
    const bar = screen.getByRole("progressbar", { name: "INVEST 30" });
    const fill = bar.querySelector(
      '[data-testid="invest-bar-fill"]'
    ) as HTMLElement;
    expect(fill.className).toContain("bg-red-500");
  });

  it("calls onOpenDrawer with epic id when title is clicked", () => {
    const onOpenDrawer = vi.fn();
    render(<KanbanCard epic={makeEpic()} onOpenDrawer={onOpenDrawer} />);
    fireEvent.click(screen.getByText("My Epic Title"));
    expect(onOpenDrawer).toHaveBeenCalledWith("epic-1");
  });

  it("shows BLOCKED warning when governanceStatus is BLOCKED", () => {
    render(
      <KanbanCard
        cfg={REVEAL_CFG}
        epic={makeEpic({ governanceStatus: "BLOCKED" })}
      />
    );
    expect(screen.getByText(RE_BLOCKED)).toBeDefined();
  });

  it("shows OKR indicator when linkedOKRCount > 0", () => {
    render(<KanbanCard epic={makeEpic({ linkedOKRCount: 2 })} />);
    expect(screen.getByText(RE_OKR_2)).toBeDefined();
  });

  it("renders theme color bar when themeColor is set", () => {
    const { container } = render(
      <KanbanCard epic={makeEpic({ themeColor: "#FF5733" })} />
    );
    // The color bar div has inline style with backgroundColor
    const colorBar = container.querySelector("[style]");
    expect(colorBar).toBeDefined();
  });

  it("shows feature count", () => {
    render(<KanbanCard epic={makeEpic({ featureCount: 5 })} />);
    expect(screen.getByText(RE_5_FEATURES)).toBeDefined();
  });

  it("shows singular feature label for count of 1", () => {
    render(<KanbanCard epic={makeEpic({ featureCount: 1 })} />);
    expect(screen.getByText(RE_1_FEATURE)).toBeDefined();
  });
});
