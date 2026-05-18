import { describe, expect, it } from "vitest";
import { HAIKU, SONNET, selectModel } from "../model-router.js";

describe("selectModel", () => {
  it("returns Haiku for routine diff with no critical paths", () => {
    const diff = `--- a/apps/app/app/actions/flow-metrics/index.ts
+++ b/apps/app/app/actions/flow-metrics/index.ts
@@ -1,5 +1,6 @@
 export function getMetrics() {
+  console.log('updated');
   return {};
 }`;
    expect(selectModel(diff)).toBe(HAIKU);
  });

  it("returns Sonnet when diff touches prisma/schema", () => {
    const diff = "diff --git a/packages/database/prisma/schema/tenant.prisma";
    expect(selectModel(diff)).toBe(SONNET);
  });

  it("returns Sonnet when diff touches packages/auth/", () => {
    const diff = "diff --git a/packages/auth/server.ts";
    expect(selectModel(diff)).toBe(SONNET);
  });

  it("returns Sonnet when diff touches middleware", () => {
    const diff = "diff --git a/apps/app/middleware.ts";
    expect(selectModel(diff)).toBe(SONNET);
  });

  it("returns Sonnet when diff touches tenant keyword", () => {
    const diff = "+ const tenantId = ctx.tenantId;";
    expect(selectModel(diff)).toBe(SONNET);
  });

  it("returns Sonnet when diff touches security/", () => {
    const diff = "diff --git a/packages/security/index.ts";
    expect(selectModel(diff)).toBe(SONNET);
  });

  it("returns Haiku for empty diff", () => {
    expect(selectModel("")).toBe(HAIKU);
  });
});
