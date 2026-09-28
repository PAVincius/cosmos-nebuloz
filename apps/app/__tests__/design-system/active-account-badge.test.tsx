/** @vitest-environment jsdom */
// FR-001 (spec 009): o nome da conta ativa precisa aparecer como texto
// visível — nunca só no atributo `title` (tooltip). É a causa direta do
// incidente do dogfood (Meridian mostrava a conta só em `title`).

import { ActiveAccountBadge } from "@repo/design-system/components/account-switcher/active-account-badge";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ActiveAccountBadge (FR-001)", () => {
  it("mostra o nome da conta como nó de texto visível", () => {
    render(<ActiveAccountBadge name="Nebuloz" />);
    expect(screen.getByText("Nebuloz")).toBeTruthy();
  });

  it("não depende do atributo title para mostrar o nome", () => {
    render(<ActiveAccountBadge name="Nebula" />);
    const el = screen.getByText("Nebula");
    // O nome tem que estar no próprio texto do nó — se o componente
    // regredisse para `<span title={name}>outra coisa</span>`, esta busca por
    // texto falharia, mesmo que `title` continuasse correto.
    expect(el.textContent).toBe("Nebula");
  });
});
