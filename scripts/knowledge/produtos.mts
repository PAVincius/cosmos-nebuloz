import type { Produto } from "./tipos.mts";

export const PRODUTOS: Produto[] = [
  "meridian",
  "charter",
  "scaffold",
  "cosmos",
  "backoffice",
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
    "packages/rbac/src/meridian-",
    "packages/provisioning/src/meridian",
  ],
  charter: [
    "apps/app/app/(charter)",
    "apps/app/components/charter",
    "apps/app/lib/charter",
    "packages/database/prisma/schema/charter.prisma",
    "packages/rbac/src/charter",
    "packages/provisioning/src/charter",
  ],
  scaffold: [
    "apps/app/app/(scaffold)",
    "apps/app/components/scaffold",
    "apps/app/lib/scaffold",
    "apps/app/lib/inngest/scaffold-",
    "apps/backoffice/app/(staff)/scaffold",
    "apps/backoffice/app/actions/scaffold",
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
  backoffice: ["apps/backoffice"],
  plataforma: ["packages/provisioning", "packages/auth", "packages/database"],
  signal: [
    "apps/app/app/(signal)",
    "apps/app/components/signal",
    "apps/app/lib/signal",
    "packages/database/prisma/schema/signal.prisma",
    "packages/rbac/src/signal-",
  ],
};

/** Caminhos que casam um prefixo do produto mas pertencem a outro. Aplicado
 *  depois do prefixo: `apps/app/lib/inngest/scaffold-*` é do Scaffold, não do
 *  Cosmos; a supervisão do Scaffold mora no back-office mas é do Scaffold; os
 *  `.prisma` e o provisionamento de produto não são da plataforma. */
export const EXCLUSOES: Partial<Record<Produto, string[]>> = {
  cosmos: ["apps/app/lib/inngest/scaffold-"],
  backoffice: [
    "apps/backoffice/app/(staff)/scaffold",
    "apps/backoffice/app/actions/scaffold",
  ],
  plataforma: [
    "packages/database/prisma/schema/meridian.prisma",
    "packages/database/prisma/schema/charter.prisma",
    "packages/database/prisma/schema/scaffold.prisma",
    "packages/database/prisma/schema/signal.prisma",
    "packages/provisioning/src/meridian",
    "packages/provisioning/src/charter",
  ],
};

/** Ordem importa: a primeira lista que casar decide (spec §3.2). Produtos
 *  específicos vêm antes de genéricos, e.g. scaffold antes de meridian,
 *  backoffice antes de plataforma, plataforma antes de cosmos. As
 *  completions do back-office quase nunca dizem "backoffice" no nome — os
 *  termos são as áreas dele. */
export const PALAVRAS_CHAVE: Array<{ produto: Produto; termos: string[] }> = [
  { produto: "scaffold", termos: ["scaffold"] },
  { produto: "charter", termos: ["charter"] },
  { produto: "meridian", termos: ["meridian"] },
  { produto: "signal", termos: ["signal"] },
  {
    produto: "backoffice",
    termos: [
      "backoffice",
      "back-office",
      "big bang",
      "funil",
      "growth",
      "livro-razao",
      "plano-de-contas",
      "orcado",
      "receita-recorrente",
      "catalogo-de-ip",
      "mapa-de-processos",
      "janela-de-capacidade",
    ],
  },
  {
    produto: "plataforma",
    termos: [
      "lgpd",
      "rbac",
      "isolamento",
      "tenant",
      "rls",
      "platformdb",
      "seed",
    ],
  },
  {
    produto: "cosmos",
    termos: [
      "kanban",
      "pi-planning",
      "epic",
      "meeting",
      "cosmos",
      "story-0",
      "wsjf",
    ],
  },
];

/** Vale para todo produto: quem é dono de cada entidade compartilhada e o
 *  que o consumidor pode fazer com ela. */
export const MAPA_DE_FRONTEIRAS = "docs/produto/mapa-de-fronteiras.md";

export type Contexto = {
  /** O que o produto é, numa linha. Abre a note e a linha do mapa do Maestro. */
  resumo: string;
  /** Raiz Impeccable do produto: tem PRODUCT.md e DESIGN.md. */
  impeccable?: string;
  /** Fontes de verdade, na ordem em que o especialista deve abrir. */
  docs: string[];
  /** Onde o produto roda em produção. */
  producao?: string;
};

/** O que a note manda abrir antes de agir. `produtos.test.ts` garante que
 *  todo caminho existe — note que aponta para arquivo inexistente ensina o
 *  especialista a desconfiar da note. */
export const CONTEXTO: Record<Produto, Contexto> = {
  meridian: {
    resumo:
      'AVALIAR, "Estamos prontos?" — prontidão para IA aplicada pela consultoria Nebuloz: assessment em cinco eixos com respondentes externos, override humano, gap register e benchmark',
    impeccable: "apps/app/components/meridian",
    docs: [
      "docs/produto/meridian-prd.md",
      "docs/produto/meridian-srd.md",
      "specs/001-meridian-diagnose/spec.md",
    ],
    producao: "https://app.nebuloz.ai/meridian",
  },
  charter: {
    resumo:
      'GOVERNAR (transversal), "É permitido? Sob qual risco?" — risco e política multi-tenant: casos de uso, política versionada, fornecedores e trilha de auditoria',
    impeccable: "apps/app/components/charter",
    docs: [
      "docs/produto/charter-prd.md",
      "docs/produto/charter-srd.md",
      "docs/runbooks/charter-em-producao.md",
    ],
    producao: "https://app.nebuloz.ai/charter",
  },
  scaffold: {
    resumo:
      'CONTRATAR, "O que foi prometido?" — engajamento faseado por template: trilhas, gates com assinatura, caso de negócio e baseline assinados',
    impeccable: "apps/app/components/scaffold",
    docs: [
      "docs/produto/scaffold-prd.md",
      "docs/produto/scaffold-srd.md",
      "specs/002-scaffold-adoption/spec.md",
    ],
    producao: "https://app.nebuloz.ai/scaffold",
  },
  cosmos: {
    resumo:
      'EXECUTAR, "O que estamos fazendo?" — portfólio SAFe: hierarquia, WSJF, PI e gates de ciclo de vida sobre um único banco de fatos',
    impeccable: "apps/app/components/cosmos",
    docs: [
      "docs/produto/cosmos-prd.md",
      "docs/produto/cosmos-srd.md",
      "docs/cliente/index.md",
    ],
    producao: "https://app.nebuloz.ai/cosmos",
  },
  backoffice: {
    resumo:
      'VENDER E OPERAR (transversal), "Como isso entra e roda?" — Big Bang, o painel interno: proposta, provisionamento e operação de clientes, mais o sistema interno da Nebuloz',
    impeccable: "apps/backoffice",
    docs: [
      "docs/produto/backoffice-prd.md",
      "docs/produto/backoffice-srd.md",
      "docs/runbooks/acesso-ao-backoffice.md",
    ],
    producao: "https://backoffice.nebuloz.ai",
  },
  plataforma: {
    resumo:
      "infra compartilhada — tenant, sessão, RBAC, provisionamento e banco que os seis produtos usam",
    docs: [
      ".claude/ARCHITECTURE_MAP.md",
      ".claude/COMMON_MISTAKES.md",
      "docs/adr/0013-porta-unica-de-acesso-cross-tenant.md",
    ],
  },
  signal: {
    resumo:
      'APURAR, "Valeu a pena?" — valor realizado: métrica e fórmula versionadas, atribuição de ganho, decisão de valor e encerramento',
    impeccable: "apps/app/components/signal",
    docs: [
      "docs/produto/signal-prd.md",
      "docs/produto/signal-srd.md",
      "specs/003-signal-measure/spec.md",
    ],
    producao: "https://app.nebuloz.ai/signal",
  },
};
