/**
 * Navegação do Big Bang, espelhando o `BO_NAV` do `backoffice-shell.jsx` do
 * canvas de design (não o export local, que estava defasado em 13 entradas e
 * duas seções inteiras).
 *
 * `pendente` marca o que ainda não tem implementação. Ele existe aqui em vez de
 * a rota simplesmente não aparecer porque o handoff faz questão do contrário:
 * "os três limites do painel são requisito, não falta — estão anotados na
 * própria UI para o operador não procurar o que não existe". A mesma lógica
 * vale para o que ainda vem: esconder a rota faz o operador perguntar; mostrá-la
 * dizendo o que falta responde antes da pergunta.
 *
 * Cada motivo nomeia a entidade que bloqueia, e cada uma foi conferida contra
 * os 151 models do schema — nenhuma existe. Motivo genérico ("em breve") é
 * exatamente o que este campo existe para impedir.
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

export type NavSection = {
  section: string;
  items: NavItem[];
  /** Seção atrás de um portão de acesso que ainda não existe no schema. */
  lab?: boolean;
};

export const BO_NAV: NavSection[] = [
  {
    section: "Plataforma",
    items: [
      {
        href: "/home",
        icon: "gauge",
        label: "Home",
        pendente:
          "Painel agregado com o que exige atenção e os últimos eventos de auditoria de todos os tenants. A lista de clientes já é a tela inicial em /; o que falta é a visão cruzada, que depende do AccessLog — ele não existe no schema.",
      },
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
    section: "Delivery",
    items: [
      {
        href: "/delivery",
        icon: "handshake",
        label: "Engajamentos",
        pendente:
          "Tela pronta, aguardando a migration 20260806120000_platform_ops rodar no banco. Sem as tabelas ela responde 42P01.",
      },
      {
        href: "/capacidade",
        icon: "users",
        label: "Capacidade",
        pendente:
          "Capacidade da equipe da Nebuloz distribuída entre clientes. O schema tem TeamCapacitySnapshot, mas aquilo é capacidade de time ágil DENTRO de um tenant — outra coisa, e reusar confundiria as duas.",
      },
      {
        href: "/ip",
        icon: "book",
        label: "Biblioteca de IP",
        pendente:
          "Acervo de ativos reutilizáveis entre engajamentos. Nenhuma entidade de ativo existe, e ela depende de Engagement para saber de onde o ativo veio.",
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
          "Tela pronta, aguardando a migration 20260806120000_platform_ops rodar no banco. Sem as tabelas ela responde 42P01.",
      },
      {
        href: "/servicos",
        icon: "briefcase",
        label: "Serviços",
        pendente:
          "Tela pronta, aguardando a migration 20260806120000_platform_ops rodar no banco. Sem as tabelas ela responde 42P01.",
      },
      {
        href: "/contas",
        icon: "heart",
        label: "Health e renovação",
        pendente:
          "Depende de sinal de saúde e data de renovação por cliente, que não existem. Atenção: o model Account do schema é o do better-auth, credencial de login — não tem relação com esta tela.",
      },
      {
        href: "/benchmark",
        icon: "chart",
        label: "Benchmark",
        pendente:
          "Tela pronta, aguardando a migration 20260806120000_platform_ops rodar no banco. Sem as tabelas ela responde 42P01.",
      },
    ],
  },
  {
    // Seção inteira atrás de um portão que ainda não existe: o protótipo a
    // libera por `account.lab`, e não há flag equivalente em User nem em
    // TenantMember. Aparece esmaecida, como no desenho.
    section: "LAB",
    lab: true,
    items: [
      {
        href: "/lab",
        icon: "flask",
        label: "Modelo próprio",
        pendente:
          "Toda a seção LAB depende de uma flag de acesso por conta, que não existe em User nem em TenantMember, e das entidades de modelo — nenhuma delas está no schema.",
      },
      {
        href: "/lab/datasets",
        icon: "dataset",
        label: "Datasets",
        pendente: "Depende da entidade Dataset — não existe no schema.",
      },
      {
        href: "/lab/treinos",
        icon: "cpu",
        label: "Treinos",
        pendente:
          "Depende da entidade de execução de treino e de Dataset — nenhuma existe.",
      },
      {
        href: "/lab/avaliacoes",
        icon: "gauge",
        label: "Avaliações",
        pendente:
          "Depende da entidade de avaliação e dos treinos que ela mede — nenhuma existe.",
      },
      {
        href: "/lab/linhagem",
        icon: "layers",
        label: "Linhagem",
        pendente:
          "Rastreia dataset → treino → modelo. Depende dos três, e nenhum existe.",
      },
      {
        href: "/lab/model-card",
        icon: "fileCode",
        label: "Model card",
        pendente:
          "Ficha de um modelo próprio. Depende da entidade de modelo e da avaliação que a preenche.",
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
      { href: "/audit", icon: "history", label: "Audit Explorer" },
      { href: "/atividade", icon: "userCheck", label: "Atividade do staff" },
    ],
  },
  {
    section: "Operações",
    items: [{ href: "/clientes/novo", icon: "plus", label: "Criar tenant" }],
  },
];

/**
 * Acha a entrada de menu de uma rota.
 *
 * Existe para que a página pendente leia título e motivo daqui em vez de
 * repeti-los no próprio arquivo. Antes o mesmo texto vivia em dois lugares, e
 * dois lugares divergem: a sidebar diria um motivo e a tela, outro.
 */
export function itemDaRota(href: string): NavItem | undefined {
  for (const grupo of BO_NAV) {
    const achado = grupo.items.find((i) => i.href === href);
    if (achado) {
      return achado;
    }
  }
  return;
}

/** Rotas que o operador não encontra porque elas não existem por decisão. */
export const FORA_DO_PAINEL =
  "Remover cliente, revogar staff e promover ADMIN não existem aqui — são operações de banco, por decisão.";
