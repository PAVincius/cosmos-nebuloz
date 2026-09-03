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
// código correto e ensinaria a desligar o teste. O que É proibido, junto com o
// binding, é o caminho profundo até o módulo que o define (segundo teste
// abaixo) e o barrel do pacote (terceiro teste) — ver ADR-0014, seção "Uma
// lacuna encontrada no caminho": o barrel reexporta `platformDb` junto com os
// exports legítimos, e isso já obrigou `charter/setup.test.ts` a mockar
// `database` só para o import não quebrar, mesmo sem usar `platformDb`.
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

/** Import (estático ou dinâmico) cujo especificador aponta direto para o
 *  módulo que define `platformDb` — pega até um `import * as x` ou renomeio
 *  que escaparia da checagem acima, que olha o nome do binding. */
const IMPORTS_PLATFORM_DB_MODULE =
  /from\s*["'][^"']*provisioning\/src\/platform-db["']|\bimport\(\s*["'][^"']*provisioning\/src\/platform-db["']\s*\)/;

/** Import (estático ou dinâmico) do barrel `@repo/provisioning` — sem
 *  subcaminho. Não referencia `platformDb` por nome, mas carrega o módulo que
 *  o reexporta (ver comentário no topo do arquivo). */
const IMPORTS_BARE_BARREL =
  /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*from\s*["']@repo\/provisioning["']|\bimport\(\s*["']@repo\/provisioning["']\s*\)/;

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
  it("nenhum arquivo de apps/app importa platformDb, por nome ou pelo módulo que o define", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(APP_ROOT)) {
      // O próprio teste cita o nome; ignorá-lo evita que ele se acuse.
      if (file.endsWith("adr-0013-boundary.test.ts")) {
        continue;
      }
      const src = stripComments(readFileSync(file, "utf8"));
      if (
        IMPORTS_PLATFORM_DB.test(src) ||
        IMPORTS_PLATFORM_DB_MODULE.test(src)
      ) {
        offenders.push(file.slice(APP_ROOT.length + 1));
      }
    }

    expect(
      offenders,
      `Acesso cross-tenant fora da porta única (ADR-0013). Se isto é a fila de supervisão do Scaffold, ela pertence a apps/backoffice — ver specs/002-scaffold-adoption/research.md §R4.\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("nenhum arquivo de apps/app importa o barrel @repo/provisioning — só caminho profundo", () => {
    // O barrel (packages/provisioning/src/index.ts) reexporta `platformDb`
    // junto com `provisionTenant` e `POLICY_SECTIONS`. Importar dele não
    // referencia `platformDb` por nome — o teste acima não pega — mas ainda
    // carrega o módulo que o define. `apps/app` usa POLICY_SECTIONS e
    // provisionTenant legitimamente (Charter e onboarding); a correção é
    // importar do caminho profundo do submódulo específico
    // (`@repo/provisioning/src/charter`, `@repo/provisioning/src/tenant`),
    // igual ao que `lib/charter/policy-generation.ts` e
    // `scripts/seed-meridian.ts` já fazem.
    const offenders: string[] = [];
    for (const file of sourceFiles(APP_ROOT)) {
      if (file.endsWith("adr-0013-boundary.test.ts")) {
        continue;
      }
      if (IMPORTS_BARE_BARREL.test(stripComments(readFileSync(file, "utf8")))) {
        offenders.push(file.slice(APP_ROOT.length + 1));
      }
    }

    expect(
      offenders,
      `Import do barrel @repo/provisioning puxa platformDb junto (ADR-0013/0014). Troque por caminho profundo até o submódulo usado (ex.: @repo/provisioning/src/charter).\n${offenders.join("\n")}`
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
