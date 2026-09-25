"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database, type ProductModule } from "@repo/database";
import { listModules } from "@repo/rbac";
import { headers } from "next/headers";
import { safeAction } from "../_base";

/**
 * O que o tenant contratou, para a tela de produtos.
 *
 * **Não reimplementa a regra de acesso.** Quem decide se um módulo abre é
 * `listModules` do `@repo/rbac`, cujo comentário já diz ser a fonte do
 * app-switcher e da nav. Duas cópias da regra divergem no dia em que alguém
 * mexe numa e esquece a outra — e o sintoma seria a tela oferecer entrada num
 * módulo que o guard recusa, ou esconder um que o cliente pagou.
 *
 * As linhas cruas de `TenantModule` são lidas **só para explicar a ausência**.
 * `listModules` responde "abre ou não"; ela não responde "por que não", e a
 * diferença entre "você não contratou" e "seu contrato está suspenso" é a
 * diferença entre falar com o comercial e falar com o financeiro.
 */

export type EstadoDoProduto =
  /** Contratado, vigente, e existe rota para entrar. */
  | "DISPONIVEL"
  /** Sem linha em TenantModule. Default deny — não contratou, não é falha. */
  | "SEM_CONTRATO"
  /** Contratado, mas inadimplente ou cancelado: a porta fecha sem apagar dado. */
  | "SUSPENSO"
  | "CANCELADO"
  /** Venceu por `expiresAt`, mesmo com status que concederia. */
  | "EXPIRADO";

export type ProdutoNoPainel = {
  modulo: ProductModule;
  nome: string;
  resumo: string;
  /** Para onde ir. Nulo quando não há como entrar — a tela não monta link. */
  href: string | null;
  estado: EstadoDoProduto;
  /** Por que não dá para entrar. Nulo quando dá: frase de sucesso é ruído. */
  motivo: string | null;
  /** ISO. Nulo quando não há prazo. */
  expiraEm: string | null;
  emTrial: boolean;
  assentos: number | null;
};

/** Catálogo fixo: nome, resumo e a rota que existe neste app. */
const CATALOGO: Record<
  ProductModule,
  { nome: string; resumo: string; href: string }
> = {
  COSMOS: {
    nome: "Cosmos",
    resumo: "Planejamento e execução SAFe — PI Planning, portfólio, fluxo.",
    href: "/cosmos",
  },
  CHARTER: {
    nome: "Charter",
    resumo: "Governança de IA — políticas, fornecedores, conformidade.",
    href: "/charter",
  },
  SIGNAL: {
    nome: "Signal",
    resumo: "Valor realizado de IA — adoção, ROI com confiança, veredito.",
    href: "/signal",
  },
  MERIDIAN: {
    nome: "Meridian",
    resumo: "Diagnóstico de prontidão para IA — cinco eixos, gaps, plano.",
    href: "/meridian",
  },
  SCAFFOLD: {
    nome: "Scaffold",
    resumo: "Adoção em trilhas guiadas — quatro fases, gates bloqueantes.",
    href: "/scaffold",
  },
};

// Ordem do funil: diagnosticar (Meridian) → adotar (Scaffold) → governar
// (Charter) → operar (Cosmos) → medir (Signal).
const ORDEM: ProductModule[] = [
  "COSMOS",
  "CHARTER",
  "MERIDIAN",
  "SCAFFOLD",
  "SIGNAL",
];

type LinhaDeModulo = {
  status: string;
  expiresAt: Date | null;
  seats: number | null;
};

/** Traduz a ausência de acesso em causa. Só roda quando `listModules` já
 *  decidiu que o módulo não abre. */
function explicarAusencia(linha: LinhaDeModulo | undefined): {
  estado: EstadoDoProduto;
  motivo: string;
} {
  if (!linha) {
    return {
      estado: "SEM_CONTRATO",
      motivo: "Não contratado. Fale com o comercial para incluir no plano.",
    };
  }
  if (linha.status === "SUSPENDED") {
    return {
      estado: "SUSPENSO",
      motivo: "Contrato suspenso. Seus dados seguem intactos.",
    };
  }
  if (linha.status === "CANCELED") {
    return {
      estado: "CANCELADO",
      motivo: "Contrato cancelado. Seus dados seguem intactos.",
    };
  }
  // Status concederia, mas `listModules` recusou: só sobra o prazo. Sem
  // inventar outra causa — se aparecer uma, ela vem como este texto e alguém
  // investiga, em vez de virar "indisponível" genérico.
  return {
    estado: "EXPIRADO",
    motivo: "Contrato vencido. Renove para voltar a acessar.",
  };
}

export async function listarProdutos() {
  return safeAction(async () => {
    const { tenantId } = await requireTenantSession(await headers());

    const [liberados, linhas] = await Promise.all([
      listModules(tenantId),
      database.tenantModule.findMany({
        where: { tenantId },
        select: { module: true, status: true, expiresAt: true, seats: true },
      }),
    ]);

    const porModulo = new Map(linhas.map((l) => [l.module, l]));

    const produtos: ProdutoNoPainel[] = ORDEM.map((modulo) => {
      const { nome, resumo, href } = CATALOGO[modulo];
      const linha = porModulo.get(modulo);
      const abre = liberados.includes(modulo);

      const comum = {
        modulo,
        nome,
        resumo,
        expiraEm: linha?.expiresAt?.toISOString() ?? null,
        emTrial: linha?.status === "TRIAL",
        assentos: linha?.seats ?? null,
      };

      if (!abre) {
        const { estado, motivo } = explicarAusencia(linha);
        return { ...comum, href: null, estado, motivo };
      }

      return {
        ...comum,
        href,
        estado: "DISPONIVEL" as const,
        motivo: null,
      };
    });

    return produtos;
  });
}
