// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlowPredictabilityChart } from "@/app/(authenticated)/analytics/flow/components/flow-predictability-chart";

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const history = [
  { label: "PI-1", planned: 8, delivered: 6 },
  { label: "PI-2", planned: 10, delivered: 9 },
];

describe("FlowPredictabilityChart", () => {
  it("renders current predictability percentage", () => {
    render(<FlowPredictabilityChart current={0.9} history={history} />);
    expect(screen.getByText("90%")).toBeTruthy();
  });

  it("renders low predictability in rose color class", () => {
    const { container } = render(
      <FlowPredictabilityChart current={0.4} history={history} />
    );
    expect(container.querySelector(".text-rose-500")).toBeTruthy();
  });
});
