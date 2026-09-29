// SG-DEV-01/03 + decisões do Norte, parte 2 (seção f): modelos de medição
// versionados e plano de métricas por iniciativa. Sem harness de banco: o
// contrato testável é o schema e o SQL; o comportamento do trigger e da
// primária única é provado contra o Postgres local à parte.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const ler = (...p: string[]) => readFileSync(join(PRISMA, ...p), "utf-8");
const SCHEMA = ler("schema", "signal-measure.prisma");
const MODELOS = "20260929010000_signal_measure_models";
const PLANO = "20260929010100_signal_plan_metric";

function bloco(cabecalho: string, fonte = SCHEMA): string {
  const inicio = fonte.indexOf(cabecalho);
  if (inicio < 0) {
    throw new Error(`${cabecalho} ausente`);
  }
  return fonte.slice(inicio, fonte.indexOf("\n}", inicio));
}
const valoresDe = (decl: string) =>
  bloco(decl)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[A-Z_]+$/.test(l));

describe("modelo de medição (global, versionado, imutável)", () => {
  it("um modelo por forma de trabalho", () => {
    const m = bloco("model SignalMeasureModel {");
    expect(m).toMatch(/workForm\s+WorkForm\s+@unique/);
    expect(m).not.toMatch(/tenantId/);
  });

  it("a versão publicada não tem updatedAt e guarda contrafactual, janela, fontes e armadilhas", () => {
    const v = bloco("model SignalMeasureModelVersion {");
    expect(v).not.toMatch(/updatedAt/);
    for (const campo of [
      "counterfactual",
      "sampleWindowWeeks",
      "sources",
      "traps",
      "publishedAt",
    ]) {
      expect(v).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    expect(v).toContain("@@unique([modelId, label])");
  });

  it("métricas do modelo têm papel, fórmula e direção", () => {
    expect(valoresDe("enum SignalMetricRole {")).toEqual([
      "PRIMARY",
      "GUARD",
      "ADOPTION",
      "VALUE",
    ]);
    expect(valoresDe("enum SignalMetricDirection {")).toEqual(["UP", "DOWN"]);
    const m = bloco("model SignalMeasureModelMetric {");
    expect(m).not.toMatch(/updatedAt/);
    for (const campo of ["role", "name", "formula", "direction"]) {
      expect(m).toMatch(new RegExp(`\\b${campo}\\b`));
    }
  });

  it("iniciativa ganha forma, versão de modelo pinada, trilha e gap", () => {
    const ini = bloco(
      "model SignalInitiative {",
      ler("schema", "signal.prisma")
    );
    expect(ini).toMatch(/workForm\s+WorkForm\?/);
    expect(ini).toMatch(/measureModelVersionId\s+String\?/);
    expect(ini).toMatch(/scaffoldTrackId\s+String\?/);
    expect(ini).toMatch(/meridianGapId\s+String\?/);
  });

  it("migration reversível; tabelas globais com RLS forçada e SEM policy", () => {
    const sql = ler("migrations", MODELOS, "migration.sql");
    expect(existsSync(join(PRISMA, "migrations", MODELOS, "down.sql"))).toBe(
      true
    );
    for (const t of [
      "SignalMeasureModel",
      "SignalMeasureModelVersion",
      "SignalMeasureModelMetric",
    ]) {
      expect(sql).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
    }
    expect(sql).not.toContain("CREATE POLICY");
  });
});

describe("SignalPlanMetric", () => {
  const m = bloco("model SignalPlanMetric {");
  const sql = ler("migrations", PLANO, "migration.sql");

  it("estados do PDF", () => {
    expect(valoresDe("enum SignalPlanMetricState {")).toEqual([
      "PROPOSED",
      "NO_SOURCE",
      "MEASURING",
      "PAUSED",
      "FROZEN",
    ]);
  });

  it("campos do SG-DEV-03; 'agora' é lido da observação, não guardado", () => {
    for (const campo of [
      "tenantId",
      "initiativeId",
      "role",
      "formula",
      "direction",
      "state",
      "sourceMappingId",
      "baselineValue",
      "targetValue",
      "ownerId",
      "version",
    ]) {
      expect(m).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    expect(m).not.toMatch(/\bcurrentValue\b|\bnowValue\b/);
  });

  it("aponta a dimensão do baseline de onde vem o baselineValue", () => {
    expect(m).toMatch(/baselineDimensionKey\s+String\?/);
    const sql = ler(
      "migrations",
      "20260929010400_signal_plan_metric_baseline_key",
      "migration.sql"
    );
    expect(sql).toContain('"baselineDimensionKey"');
    expect(
      existsSync(
        join(
          PRISMA,
          "migrations",
          "20260929010400_signal_plan_metric_baseline_key",
          "down.sql"
        )
      )
    ).toBe(true);
  });

  it("primária vigente única por iniciativa, garantida no banco", () => {
    expect(m).toContain("@@unique([initiativeId, isCurrentPrimary])");
    expect(sql).toMatch(/CHECK \("isCurrentPrimary" IS NULL OR/);
  });

  it("congelada não edita meta: trigger no banco", () => {
    expect(sql).toContain("prevent_signal_frozen_target_change");
  });

  it("histórico append-only, com trigger e RLS", () => {
    const e = bloco("model SignalPlanMetricEvent {");
    expect(e).not.toMatch(/updatedAt/);
    expect(e).toMatch(/actorId\s+String\?/);
    expect(sql).toMatch(/CREATE TRIGGER signal_plan_metric_event_immutable/);
    expect(sql).toContain("prevent_append_only_mutation");
    expect(sql).toContain("pg_trigger_depth() > 1");
    expect(existsSync(join(PRISMA, "migrations", PLANO, "down.sql"))).toBe(
      true
    );
  });
});
