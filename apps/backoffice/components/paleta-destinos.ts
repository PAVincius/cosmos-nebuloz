import type { IconName } from "@repo/design-system/cosmos/icons";
import type { ClienteAchado } from "@/app/actions/clientes-busca";
import { ABAS_DO_FINANCEIRO } from "@/lib/empresa/abas-do-financeiro";
import { contemTexto } from "./busca";
import { BO_NAV } from "./nav";

/**
 * Para onde a paleta (Ctrl+K) leva: as telas do menu, os sub-destinos que o
 * menu não tem (as abas do Financeiro, as abas de um cliente) e os últimos
 * destinos escolhidos.
 *
 * Crítica R6, H7: o salto parava onde o menu parava. "Títulos" era Ctrl+K,
 * "financeiro", Enter e mais um clique na aba; "usuários da Acme" era a busca
 * do cliente e mais um clique. O sub-destino entra como item filho, logo
 * abaixo do pai, e o `detalhe` diz de quem ele é.
 */

export type Destino = {
  href: string;
  rotulo: string;
  /** Seção do menu, o slug do cliente, ou o pai do sub-destino. */
  detalhe: string;
  icone: IconName;
  /** Sub-destino: aparece recuado, sob o pai. */
  filho?: boolean;
};

const HREF_DO_FINANCEIRO = "/empresa/financeiro";

const TELAS: Destino[] = BO_NAV.flatMap((grupo) =>
  grupo.items.map((item) => ({
    detalhe: grupo.section,
    href: item.href,
    icone: item.icon,
    rotulo: item.label,
  }))
);

/** Sub-destinos por tela-pai. */
const FILHOS: Record<string, Destino[]> = {
  [HREF_DO_FINANCEIRO]: ABAS_DO_FINANCEIRO.map((aba) => ({
    detalhe: "Financeiro",
    filho: true,
    href: `${HREF_DO_FINANCEIRO}?aba=${aba.id}`,
    icone: "wallet",
    rotulo: aba.rotulo,
  })),
};

/**
 * As telas que batem com o termo, cada uma seguida dos filhos que batem.
 * Sem termo, só as telas: sete abas a mais na lista inicial afogariam o
 * menu que a pessoa veio varrer.
 */
export function telasDaBusca(termo: string): Destino[] {
  const comTermo = termo.trim() !== "";
  return TELAS.flatMap((tela) => {
    const propria = contemTexto([tela.rotulo, tela.detalhe], termo)
      ? [tela]
      : [];
    const filhos = comTermo
      ? (FILHOS[tela.href] ?? []).filter((f) =>
          contemTexto([f.rotulo, f.detalhe], termo)
        )
      : [];
    return [...propria, ...filhos];
  });
}

/** As abas do detalhe que sempre existem (`clientes/[slug]/detalhe.tsx`).
 *  Charter e Meridian dependem do contrato — a paleta não sabe, e a aba que
 *  não existe cairia em Resumo. */
const ABAS_DO_CLIENTE: { id: string; rotulo: string; icone: IconName }[] = [
  { icone: "userCheck", id: "usuarios", rotulo: "Usuários" },
  { icone: "eye", id: "integracoes", rotulo: "Integrações" },
  { icone: "history", id: "audit", rotulo: "Trilha de auditoria" },
];

/** O cliente e, logo abaixo, as abas dele. */
export function destinosDoCliente(cliente: ClienteAchado): Destino[] {
  const base = `/clientes/${cliente.slug}`;
  return [
    {
      detalhe: cliente.slug,
      href: base,
      icone: "building",
      rotulo: cliente.name,
    },
    ...ABAS_DO_CLIENTE.map((aba) => ({
      detalhe: cliente.slug,
      filho: true,
      href: `${base}?aba=${aba.id}`,
      icone: aba.icone,
      rotulo: aba.rotulo,
    })),
  ];
}

// ── Recentes ────────────────────────────────────────────────────────────────

const CHAVE = "bo:paleta:recentes";
export const MAXIMO_DE_RECENTES = 5;

function ehDestino(v: unknown): v is Destino {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const d = v as Record<string, unknown>;
  return (
    typeof d.href === "string" &&
    d.href.startsWith("/") &&
    typeof d.rotulo === "string" &&
    typeof d.detalhe === "string" &&
    typeof d.icone === "string"
  );
}

/**
 * Os últimos destinos, o mais recente primeiro. Storage é conveniência: em
 * janela anônima, com cookies bloqueados ou cota cheia ele lança — e aí a
 * paleta funciona igual, só sem lembrar. O que vem de lá é dado de fora:
 * forma errada é ignorada, não confiada.
 */
export function lerRecentes(): Destino[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) {
      return [];
    }
    const lido: unknown = JSON.parse(bruto);
    if (!Array.isArray(lido)) {
      return [];
    }
    return lido
      .filter(ehDestino)
      .slice(0, MAXIMO_DE_RECENTES)
      .map(({ href, rotulo, detalhe, icone }) => ({
        detalhe,
        href,
        icone,
        rotulo,
      }));
  } catch {
    return [];
  }
}

/** Põe o destino no topo, sem repetir, e corta nos cinco. */
export function lembrarRecente(destino: Destino): void {
  const { href, rotulo, detalhe, icone } = destino;
  const lista = [
    { detalhe, href, icone, rotulo },
    ...lerRecentes().filter((d) => d.href !== href),
  ].slice(0, MAXIMO_DE_RECENTES);
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Sem storage não há o que lembrar — a navegação segue.
  }
}
