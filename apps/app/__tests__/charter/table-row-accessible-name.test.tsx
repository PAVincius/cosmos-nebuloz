/** @vitest-environment jsdom */
// table-row-accessible-name.test.tsx — crítica de a11y (Sam, leitor de tela):
// TableRow com onClick usava aria-label="Abrir UC-118" no <button>, o que
// SUBSTITUI o conteúdo anunciado — status, classe, risco e SLA da linha somem
// para quem usa leitor de tela em dashboard, cases, vendors, risk e
// vendor-detail. O nome acessível do botão precisa conter tanto a intenção
// ("Abrir") quanto o conteúdo visível das células.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableRow } from "../../components/charter/base";

describe("TableRow — nome acessível da linha clicável", () => {
  it("botão da linha inclui a intenção 'Abrir' e o conteúdo das células no nome acessível", () => {
    render(
      <TableRow cols="1fr 1fr" label="Abrir UC-118" onClick={() => {}}>
        <span>UC-118</span>
        <span>Em análise</span>
      </TableRow>
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBeNull();
    const name = button.textContent ?? "";
    expect(name).toContain("Abrir");
    expect(name).toContain("UC-118");
    expect(name).toContain("Em análise");
  });

  it("linha sem onClick não vira button e não precisa de label", () => {
    render(
      <TableRow cols="1fr">
        <span>Conteúdo estático</span>
      </TableRow>
    );

    expect(screen.queryByRole("button")).toBeNull();
  });
});
