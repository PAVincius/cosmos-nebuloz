import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorState } from "../../components/cosmos/kit";

describe("ErrorState", () => {
  it("renders the given message", () => {
    const html = renderToStaticMarkup(
      <ErrorState message="Falha ao carregar dados." />
    );
    expect(html).toContain("Falha ao carregar dados.");
  });

  it("renders a default message when none given", () => {
    const html = renderToStaticMarkup(<ErrorState />);
    expect(html).toContain("Não foi possível carregar os dados.");
  });
});
