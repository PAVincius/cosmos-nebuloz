// CH-DEV-01/03 + decisões do Norte, parte 2 (CH-PO-01..05): perfis de controle
// versionados e plano de controles por caso de uso.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const ler = (...p: string[]) => readFileSync(join(PRISMA, ...p), "utf-8");
const SCHEMA = ler("schema", "charter-controls.prisma");
const PERFIS = "20260929010200_charter_control_profiles";
const CONTROLES = "20260929010300_charter_case_controls";

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

describe("perfil de controle (global, versionado, imutável)", () => {
  it("um perfil por forma de trabalho", () => {
    const p = bloco("model CharterControlProfile {");
    expect(p).toMatch(/workForm\s+WorkForm\s+@unique/);
    expect(p).not.toMatch(/tenantId/);
  });

  it("versão imutável com riscos dominantes, papel que decide e assinaturas", () => {
    const v = bloco("model CharterControlProfileVersion {");
    expect(v).not.toMatch(/updatedAt/);
    expect(v).toMatch(/dominantRisks\s+CharterRiskCategory\[\]/);
    expect(v).toMatch(/decisionRole\s+CharterRole/);
    expect(v).toMatch(/legalSignedBy\s+String\?/);
    expect(v).toMatch(/securitySignedBy\s+String\?/);
    expect(v).toContain("@@unique([profileId, label])");
  });

  it("cadência própria (o CharterRecertCadence só tem ANNUAL e SEMIANNUAL)", () => {
    expect(valoresDe("enum CharterControlCadence {")).toEqual([
      "WEEKLY",
      "MONTHLY",
      "QUARTERLY",
      "SEMIANNUAL",
      "ANNUAL",
      "PER_CYCLE",
    ]);
  });

  it("controle do perfil: código, categoria, evidência, papel, cadência, classe mínima", () => {
    const c = bloco("model CharterControlProfileControl {");
    expect(c).not.toMatch(/updatedAt/);
    for (const campo of [
      "code",
      "category",
      "evidence",
      "acceptanceCriteria",
      "role",
      "cadence",
      "minClass",
      "dispensable",
    ]) {
      expect(c).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    expect(c).toMatch(/minClass\s+CharterDataClass/);
    expect(c).toContain("@@unique([versionId, code])");
  });

  it("caso de uso ganha forma e versão de perfil pinada", () => {
    const uc = bloco("model CharterUseCase {", ler("schema", "charter.prisma"));
    expect(uc).toMatch(/workForm\s+WorkForm\?/);
    expect(uc).toMatch(/controlProfileVersionId\s+String\?/);
  });

  it("migration reversível; tabelas globais com RLS forçada e SEM policy", () => {
    const sql = ler("migrations", PERFIS, "migration.sql");
    expect(existsSync(join(PRISMA, "migrations", PERFIS, "down.sql"))).toBe(
      true
    );
    for (const t of [
      "CharterControlProfile",
      "CharterControlProfileVersion",
      "CharterControlProfileControl",
    ]) {
      expect(sql).toContain(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
    }
    expect(sql).not.toContain("CREATE POLICY");
  });
});

describe("CharterCaseControl", () => {
  const m = bloco("model CharterCaseControl {");
  const sql = ler("migrations", CONTROLES, "migration.sql");

  it("os 8 estados do PDF", () => {
    expect(valoresDe("enum CharterCaseControlState {")).toEqual([
      "NO_EVIDENCE",
      "IN_PROGRESS",
      "IN_REVIEW",
      "ADJUSTMENT_REQUESTED",
      "ACCEPTED",
      "EXPIRED",
      "DISPENSED",
      "REOPENED",
    ]);
  });

  it("campos do CH-DEV-03", () => {
    for (const campo of [
      "tenantId",
      "useCaseId",
      "state",
      "fileKey",
      "summary",
      "ownerId",
      "cadence",
      "mitigationId",
      "isExtra",
      "dispensedUntil",
      "dispensedReason",
      "expiresAt",
    ]) {
      expect(m).toMatch(new RegExp(`\\b${campo}\\b`));
    }
    expect(m).toContain("@@unique([tenantId, useCaseId, code])");
  });

  it("dispensa tem prazo: CHECK amarra estado, prazo e motivo", () => {
    expect(sql).toMatch(
      /CHECK \(state <> 'DISPENSED'|CHECK \("state" <> 'DISPENSED'/
    );
    expect(sql).toContain('"dispensedUntil" IS NOT NULL');
  });

  it("histórico append-only, com trigger", () => {
    const e = bloco("model CharterCaseControlEvent {");
    expect(e).not.toMatch(/updatedAt/);
    expect(sql).toMatch(/CREATE TRIGGER charter_case_control_event_immutable/);
    expect(sql).toContain("pg_trigger_depth");
    expect(existsSync(join(PRISMA, "migrations", CONTROLES, "down.sql"))).toBe(
      true
    );
  });
});
