// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { FlowDistributionChart } from "@/app/(authenticated)/analytics/flow/components/flow-distribution-chart";

const LEGEND_PATTERN = /História|Feature|Defect/;

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const data = [
  { type: "História", count: 42, pct: 70 },
  { type: "Feature", count: 12, pct: 20 },
  { type: "Defect", count: 6, pct: 10 },
];

describe("FlowDistributionChart", () => {
  it("renders all distribution types with percentages", () => {
    const { container } = render(<FlowDistributionChart data={data} />);
    const text = container.textContent ?? "";
    expect(text).toContain("70%");
    expect(text).toContain("História");
    expect(text).toContain("Defect");
  });

  it("renders all items in legend", () => {
    render(<FlowDistributionChart data={data} />);
    expect(screen.getAllByText(LEGEND_PATTERN)).toHaveLength(3);
  });
});
