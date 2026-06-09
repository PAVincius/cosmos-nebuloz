import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WipLimitWarning } from "../../app/(authenticated)/dashboard/portfolio/components/wip-limit-warning";

describe("WipLimitWarning", () => {
  it("shows warning when count > limit", () => {
    render(<WipLimitWarning count={5} limit={3} />);
    expect(screen.getByText(/wip/i)).toBeTruthy();
    expect(screen.getByText("5/3")).toBeTruthy();
  });

  it("does not render when count <= limit", () => {
    const { container } = render(<WipLimitWarning count={2} limit={3} />);
    expect(container.textContent).toBe("");
  });
});
