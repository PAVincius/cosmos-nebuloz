import { expect, test } from "@playwright/test";
import { charterStorageState } from "./setup/auth.setup";

/**
 * E2E — Charter policy publish gate (FR-2.3).
 *
 * The seeded policy has 9 sections, 4 of them intentionally not `PUBLISHED`
 * (seed-charter.ts §"Política") — the exact state that makes the publish
 * modal list blockers by name instead of just disabling the button
 * (docs/design-handoff/charter-prototype/HANDOFF.md §6, flow 3).
 *
 * Persona: Marina Alves (Compliance, tenant do e2e `cosmos-dev`) — has `policy.publish`.
 */
test.describe("Charter policy publish gate @auth", () => {
  test.use({ storageState: charterStorageState("compliance") });

  const BLOCKED_SECTIONS = [
    "Usos restritos",
    "IA voltada ao cliente",
    "Human-in-the-loop",
    "Escalonamento e exceções",
  ];

  test("publish modal names every blocking section and refuses to publish", async ({
    page,
  }) => {
    await page.goto("/charter/policy");
    await page.getByRole("button", { name: "Publicar versão" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText("Publicar Política de Uso de IA");

    // "4 seções não estão aprovadas" — the count, not just a generic warning.
    await expect(
      dialog.getByText(`${BLOCKED_SECTIONS.length} seções não estão aprovadas`)
    ).toBeVisible();

    for (const name of BLOCKED_SECTIONS) {
      // Each blocker's ordinal prefixes its name in the same text node
      // ("04 · Usos restritos") and appears twice (blocker button + row
      // label) — substring match, first() sidesteps both without weakening
      // the assertion that the name is actually there.
      await expect(dialog.getByText(name).first()).toBeVisible();
    }

    const submit = dialog.getByRole("button", { name: /^Publicar v/ });
    await expect(submit).toBeVisible();

    const gate = submit.locator("xpath=..");
    await expect(gate).toHaveAttribute(
      "title",
      "Aprove todas as seções antes de publicar"
    );
  });
});
