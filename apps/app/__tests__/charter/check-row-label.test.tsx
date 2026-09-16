/** @vitest-environment jsdom */
// check-row-label.test.tsx — crítica de a11y (Sam, leitor de tela): CheckRow
// só montava aria-label quando `label` era string. Com ReactNode (ex.: um
// trecho em negrito), o botão ficava sem nome acessível algum.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckRow } from "../../components/charter/form-kit";

describe("CheckRow — nome acessível com label ReactNode", () => {
  it("label como ReactNode vira o nome acessível via aria-labelledby", () => {
    render(
      <CheckRow
        checked={false}
        label={
          <span>
            Seção <b>3</b>
          </span>
        }
        onToggle={() => {}}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    const labelledBy = checkbox.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const labelNode = document.getElementById(labelledBy as string);
    expect(labelNode?.textContent).toBe("Seção 3");
  });

  it("label string continua funcionando pelo mesmo mecanismo", () => {
    render(
      <CheckRow
        checked={true}
        label="Cláusula de retenção"
        onToggle={() => {}}
      />
    );

    const checkbox = screen.getByRole("checkbox");
    const labelledBy = checkbox.getAttribute("aria-labelledby");
    expect(document.getElementById(labelledBy as string)?.textContent).toBe(
      "Cláusula de retenção"
    );
  });
});
