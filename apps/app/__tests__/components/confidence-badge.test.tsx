// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceBadge } from "../../app/(authenticated)/analytics/executive/components/confidence-badge";

describe("ConfidenceBadge", () => {
  it("renders the business label and a RAG dot for the verdict", () => {
    render(
      <ConfidenceBadge
        confidence={{
          rag: "RED",
          confidenceLabel: "Likely to slip past Jan 1, 2027",
          p50Date: new Date("2027-02-01"),
          p85Date: new Date("2027-03-01"),
          p95Date: new Date("2027-04-01"),
          confidencePct: null,
        }}
      />
    );
    // getByText throws if the label is missing — presence is asserted by the query.
    expect(
      screen.getByText(/Likely to slip past Jan 1, 2027/).textContent
    ).toContain("Likely to slip past Jan 1, 2027");
    expect(screen.getByTestId("confidence-dot").getAttribute("data-rag")).toBe(
      "RED"
    );
  });
});
