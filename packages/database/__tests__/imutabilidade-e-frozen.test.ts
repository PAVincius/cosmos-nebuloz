// Achados do Vigia sobre a noite:
//  • FROZEN não era terminal: FROZEN → PAUSED e depois mudava a meta. O trigger
//    agora barra qualquer saída de FROZEN e qualquer mudança de meta/baseline.
//  • "Imutável" só existia em comentário. Versão publicada, métrica do modelo,
//    controle do perfil e entregável de template ganham trigger que recusa
//    UPDATE e DELETE direto (INSERT livre; o DELETE em cascata do pai passa).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MIG = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "migrations"
);
const sql = (dir: string, file = "migration.sql") =>
  readFileSync(join(MIG, dir, file), "utf-8");

const FROZEN = "20260929010500_signal_frozen_terminal";
const IMUT = "20260929010600_imutabilidade_de_versoes_publicadas";

describe("FROZEN é terminal", () => {
  const migration = sql(FROZEN);

  it("substitui a função do trigger (CREATE OR REPLACE)", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION prevent_signal_frozen_target_change"
    );
  });

  it("recusa qualquer saída de FROZEN, além de meta e baseline", () => {
    expect(migration).toMatch(/OLD\."state" = 'FROZEN'/);
    expect(migration).toMatch(/NEW\."state" IS DISTINCT FROM OLD\."state"/);
    expect(migration).toMatch(
      /NEW\."targetValue" IS DISTINCT FROM OLD\."targetValue"/
    );
    expect(migration).toMatch(
      /NEW\."baselineValue" IS DISTINCT FROM OLD\."baselineValue"/
    );
  });

  it("é reversível", () => {
    expect(existsSync(join(MIG, FROZEN, "down.sql"))).toBe(true);
    expect(sql(FROZEN, "down.sql")).toContain(
      "CREATE OR REPLACE FUNCTION prevent_signal_frozen_target_change"
    );
  });
});

describe("imutabilidade de versão publicada", () => {
  const migration = sql(IMUT);

  it.each([
    ["SignalMeasureModelVersion", "signal_measure_model_version_immutable"],
    ["SignalMeasureModelMetric", "signal_measure_model_metric_immutable"],
    [
      "CharterControlProfileVersion",
      "charter_control_profile_version_immutable",
    ],
    [
      "CharterControlProfileControl",
      "charter_control_profile_control_immutable",
    ],
    ["ScaffoldDeliverableTemplate", "scaffold_deliverable_template_immutable"],
  ])("%s tem trigger %s que recusa UPDATE e DELETE, mas não INSERT", (table, trigger) => {
    expect(migration).toContain(`CREATE TRIGGER ${trigger}`);
    expect(migration).toMatch(
      new RegExp(
        `CREATE TRIGGER ${trigger}\\s+BEFORE UPDATE OR DELETE ON "${table}"`
      )
    );
  });

  it("DELETE em cascata do pai passa; direto não", () => {
    expect(migration).toContain("pg_trigger_depth() > 1");
    expect(migration).toContain("RAISE EXCEPTION");
  });

  it("é reversível", () => {
    const down = sql(IMUT, "down.sql");
    expect(down).toContain(
      "DROP TRIGGER signal_measure_model_version_immutable"
    );
    expect(down).toContain("DROP FUNCTION prevent_published_mutation");
  });
});
