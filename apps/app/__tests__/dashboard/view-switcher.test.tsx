import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewSwitcher } from "@/app/(authenticated)/dashboard/components/view-switcher";

const VIEWS = ["Operacional", "Estratégico", "Foco PI"];

afterEach(() => cleanup());

describe("ViewSwitcher", () => {
  it("renders all view labels", () => {
    render(
      <ViewSwitcher active="Operacional" onChange={vi.fn()} views={VIEWS} />
    );
    for (const view of VIEWS) {
      expect(screen.getByText(view)).toBeTruthy();
    }
  });

  it("highlights active view with ink color", () => {
    render(
      <ViewSwitcher active="Operacional" onChange={vi.fn()} views={VIEWS} />
    );
    const activeBtn = screen.getByText("Operacional");
    expect(activeBtn.style.color).toBe("rgb(247, 248, 248)"); // #f7f8f8
  });

  it("renders inactive views with tertiary color", () => {
    render(
      <ViewSwitcher active="Operacional" onChange={vi.fn()} views={VIEWS} />
    );
    const inactiveBtn = screen.getByText("Estratégico");
    expect(inactiveBtn.style.color).toBe("rgb(98, 102, 109)"); // #62666d
  });

  it("calls onChange with the clicked view label", () => {
    const onChange = vi.fn();
    render(
      <ViewSwitcher active="Operacional" onChange={onChange} views={VIEWS} />
    );
    fireEvent.click(screen.getByText("Estratégico"));
    expect(onChange).toHaveBeenCalledWith("Estratégico");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange even when clicking already active view", () => {
    const onChange = vi.fn();
    render(
      <ViewSwitcher active="Operacional" onChange={onChange} views={VIEWS} />
    );
    fireEvent.click(screen.getByText("Operacional"));
    expect(onChange).toHaveBeenCalledWith("Operacional");
  });

  it("renders correct number of buttons", () => {
    render(
      <ViewSwitcher active="A" onChange={vi.fn()} views={["A", "B", "C"]} />
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("renders two-view switcher", () => {
    render(
      <ViewSwitcher
        active="Time"
        onChange={vi.fn()}
        views={["Time", "Sprint"]}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
