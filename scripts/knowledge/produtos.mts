import type { Produto } from "./tipos.mts";

export const PRODUTOS: Produto[] = [
  "meridian",
  "charter",
  "scaffold",
  "cosmos",
  "plataforma",
  "signal",
];

/** Prefixos de `source_file` que pertencem ao produto. `packages/*` não
 *  listados entram por hop, nunca por prefixo (spec §3.1). */
export const PREFIXOS: Record<Produto, string[]> = {
  meridian: [
    "apps/app/app/(meridian)",
    "apps/app/app/meridian-responder",
    "apps/app/components/meridian",
    "apps/app/lib/meridian",
    "packages/database/prisma/schema/meridian.prisma",
  ],
  charter: [
    "apps/app/app/(charter)",
    "apps/app/lib/charter",
    "packages/database/prisma/schema/charter.prisma",
    "packages/rbac/src/charter",
  ],
  scaffold: [
    "apps/app/app/(scaffold)",
    "apps/app/lib/scaffold",
    "apps/app/lib/inngest/scaffold-",
    "packages/database/prisma/schema/scaffold.prisma",
    "packages/rbac/src/scaffold-",
  ],
  cosmos: [
    "apps/app/app/(cosmos)",
    "apps/app/components/cosmos",
    "apps/app/app/actions",
    "apps/app/lib/inngest",
    "packages/safe-engine",
  ],
  plataforma: [
    "apps/backoffice",
    "packages/provisioning",
    "packages/auth",
    "packages/database",
  ],
  signal: [],
};

/** Caminhos que casam um prefixo do produto mas pertencem a outro. Aplicado
 *  depois do prefixo: `apps/app/lib/inngest/scaffold-*` é do Scaffold, não do
 *  Cosmos; os `.prisma` de produto não são da plataforma. */
export const EXCLUSOES: Partial<Record<Produto, string[]>> = {
  cosmos: ["apps/app/lib/inngest/scaffold-"],
  plataforma: [
    "packages/database/prisma/schema/meridian.prisma",
    "packages/database/prisma/schema/charter.prisma",
    "packages/database/prisma/schema/scaffold.prisma",
  ],
};

/** Ordem importa: a primeira lista que casar decide (spec §3.2). Produtos
 *  específicos vêm antes de genéricos, e.g. scaffold antes de meridian,
 *  plataforma antes de cosmos. */
export const PALAVRAS_CHAVE: Array<{ produto: Produto; termos: string[] }> = [
  { produto: "scaffold", termos: ["scaffold"] },
  { produto: "charter", termos: ["charter"] },
  { produto: "meridian", termos: ["meridian"] },
  {
    produto: "plataforma",
    termos: ["lgpd", "rbac", "isolamento", "tenant", "rls", "platformdb", "backoffice", "seed"],
  },
  {
    produto: "cosmos",
    termos: ["kanban", "pi-planning", "epic", "meeting", "cosmos", "story-0", "wsjf"],
  },
];
