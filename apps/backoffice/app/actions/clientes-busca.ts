"use server";

import { platformDb } from "@repo/provisioning";
import { z } from "zod";
import { requirePlatformStaff } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/** O que a paleta precisa para levar ao detalhe: o nome para achar, o slug
 *  para a rota. */
export type ClienteAchado = { name: string; slug: string };

/** A paleta mostra poucos — quem precisa de mais tem a carteira com busca. */
const TETO_DA_PALETA = 8;

const TERMO = z
  .string()
  .trim()
  .min(2, "Digite ao menos 2 letras para buscar cliente.")
  .max(80, "Busca longa demais.");

/**
 * Busca de clientes da paleta de salto (Ctrl/⌘+K), por nome ou slug.
 *
 * Só leitura, e própria em vez de reusar `listClients`: aquela traz a
 * carteira inteira com módulos e contagem de membros, e a paleta pergunta a
 * cada pausa na digitação — aqui vão dois campos e um teto. O tenant interno
 * fica de fora pelo mesmo filtro da carteira: ele não é cliente.
 */
export async function buscarClientes(
  termo: string
): Promise<Result<ClienteAchado[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const busca = TERMO.parse(termo);

    return await platformDb.tenant.findMany({
      where: {
        isSystem: false,
        OR: [
          { name: { contains: busca, mode: "insensitive" } },
          { slug: { contains: busca.toLowerCase() } },
        ],
      },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
      take: TETO_DA_PALETA,
    });
  });
}
