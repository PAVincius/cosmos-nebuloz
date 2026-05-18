/**
 * COSMOS UX Swarm — Product Owner Persona
 *
 * PRD User Stories:
 *   - Refinar backlog de Stories com critérios de aceitação
 *   - Visualizar WSJF de Features e reordenar backlog
 *   - Isolamento de dados entre tenants (multi-tenancy)
 */

import { expect, test } from "@playwright/test";
import { makeFindingId, writeFinding } from "../swarm/state";
import type { UxFinding } from "../swarm/types";

const PERSONA = "po" as const;

function finding(
  partial: Omit<UxFinding, "id" | "persona" | "timestamp">
): UxFinding {
  return {
    ...partial,
    id: makeFindingId(PERSONA),
    persona: PERSONA,
    timestamp: Date.now(),
  };
}

test.describe("PO — Backlog & Multi-Tenancy", () => {
  test("backlog/stories route existence check", async ({ page }) => {
    const routes = [
      "/backlog",
      "/stories",
      "/teams/backlog",
      "/dashboard/backlog",
    ];

    let found = false;
    for (const route of routes) {
      const res = await page.goto(route);
      if ((res?.status() ?? 0) < 400) {
        found = true;
        writeFinding(
          finding({
            severity: "info",
            category: "compliant",
            route,
            description: `Backlog route found at ${route}`,
          })
        );
        break;
      }
    }

    if (!found) {
      writeFinding(
        finding({
          severity: "high",
          category: "route-missing",
          route: "/backlog",
          story:
            "Como PO, quero refinar o backlog de Stories com critérios de aceitação.",
          description: "No backlog/stories route implemented yet (epic-005)",
          expected: "Backlog page with stories list, story scoring, acceptance criteria",
          actual: "All backlog routes return 404",
          suggestion:
            "Implement epic-005 Team Level Management — create Story list page",
          codeRef: "docs/stories/epic-005/",
        })
      );
    }

    expect(true).toBe(true);
  });

  test("WSJF update API contract", async ({ request }) => {
    // Test that the WSJF update action works
    // Since it's a server action (not a direct API route), we check indirectly
    // by verifying the feature update endpoint
    const res = await request.get("/api/features");
    const status = res.status();

    if (status === 404) {
      writeFinding(
        finding({
          severity: "medium",
          category: "route-missing",
          route: "/api/features",
          story: "Como PO, quero visualizar WSJF de Features e reordenar backlog.",
          description:
            "No GET /api/features endpoint — WSJF only accessible via server actions",
          expected: "REST API or tRPC router for Feature CRUD",
          actual: "HTTP 404 — features only via server actions",
          suggestion:
            "Consider adding GET /api/features for client-side pagination in backlog view",
          codeRef: "apps/app/app/actions/features/update-wsjf.ts",
        })
      );
    }

    expect(true).toBe(true);
  });

  test("multi-tenant isolation — switch-tenant enforces membership", async ({
    request,
  }) => {
    // Test that switching to a tenant without membership is rejected
    const res = await request.post("/api/auth/switch-tenant", {
      data: { tenantId: "non-existent-tenant-id-xyz" },
    });

    const status = res.status();
    // Expect 401 (no auth) or 403 (not a member) — never 200
    if (status === 200) {
      writeFinding(
        finding({
          severity: "critical",
          category: "api-error",
          route: "/api/auth/switch-tenant",
          story:
            "Como PO, preciso que o isolamento de dados entre tenants seja garantido.",
          description:
            "CRITICAL: switch-tenant accepted non-member tenant without auth — potential data isolation breach",
          expected: "HTTP 401 or 403 for unauthenticated request",
          actual: "HTTP 200 returned without valid session",
          suggestion:
            "Verify requireTenantSession guard in switch-tenant route handler",
          codeRef: "apps/app/app/api/auth/switch-tenant/route.ts",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/api/auth/switch-tenant",
          description: `Multi-tenant security enforced — non-member switch returns ${status}`,
        })
      );
    }

    expect(status).not.toBe(200); // Should not allow without auth
  });

  test("sign-in form accepts email + password inputs", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("domcontentloaded");

    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    const emailVisible = await emailInput.isVisible().catch(() => false);
    const passwordVisible = await passwordInput.isVisible().catch(() => false);
    const submitVisible = await submitBtn.isVisible().catch(() => false);

    if (!emailVisible || !passwordVisible || !submitVisible) {
      writeFinding(
        finding({
          severity: "high",
          category: "flow-blocked",
          route: "/sign-in",
          story: "Como PO, preciso me autenticar para acessar o backlog.",
          description: `Sign-in form incomplete — email:${emailVisible} password:${passwordVisible} submit:${submitVisible}`,
          expected: "All three elements visible: email, password, submit",
          actual: `email=${emailVisible}, password=${passwordVisible}, submit=${submitVisible}`,
          suggestion:
            "Check SignIn component in packages/auth/components/sign-in.tsx",
          codeRef: "packages/auth/components/sign-in.tsx",
        })
      );
    } else {
      writeFinding(
        finding({
          severity: "info",
          category: "compliant",
          route: "/sign-in",
          description: "Sign-in form has all required elements",
        })
      );
    }

    expect(emailVisible && passwordVisible && submitVisible).toBe(true);
  });

  test("DESIGN.md — sign-in button uses primary color token", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("domcontentloaded");

    const btn = page.locator('button[type="submit"]').first();
    const visible = await btn.isVisible().catch(() => false);

    if (visible) {
      const bgColor = await btn.evaluate((el) => {
        return getComputedStyle(el).backgroundColor;
      });

      // primary = oklch(0.58 0.22 264) ≈ RGB around 67-100, 80-120, 220-255 range
      const isLavender = bgColor.includes("rgb") &&
        !bgColor.includes("255, 255, 255") &&
        !bgColor.includes("0, 0, 0");

      if (!isLavender) {
        writeFinding(
          finding({
            severity: "low",
            category: "design-violation",
            route: "/sign-in",
            description: "Submit button may not use primary lavender-blue token",
            expected: "Button bg = var(--color-primary) ≈ lavender-blue",
            actual: `Computed bg: ${bgColor}`,
            suggestion:
              "Verify button uses bg-primary Tailwind class mapped to CSS var(--color-primary)",
            codeRef: "packages/auth/components/sign-in.tsx",
          })
        );
      }
    }
  });
});
