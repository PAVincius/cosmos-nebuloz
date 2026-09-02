import { expect, type Page, test } from "@playwright/test";
import { charterStorageState } from "./setup/auth.setup";

/**
 * E2E — Charter intake (FR-4).
 *
 * Covers the two highest-value flows named in
 * docs/design-handoff/charter-prototype/HANDOFF.md §6:
 *
 *   1. Gate do intake — classe Restrito + fornecedor de teto Interno barra a
 *      submissão nomeando o motivo contratual (FR-4.4).
 *   2. Reavaliação ao vivo — trocar classe de dado muda caminho e SLA no
 *      trilho, antes de qualquer submissão (FR-4.2).
 *
 * Persona: Marina Alves (Compliance, tenant `medcore`) — has `case.submit`.
 */
test.describe("Charter intake @auth", () => {
  test.use({ storageState: charterStorageState("compliance") });

  async function openIntakeModal(page: Page) {
    await page.goto("/charter/cases");
    // The vendor list loads async (listVendors()); the modal captures it at
    // open time and never refetches, so opening before it resolves freezes
    // the picker on an empty option list for the whole test.
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Novo caso de uso" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    return dialog;
  }

  test("live re-evaluation: switching data class to Restrito changes path and SLA before any submit", async ({
    page,
  }) => {
    const dialog = await openIntakeModal(page);

    // Default state (INTERNAL/INTERNAL/MEDIUM) recommends the Segurança path.
    await expect(dialog.getByText("Segurança", { exact: true })).toBeVisible();
    await expect(dialog.getByText("3 dias", { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Restrito", exact: true }).click();

    // RESTRICTED always routes to the AI Committee regardless of exposure or
    // criticality (SRD acceptance criteria) — recomputed live, nothing saved.
    await expect(
      dialog.getByText("Legal + Segurança + Comitê de IA")
    ).toBeVisible();
    await expect(dialog.getByText("10 dias", { exact: true })).toBeVisible();
  });

  test("intake gate: Restrito data + a vendor capped at Interno blocks submission with the contractual reason", async ({
    page,
  }) => {
    const dialog = await openIntakeModal(page);

    await dialog.getByRole("button", { name: "Restrito", exact: true }).click();

    const vendorSelect = dialog.getByLabel("Fornecedor ou modelo");
    const kairosOption = vendorSelect.locator("option", {
      hasText: "Kairos Decision Cloud",
    });
    const kairosValue = await kairosOption.getAttribute("value");
    await vendorSelect.selectOption(kairosValue as string);

    // Ineligibility surfaces in the live evaluation rail, badge + reason —
    // never a silent disabled control with no explanation (NFR-1.3). The
    // reason repeats in both the aside card and the body-level Callout, so
    // first() confirms presence without asserting a specific count.
    await expect(dialog.getByText("Não elegível a Restrito")).toBeVisible();
    await expect(
      dialog.getByText(/sem explicabilidade suficiente/).first()
    ).toBeVisible();

    const submit = dialog.getByRole("button", {
      name: "Submeter para revisão",
    });
    await expect(submit).toBeVisible();

    // The button itself is never `disabled` — the wrapping <span> (GatedAction
    // in components/charter/modals.tsx) kills pointer-events and carries the
    // reason in its title instead. Assert that gate, not a missing attribute.
    const gate = submit.locator("xpath=..");
    await expect(gate).toHaveAttribute(
      "title",
      "Fornecedor não elegível à classe de dado escolhida"
    );
  });
});
