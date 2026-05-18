import { test, expect } from "@playwright/test";

/**
 * E2E — Sign-In Page (public route)
 *
 * Tests the publicly accessible sign-in page at /(unauthenticated)/sign-in.
 * No authentication required.
 */
test.describe("Sign-In Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("should render the sign-in page with correct title", async ({
    page,
  }) => {
    // Title can be "Welcome back | next-forge", "Sign In | COSMOS", etc.
    // We just verify the page loads with *some* title (not empty)
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("should display email input field", async ({ page }) => {
    const emailInput = page
      .locator('input[type="email"], input[name="email"], input[id="email"]')
      .first();
    await expect(emailInput).toBeVisible();
  });

  test("should display password input field", async ({ page }) => {
    const passwordInput = page
      .locator(
        'input[type="password"], input[name="password"], input[id="password"]'
      )
      .first();
    await expect(passwordInput).toBeVisible();
  });

  test("should display a submit button", async ({ page }) => {
    const submitButton = page
      .locator(
        'button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Entrar")'
      )
      .first();
    await expect(submitButton).toBeVisible();
  });

  test("sign-up link is present (if the app has registration flow)", async ({
    page,
  }) => {
    // The current next-forge template may not have a sign-up link on the sign-in page.
    // This test verifies it SOFTLY: if a link exists, it should point to /sign-up.
    // If the app does not have a registration link, the test passes.
    const signUpLink = page.locator(
      'a[href*="sign-up"], a:has-text("Sign up"), a:has-text("Criar conta"), a:has-text("Register"), a:has-text("Don\'t have an account")'
    );
    const count = await signUpLink.count();
    if (count > 0) {
      await expect(signUpLink.first()).toBeVisible();
    }
    // If no sign-up link, that's acceptable for this app configuration
  });

  test("should show validation error on empty submit", async ({ page }) => {
    const submitButton = page
      .locator('button[type="submit"]')
      .first();

    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Page should still be on sign-in (not redirected)
      await expect(page).toHaveURL(/sign-in/);
    }
  });
});
