// Toda tabela nova por tenant nasce com RLS no mesmo padrão de
// 20260902150000_rls_tabelas_restantes / 20260902190000_rls_catalogo_comercial:
// ENABLE + FORCE ROW LEVEL SECURITY e policy `tenant_isolation` com USING e
// WITH CHECK iguais. O Supabase expõe tabela nova de `public` pela Data API,
// então tabela sem RLS é leitura aberta. ADR-0012: enquanto a aplicação conectar
// como superuser a policy fica inerte; o filtro por tenant na query continua
// sendo o isolamento real.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PRISMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma");
const sql = (dir: string) =>
  readFileSync(join(PRISMA, "migrations", dir, "migration.sql"), "utf-8");

const TABELAS: [string, string][] = [
  ["20260929000100_process_registry", "ProcessRegistry"],
  ["20260929000200_scaffold_deliverable_draft", "ScaffoldDeliverableInstance"],
  ["20260929000200_scaffold_deliverable_draft", "ScaffoldDeliverableEvent"],
  ["20260929000200_scaffold_deliverable_draft", "ScaffoldDeliverableComment"],
  ["20260929000500_scaffold_deliverable_link", "ScaffoldDeliverableLink"],
  ["20260929010100_signal_plan_metric", "SignalPlanMetric"],
  ["20260929010100_signal_plan_metric", "SignalPlanMetricEvent"],
];

describe.each(TABELAS)("RLS em %s → %s", (dir, tabela) => {
  const migration = sql(dir);

  it("habilita e força RLS", () => {
    expect(migration).toContain(
      `ALTER TABLE "${tabela}" ENABLE ROW LEVEL SECURITY`
    );
    expect(migration).toContain(
      `ALTER TABLE "${tabela}" FORCE ROW LEVEL SECURITY`
    );
  });

  it("cria tenant_isolation com USING e WITH CHECK por current_tenant_id()", () => {
    const re = new RegExp(
      `CREATE POLICY "tenant_isolation" ON "${tabela}"\\s+USING \\("tenantId" = current_tenant_id\\(\\)\\)\\s+WITH CHECK \\("tenantId" = current_tenant_id\\(\\)\\)`
    );
    expect(migration).toMatch(re);
  });
});

describe("ScaffoldDeliverableTemplate", () => {
  it("é global (método da Nebuloz, sem tenantId) e por isso fica sem RLS", () => {
    const schema = readFileSync(
      join(PRISMA, "schema", "scaffold-deliverable.prisma"),
      "utf-8"
    );
    const inicio = schema.indexOf("model ScaffoldDeliverableTemplate {");
    const modelo = schema.slice(inicio, schema.indexOf("\n}", inicio));
    expect(modelo).not.toMatch(/tenantId/);
  });
});

describe("ProcessRegistry — integridade", () => {
  const migration = sql("20260929000100_process_registry");
  const schema = readFileSync(
    join(PRISMA, "schema", "process-registry.prisma"),
    "utf-8"
  );

  it("CHECK exige ao menos um id de produto", () => {
    expect(migration).toMatch(
      /ADD CONSTRAINT "ProcessRegistry_ao_menos_um_id"/
    );
    for (const campo of [
      "meridianGapId",
      "scaffoldTrackId",
      "signalInitiativeId",
      "charterUseCaseId",
    ]) {
      expect(migration).toMatch(
        new RegExp(`CHECK \\([^;]*"${campo}" IS NOT NULL`)
      );
    }
  });

  it("documenta que a escrita valida cada id no mesmo tenant", () => {
    expect(schema).toMatch(/withTenantDb/);
    expect(schema).toMatch(/mesmo tenant/);
  });
});

// Catálogo global do Scaffold (método da Nebuloz, sem tenantId): RLS ligada e
// FORÇADA, SEM policy. Pela Data API (anon key) ninguém lê nem escreve; o app
// conecta como postgres (BYPASSRLS, ADR-0012) e segue como antes. Quando a
// aplicação passar a papel sem BYPASSRLS, estas tabelas precisam de uma policy
// de SELECT — registrado aqui e na migration.
describe("catálogo global do Scaffold: RLS sem policy", () => {
  const migration = sql("20260929000700_rls_catalogo_global_scaffold");

  it.each([
    "ScaffoldTemplate",
    "ScaffoldTemplateVersion",
    "ScaffoldStepTemplate",
    "ScaffoldGateCriterion",
    "ScaffoldDeliverableTemplate",
  ])("%s tem ENABLE + FORCE RLS", (tabela) => {
    expect(migration).toContain(`'${tabela}'`);
  });

  it("aplica ENABLE e FORCE e não cria policy", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).not.toContain("CREATE POLICY");
  });
});
