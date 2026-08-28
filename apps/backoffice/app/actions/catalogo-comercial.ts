"use server";

import { database } from "@repo/database";
import { requirePlatformStaff, SYSTEM_TENANT_ID } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Leitura do catálogo comercial — o que a Nebuloz cobra e quanto.
 *
 * Uma chamada só devolve as quatro tabelas porque o gerador precisa das quatro
 * ao mesmo tempo para desenhar a primeira tela: sem plano não há preço de
 * assento, sem termo não há desconto de prazo, e um preview que aparece em
 * pedaços é pior do que um que demora um instante a mais.
 */

export type PlanoRow = {
  slug: string;
  nome: string;
  precoAssentoCentavos: number;
  minimoAssentos: number;
  limiteUsuarios: number | null;
  permiteRolesCustom: boolean;
};

export type PrecoModuloRow = {
  modulo: string;
  precoMensalCentavos: number;
};

export type TermoRow = {
  slug: string;
  nome: string;
  meses: number;
  descontoPercent: number;
};

export type AddOnRow = {
  slug: string;
  nome: string;
  nota: string | null;
  precoCentavos: number;
  recorrente: boolean;
  exigeRolesCustom: boolean;
};

export type CatalogoComercial = {
  planos: PlanoRow[];
  modulos: PrecoModuloRow[];
  termos: TermoRow[];
  addOns: AddOnRow[];
};

export async function listarCatalogoComercial(): Promise<
  Result<CatalogoComercial>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const where = { tenantId: SYSTEM_TENANT_ID };

    // Planos e add-ons filtram por `ativo`: aqui é a lista de escolha de quem
    // monta proposta, não a tela de gestão do catálogo. Vender um plano que
    // saiu de linha é pior do que não vê-lo.
    const [planos, modulos, termos, addOns] = await Promise.all([
      database.planoComercial.findMany({
        where: { ...where, ativo: true },
        orderBy: { ordem: "asc" },
        select: {
          slug: true,
          nome: true,
          precoAssentoCentavos: true,
          minimoAssentos: true,
          limiteUsuarios: true,
          permiteRolesCustom: true,
        },
      }),
      database.precoDeModulo.findMany({
        where,
        select: { modulo: true, precoMensalCentavos: true },
      }),
      database.termoDeContrato.findMany({
        where,
        orderBy: { ordem: "asc" },
        select: {
          slug: true,
          nome: true,
          meses: true,
          descontoPercent: true,
        },
      }),
      database.addOnComercial.findMany({
        where: { ...where, ativo: true },
        orderBy: { ordem: "asc" },
        select: {
          slug: true,
          nome: true,
          nota: true,
          precoCentavos: true,
          recorrente: true,
          exigeRolesCustom: true,
        },
      }),
    ]);

    return {
      planos,
      modulos: modulos.map((m) => ({
        modulo: String(m.modulo),
        precoMensalCentavos: m.precoMensalCentavos,
      })),
      termos,
      addOns,
    };
  });
}
