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
 * Cada motivo nomeia a entidade que bloqueia. Motivo genérico ("em breve") é
 * exatamente o que este campo existe para impedir.
 *
 * O limite dessa lógica é escala: ela funciona para uma rota anotada dentro de
 * uma seção que existe, não para uma seção inteira de seis rotas em que nenhuma
 * abre. O LAB era esse caso — seis das 24 rotas do painel, todas `Pendente`,
 * um quarto do menu prometendo o que não tem entidade no schema. Saiu daqui até
 * ter PRD, SRD e schema; volta com portão de acesso de verdade, não esmaecido
 * para sempre. Nenhum item usa `pendente` hoje, e o campo fica: é o mecanismo
 * que o LAB vai usar ao voltar em fatias.
 *
 * O protótipo chamava o item de `/` de "Tenants". Aqui ele se chama
 * "Clientes" porque é o que a tela é — "Carteira de clientes", KPI "Clientes
 * na carteira" — e porque "tenant" é vocabulário de quem escreveu o schema,
 * não de quem abre o painel no primeiro dia. A rota continua `/clientes`
 * porque é a que existe, é a que os `revalidatePath` das actions apontam, e
 * renomear seria quebra sem ganho.
 *
 * Rótulos em português, como o resto do menu: "Audit Explorer" e "AI
 * readiness" eram os dois únicos itens em inglês, e o operador não abre o
 * painel para traduzir o menu. "Maturidade de IA" é o nome que o eyebrow da
 * própria tela já usava; "Trilha de auditoria" é o que a tela é.
 *
 * Cada rota aparece uma vez só. O `/scaffold` chegou a estar em duas seções
 * ("Fila de gates" em Delivery e "Scaffold" em Comercial) e as duas acendiam
 * juntas; ficou a de Delivery, porque é o que a tela monta — a fila de gates
 * da carteira. `secaoDaRota` é o que deixa a tela dizer a própria seção no
 * eyebrow lendo daqui, em vez de repetir o nome em string solta.
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
};

export const BO_NAV: NavSection[] = [
  {
    section: "Plataforma",
    items: [
      {
        href: "/home",
        icon: "gauge",
        label: "Home",
      },
      { href: "/", icon: "building", label: "Clientes" },
      { href: "/aprovacoes", icon: "approve", label: "Aprovações" },
      {
        href: "/observabilidade",
        icon: "eye",
        label: "Observabilidade",
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
      },
      {
        // A única superfície cross-tenant do Scaffold. Ela mora aqui e não no
        // app do cliente porque a ADR-0013 fez de `platformDb` a porta única
        // para leitura entre organizações — ver
        // `specs/002-scaffold-adoption/research.md` §R4.
        href: "/scaffold",
        icon: "shield",
        label: "Fila de gates",
      },
      {
        href: "/capacidade",
        icon: "users",
        label: "Capacidade",
      },
      {
        href: "/ip",
        icon: "book",
        label: "Biblioteca de IP",
      },
    ],
  },
  {
    // Growth vem antes de Comercial porque é essa a ordem do processo: o
    // diagnóstico de maturidade é o degrau 01 da Escada, e é ele que decide
    // por qual porta o lead entra no funil — não o contrário.
    //
    // Uma rota só, e de propósito: a lição do LAB é que seção inteira
    // prometida antes de existir vira um pedaço do menu que não abre. As
    // outras superfícies de growth (aquisição, integração com as ferramentas
    // self-hosted) voltam aqui quando tiverem entidade no schema.
    section: "Growth",
    items: [
      {
        href: "/growth/readiness",
        icon: "gauge",
        label: "Maturidade de IA",
      },
    ],
  },
  {
    section: "Comercial",
    items: [
      {
        href: "/funil",
        icon: "filter",
        label: "Funil",
      },
      {
        href: "/propostas",
        icon: "tag",
        label: "Propostas",
      },
      {
        href: "/servicos",
        icon: "briefcase",
        label: "Serviços",
      },
      { href: "/contas", icon: "heart", label: "Saúde e renovação" },
      {
        href: "/benchmark",
        icon: "chart",
        label: "Benchmark",
      },
    ],
  },
  {
    section: "Empresa",
    items: [
      {
        href: "/empresa/fornecedores",
        icon: "shield",
        label: "Fornecedores e DPA",
      },
      {
        href: "/empresa/consentimento",
        icon: "userCheck",
        label: "Consentimento",
      },
      { href: "/empresa/cac", icon: "target", label: "CAC" },
      { href: "/empresa/financeiro", icon: "wallet", label: "Financeiro" },
    ],
  },
  {
    section: "Ferramentas",
    items: [
      {
        href: "/ferramentas/bpmn",
        icon: "fileCode",
        label: "Modelagem BPMN",
      },
      {
        href: "/ferramentas/processos",
        icon: "graph",
        label: "Mapa de processos",
      },
      {
        href: "/ferramentas/diagramas",
        icon: "server",
        label: "Diagramas",
      },
    ],
  },
  {
    section: "Auditoria",
    items: [
      { href: "/audit", icon: "history", label: "Trilha de auditoria" },
      { href: "/atividade", icon: "userCheck", label: "Atividade do staff" },
    ],
  },
  {
    section: "Operações",
    items: [
      // "Provisionar cliente", o mesmo nome do botão da carteira: é a mesma
      // ação, e dois nomes para ela faziam parecer duas telas.
      { href: "/clientes/novo", icon: "plus", label: "Provisionar cliente" },
      { href: "/versao", icon: "gitBranch", label: "Versão e schema" },
    ],
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

/**
 * A seção do menu em que uma rota mora — para o eyebrow da tela ser o mesmo
 * nome que a sidebar mostra, lido de um lugar só. Rota fora do menu cai no
 * nome do painel, o mesmo fallback da trilha da topbar.
 */
export function secaoDaRota(href: string): string {
  const grupo = BO_NAV.find((g) => g.items.some((i) => i.href === href));
  return grupo?.section ?? "Nebuloz";
}

/**
 * O `<title>` da aba: o rótulo do menu e o nome do painel. Vinte e nove abas
 * abertas diziam todas "Nebuloz — Back-office"; com o rótulo na frente, a aba
 * certa se acha pelo nome, e o nome é o mesmo que a sidebar mostra.
 */
export function tituloDaAba(href: string): string {
  const item = itemDaRota(href);
  return item ? `${item.label} — Back-office Nebuloz` : "Nebuloz — Back-office";
}

/** Rotas que o operador não encontra porque elas não existem por decisão. */
export const FORA_DO_PAINEL =
  "Remover cliente, revogar staff e promover ADMIN não existem aqui — são operações de banco, por decisão.";
