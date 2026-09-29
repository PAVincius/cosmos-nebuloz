import { expect, test } from "@playwright/test";
import { charterStorageState } from "./setup/auth.setup";

/**
 * E2E — Charter decision with restrictions (FR-6.3).
 *
 * "Zero condições não submete": the decision modal defaults to "Aprovar com
 * restrições" with an empty condition list, and must refuse to submit until
 * at least one condition is added — an approval "with restrictions" that has
 * none is just an approval (docs/design-handoff/charter-prototype/
 * HANDOFF.md §6, flow 4).
 *
 * Persona: Marina Alves (Compliance, tenant do e2e `cosmos-dev`) — has `case.decide`.
 * Case: UC-109, seeded as SUBMITTED (decidable, never mutated by other specs).
 */
test.describe("Charter decision gate @auth", () => {
  test.use({ storageState: charterStorageState("compliance") });

  test("restricted approval with zero conditions stays blocked until one is added", async ({
    page,
  }) => {
    await page.goto("/charter/case/UC-109");
    await page.getByRole("button", { name: "Registrar decisão" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText("Decisão · UC-109");

    // Default decision is "Aprovar com restrições" with no conditions yet.
    await expect(
      dialog.getByText(
        "Nenhuma condição — uma aprovação restrita sem condição é apenas uma aprovação."
      )
    ).toBeVisible();

    await dialog
      .getByLabel("Justificativa da decisão")
      .fill("Aprovado sob condição de revisão profissional integral.");

    // "Aprovar com restrições" also names the RadioCards option (selected and
    // unselected renderings) — both are <button>s with that text. Scope to
    // the modal footer (ModalShell's last direct child) to land on the
    // actual submit button, not the decision picker.
    const footer = dialog.locator("> div").last();
    const submit = footer.getByRole("button", {
      name: "Aprovar com restrições",
      exact: true,
    });
    await expect(submit).toBeVisible();

    let gate = submit.locator("xpath=..");
    await expect(gate).toHaveAttribute(
      "title",
      "Aprovação com restrições exige ao menos uma condição"
    );

    // Adding one condition lifts the gate — proves it's the condition count
    // that blocks, not the rationale (already filled above).
    await dialog
      .getByPlaceholder("ex: Saída sempre revisada por profissional de saúde")
      .fill("Saída sempre revisada por profissional de saúde");
    await dialog.getByRole("button", { name: "Adicionar" }).click();

    await expect(
      dialog.getByText("Saída sempre revisada por profissional de saúde")
    ).toBeVisible();

    gate = submit.locator("xpath=..");
    await expect(gate).not.toHaveAttribute("title");
  });
});
