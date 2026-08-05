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
export type NavItem = {
  href: string;
  label: string;
  /** Motivo pelo qual a tela ainda não existe. Ausente = implementada. */
  pendente?: string;
};

export type NavSection = { section: string; items: NavItem[] };

export const BO_NAV: NavSection[] = [
  {
    section: "Plataforma",
    items: [
      { href: "/", label: "Tenants" },
      {
        href: "/aprovacoes",
        label: "Aprovações",
        pendente:
          "Depende da entidade Approval, que ainda não existe no schema. É pré-requisito de deleção de tenant, MCP writes avançadas, desconto acima de 15%, export sensível e mudança grande de plano.",
      },
      {
        href: "/observabilidade",
        label: "Observabilidade",
        pendente:
          "Depende das entidades Integration e AccessLog. Sem elas não há falha de integração para listar nem log de acesso ao painel.",
      },
    ],
  },
  {
    section: "Comercial",
    items: [
      {
        href: "/propostas",
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
        label: "Modelagem BPMN",
        pendente:
          "Editor BPMN 2.0 versionado por tenant. Em produção monta bpmn-js, não o canvas SVG do protótipo.",
      },
      {
        href: "/ferramentas/diagramas",
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
        label: "Audit Explorer",
        pendente:
          "A timeline agregada precisa de diff campo-a-campo em AuditLog. Hoje o AuditLog existe, mas sem a coluna de diff que o FR-10.3 exige.",
      },
      { href: "/atividade", label: "Atividade do staff" },
    ],
  },
  {
    section: "Operações",
    items: [{ href: "/clientes/novo", label: "Criar tenant" }],
  },
];

/** Rotas que o operador não encontra porque elas não existem por decisão. */
export const FORA_DO_PAINEL =
  "Remover cliente, revogar staff e promover ADMIN não existem aqui — são operações de banco, por decisão.";
