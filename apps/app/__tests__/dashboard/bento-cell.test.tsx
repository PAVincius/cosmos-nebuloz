import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/design-system/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { cleanup, render, screen } from "@testing-library/react";

import {
  BentoCell,
  BentoGrid,
  CellValue,
  ProgressBar,
  Sparkline,
  StatusBadge,
} from "@/app/(authenticated)/dashboard/components/bento-cell";

afterEach(() => cleanup());

describe("BentoGrid", () => {
  it("renders children in a 4-column grid", () => {
    const { container } = render(
      <BentoGrid>
        <div data-testid="child" />
      </BentoGrid>
    );
    // getByTestId throws if not found — implicit assertion
    expect(container.querySelector("[data-testid='child']")).not.toBeNull();
  });
});

describe("BentoCell", () => {
  it("renders with default span 1", () => {
    const { container } = render(
      <BentoCell>
        <span>content</span>
      </BentoCell>
    );
    const cell = container.firstElementChild as HTMLElement;
    expect(cell.style.gridColumn).toBe("span 1");
  });

  it("renders with span 2", () => {
    const { container } = render(
      <BentoCell span={2}>
        <span>content</span>
      </BentoCell>
    );
    const cell = container.firstElementChild as HTMLElement;
    expect(cell.style.gridColumn).toBe("span 2");
  });

  it("renders with span 4", () => {
    const { container } = render(
      <BentoCell span={4}>
        <span>content</span>
      </BentoCell>
    );
    const cell = container.firstElementChild as HTMLElement;
    expect(cell.style.gridColumn).toBe("span 4");
  });

  it("applies critical accent bar when priority=critical", () => {
    const { container } = render(
      <BentoCell accentColor="#e54d4d" priority="critical">
        <span />
      </BentoCell>
    );
    // Accent bar is position:absolute inside the cell
    const bar = container.querySelector(
      "div > div[style]"
    ) as HTMLElement | null;
    expect(bar).not.toBeNull();
  });

  it("does NOT render accent bar when priority=high", () => {
    const { container } = render(
      <BentoCell priority="high">
        <span />
      </BentoCell>
    );
    // No absolutely positioned child when not critical
    const cell = container.firstElementChild as HTMLElement;
    const absoluteChild = Array.from(cell.querySelectorAll("div")).find(
      (el) => el.style.position === "absolute"
    );
    expect(absoluteChild).toBeUndefined();
  });

  it("renders eyebrow text when eyebrow prop given", () => {
    render(
      <BentoCell eyebrow="Flow Efficiency">
        <span />
      </BentoCell>
    );
    // getByText throws if not found
    expect(screen.getByText("Flow Efficiency")).toBeTruthy();
  });

  it("renders eyebrow action link", () => {
    render(
      <BentoCell eyebrowAction={{ label: "Ver →", href: "/test" }}>
        <span />
      </BentoCell>
    );
    expect(screen.getByRole("link", { name: "Ver →" })).toBeTruthy();
  });
});

describe("CellValue", () => {
  it("renders value and suffix", () => {
    render(<CellValue suffix="pts" value="73%" />);
    expect(screen.getByText("73%")).toBeTruthy();
    expect(screen.getByText("pts")).toBeTruthy();
  });
});

describe("StatusBadge", () => {
  it.each([
    ["green", "#27a644"],
    ["red", "#e54d4d"],
    ["amber", "#f59e0b"],
    ["blue", "#3b82f6"],
    ["purple", "#8b5cf6"],
  ] as const)("renders %s variant and is visible", (variant, _hex) => {
    render(<StatusBadge variant={variant}>badge-text</StatusBadge>);
    expect(screen.getByText("badge-text")).toBeTruthy();
  });

  it("applies correct text color to green variant", () => {
    const { container } = render(
      <StatusBadge variant="green">label</StatusBadge>
    );
    const badge = container.firstElementChild as HTMLElement;
    // jsdom normalizes hex to rgb
    expect(badge.style.color).toBe("rgb(39, 166, 68)");
  });

  it("applies correct text color to red variant", () => {
    const { container } = render(
      <StatusBadge variant="red">label</StatusBadge>
    );
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.style.color).toBe("rgb(229, 77, 77)");
  });
});

describe("ProgressBar", () => {
  it("clamps value to correct percent", () => {
    const { container } = render(<ProgressBar max={100} value={50} />);
    const inner = (container.firstElementChild as HTMLElement)
      ?.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe("50%");
  });

  it("handles 0 value", () => {
    const { container } = render(<ProgressBar max={100} value={0} />);
    const inner = (container.firstElementChild as HTMLElement)
      ?.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe("0%");
  });

  it("caps at 100% when value exceeds max", () => {
    const { container } = render(<ProgressBar max={100} value={120} />);
    const inner = (container.firstElementChild as HTMLElement)
      ?.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe("100%");
  });
});

describe("Sparkline", () => {
  it("renders correct number of bars", () => {
    const { container } = render(<Sparkline data={[10, 20, 30]} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children).toHaveLength(3);
  });

  it("returns null for empty data", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.firstElementChild).toBeNull();
  });
});
