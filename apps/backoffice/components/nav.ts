/**
 * Navegação do Big Bang — as 13 rotas do handoff (README §Rotas).
 *
 * `pendente` marca o que ainda não tem implementação. Ele existe aqui em vez de
 * a rota simplesmente não aparecer porque o handoff faz questão do contrário:
 * "os três limites do painel são requisito, não falta — estão anotados na
 * própria UI para o operador não procurar o que não existe". A mesma lógica
 * vale para o que ainda vem: esconder a rota faz o operador perguntar; mostrá-la
 * dizendo o que falta responde antes da pergunta.
 *
 * O id `clients` com label "Tenants" é do próprio protótipo — a rota continua
 * `/clientes` porque é a que existe, é a que os `revalidatePath` das actions
 * apontam, e renomear seria quebra sem ganho.
 */
import type { IconName } from "@repo/design-system/cosmos/icons";

export type NavItem = {
  href: string;
  label: string;
  /** Glifo do set compartilhado — os mesmos nomes que o protótipo usa. */
  icon: IconName;
  /** Motivo pelo qual a tela ainda não existe. Ausente = implementada. */
  pendente?: string;
};

export type NavSection = { section: string; items: NavItem[] };

export const BO_NAV: NavSection[] = [
  {
    section: "Plataforma",
    items: [
      { href: "/", icon: "building", label: "Tenants" },
      { href: "/aprovacoes", icon: "approve", label: "Aprovações" },
      {
        href: "/observabilidade",
        icon: "eye",
        label: "Observabilidade",
        pendente:
          "Falha de integração já aparece por tenant, em Clientes › o cliente › Integrações. Falta a visão cruzada de todos os tenants e o log de acesso ao painel, que depende da entidade AccessLog — ela não existe.",
      },
    ],
  },
  {
    section: "Comercial",
    items: [
      {
        href: "/propostas",
        icon: "tag",
        label: "Propostas",
        pendente:
          "Depende da entidade Proposal e da função priceProposal(). O gate de desconto acima de 15% também depende de Approval.",
      },
    ],
  },
  {
    section: "Ferramentas",
    items: [
      {
        href: "/ferramentas/bpmn",
        icon: "fileCode",
        label: "Modelagem BPMN",
        pendente:
          "Editor BPMN 2.0 versionado por tenant. Em produção monta bpmn-js, não o canvas SVG do protótipo.",
      },
      {
        href: "/ferramentas/diagramas",
        icon: "server",
        label: "Diagramas",
        pendente:
          "Diagrama-como-código: a DSL é a fonte da verdade e é versionável em git; o canvas reflete a estrutura.",
      },
    ],
  },
  {
    section: "Auditoria",
    items: [
      {
        href: "/audit",
        icon: "history",
        label: "Audit Explorer",
        pendente:
          "A timeline de UM tenant já existe, em Clientes › o cliente › Auditoria, com o diff campo-a-campo. Falta o explorer agregado do FR-10.3: busca e filtro sobre o AuditLog de todos os tenants ao mesmo tempo.",
      },
      { href: "/atividade", icon: "userCheck", label: "Atividade do staff" },
    ],
  },
  {
    section: "Operações",
    items: [{ href: "/clientes/novo", icon: "plus", label: "Criar tenant" }],
  },
];

/** Rotas que o operador não encontra porque elas não existem por decisão. */
export const FORA_DO_PAINEL =
  "Remover cliente, revogar staff e promover ADMIN não existem aqui — são operações de banco, por decisão.";
