// Costura Scaffold → Cosmos (decisões do Norte, seção e.1): o Cosmos guarda de
// qual trilha veio o épico (um por trilha) e cada feature (uma por fase que
// abre trabalho), como texto sem FK — pelo mesmo padrão de `sourceGapId`.
// A chave (tenantId, trackId, phase) torna o evento reprocessável sem duplicar.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const ler = (...p: string[]) => readFileSync(join(PRISMA, ...p), "utf-8");
const ART = ler("schema", "art-core.prisma");
const DIR = "20260929000600_cosmos_origem_trilha";

function bloco(cabecalho: string): string {
  const inicio = ART.indexOf(cabecalho);
  if (inicio < 0) {
    throw new Error(`${cabecalho} ausente`);
  }
  return ART.slice(inicio, ART.indexOf("\n}", inicio));
}

describe("Epic.originTrackId", () => {
  const epic = bloco("model Epic {");

  it("é texto opcional, sem relação", () => {
    expect(epic).toMatch(/originTrackId\s+String\?/);
    expect(epic).not.toMatch(/originTrackId[^\n]*@relation/);
  });

  it("um épico por trilha no tenant", () => {
    expect(epic).toContain("@@unique([tenantId, originTrackId])");
  });
});

describe("Feature.originTrackId + originPhase", () => {
  const feature = bloco("model Feature {");

  it("são texto opcional, sem relação", () => {
    expect(feature).toMatch(/originTrackId\s+String\?/);
    expect(feature).toMatch(/originPhase\s+String\?/);
  });

  it("idempotência por (tenantId, trackId, phase)", () => {
    expect(feature).toContain(
      "@@unique([tenantId, originTrackId, originPhase])"
    );
  });
});

describe("migration", () => {
  it("é aditiva e reversível, sem FK", () => {
    const sql = ler("migrations", DIR, "migration.sql");
    expect(sql).toContain('"Epic" ADD COLUMN');
    expect(sql).toContain('"Feature" ADD COLUMN');
    expect(sql).not.toContain("FOREIGN KEY");
    expect(existsSync(join(PRISMA, "migrations", DIR, "down.sql"))).toBe(true);
  });
});
