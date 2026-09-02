import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR-0013 — porta única de acesso cross-tenant.
//
// `platformDb` vive em `packages/provisioning` e é importável apenas por
// `packages/provisioning` e `apps/backoffice`. A ADR diz textualmente: "um
// teste falha se `apps/app` importar `platformDb`".
//
// Isto importa para o Scaffold mais do que para os outros produtos, porque a
// fila de supervisão da consultora É cross-tenant (S-08 / SN-06) e a tentação
// de resolvê-la aqui é real. A decisão foi movê-la para `apps/backoffice`
// (research §R4). Este teste é o que impede a decisão de ser desfeita por
// conveniência num PR futuro.

// O alvo é o BINDING `platformDb`, não o pacote inteiro: `@repo/provisioning`
// também exporta `provisionTenant` e `POLICY_SECTIONS`, que `apps/app` importa
// legitimamente no onboarding e no setup do Charter. Proibir o pacote quebraria
// código correto e ensinaria a desligar o teste.
const APP_ROOT = join(import.meta.dirname, "..", "..");
const SKIP = new Set(["node_modules", ".next", ".turbo", "generated", "dist"]);
const EXT = /\.(ts|tsx|mts|cts)$/;

/** Remove comentários antes de procurar. Sem isto, a própria linha que explica
 *  por que a fila de supervisão NÃO usa `platformDb` acusa violação. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** `import { platformDb }` / `import { x, platformDb as y }` / dinâmico. */
const IMPORTS_PLATFORM_DB =
  /import\s*(?:type\s*)?\{[^}]*\bplatformDb\b[^}]*\}\s*from|\bawait\s+import\([^)]*\)\s*\)?\s*\.\s*platformDb/;

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
    } else if (EXT.test(entry)) {
      yield full;
    }
  }
}

describe("ADR-0013 — apps/app não atravessa tenants", () => {
  it("nenhum arquivo de apps/app importa platformDb", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(APP_ROOT)) {
      // O próprio teste cita o nome; ignorá-lo evita que ele se acuse.
      if (file.endsWith("adr-0013-boundary.test.ts")) {
        continue;
      }
      if (IMPORTS_PLATFORM_DB.test(stripComments(readFileSync(file, "utf8")))) {
        offenders.push(file.slice(APP_ROOT.length + 1));
      }
    }

    expect(
      offenders,
      `Acesso cross-tenant fora da porta única (ADR-0013). Se isto é a fila de supervisão do Scaffold, ela pertence a apps/backoffice — ver specs/002-scaffold-adoption/research.md §R4.\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("a navegação do Scaffold não expõe a tela de supervisão", async () => {
    // `nav.ts` é dado puro e pode ser importado; o registry puxaria as telas e,
    // com elas, env de servidor.
    const { NAV, TITLES } = await import("@/components/scaffold/nav");
    expect(Object.keys(TITLES)).not.toContain("supervision");
    expect(NAV.flatMap((s) => s.items.map((i) => i.id))).not.toContain(
      "supervision"
    );
  });
});
