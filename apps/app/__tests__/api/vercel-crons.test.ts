import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// O projeto `cosmos-nebuloz-app` tem Root Directory = apps/app (build da
// Vercel roda `node ../../scripts/skip-ci.js`), então só este vercel.json vale
// — o da raiz do repo não é lido.
const root = path.resolve(__dirname, "../..");
const config = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));

describe("apps/app/vercel.json crons", () => {
  it("agenda a retenção do Meridian (diária, 03:00) e a eliminação LGPD (de hora em hora, por economia — decisão do CEO em 30/09)", () => {
    expect(config.crons).toEqual(
      expect.arrayContaining([
        {
          path: "/api/cron/meridian-evidence-retention",
          schedule: "0 3 * * *",
        },
        { path: "/api/cron/lgpd-erasure", schedule: "0 * * * *" },
      ])
    );
  });

  it("todo cron agendado aponta para uma rota que existe", () => {
    for (const { path: cronPath } of config.crons as { path: string }[]) {
      expect(existsSync(path.join(root, "app", cronPath, "route.ts"))).toBe(
        true
      );
    }
  });
});
