// Navegação e títulos do Scaffold — dado puro.
//
// Vive fora de `screens/registry.ts` de propósito: o registry importa os
// componentes de tela, que importam server actions, que leem env de servidor.
// Qualquer consumidor que só queira o rótulo de uma tela — a casca "use client",
// o `generateMetadata` da rota, um teste — arrastaria tudo isso junto.
//
// É também o único lugar onde os títulos existem. Duplicá-los na casca faria as
// duas cópias divergirem na primeira tela renomeada.

/** [título, seção pai] por tela. Alimenta o breadcrumb e o <title> da aba. */
export const TITLES: Record<string, [string, string]> = {
  portfolio: ["Portfólio de trilhas", "Adoção"],
  track: ["Trilha", "Portfólio"],
  baselines: ["Casos de negócio", "Método"],
  baseline: ["Caso de negócio", "Método"],
  templates: ["Biblioteca de templates", "Método"],
  members: ["Papéis de adoção", "Adoção"],
};

export type NavItem = { id: string; icon: string; label: string };

/**
 * Itens de menu, agrupados por seção.
 *
 * Telas de DETALHE (`track`, `baseline`) ficam de fora: são alcançadas por
 * clique numa lista, e um item de menu para "Trilha" sem id levaria a lugar
 * nenhum.
 *
 * A FILA DE GATES também fica de fora, por outro motivo: ela é cross-tenant e
 * vive em `apps/backoffice/app/scaffold-supervision` — ADR-0013, research §R4.
 */
export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Adoção",
    items: [
      { id: "portfolio", icon: "layers", label: "Portfólio de trilhas" },
      { id: "members", icon: "users", label: "Papéis de adoção" },
    ],
  },
  {
    section: "Método",
    items: [
      { id: "baselines", icon: "fileText", label: "Casos de negócio" },
      { id: "templates", icon: "puzzle", label: "Biblioteca de templates" },
    ],
  },
];

/** Item de nav que representa a tela atual. Detalhe herda o pai: estar numa
 *  trilha é estar no portfólio, e o item apagado faria a pessoa achar que saiu
 *  do produto. */
export function navIdFor(screenId: string): string {
  if (screenId === "track") {
    return "portfolio";
  }
  if (screenId === "baseline") {
    return "baselines";
  }
  return screenId;
}
