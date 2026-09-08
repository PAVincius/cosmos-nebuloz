/** Argumentos de consulta das telas de cliente.
 *
 *  Moram fora de `app/actions/clients.ts` porque um módulo `"use server"` só
 *  pode exportar função async — exportar estas daqui de dentro quebra o build
 *  inteiro do app, não só a action.
 */

/** Separado da action para poder ser testado sem banco: o filtro `isSystem`
 *  é a regra que não pode ser esquecida em nenhuma listagem. */
export function clientListArgs() {
  return {
    where: { isSystem: false },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      plan: true,
      modules: {
        select: { module: true, status: true, expiresAt: true },
        orderBy: { module: "asc" as const },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" as const },
  };
}

/** Separado da action pelo mesmo motivo do `clientListArgs`: o filtro
 *  `isSystem` precisa ser testável sem banco. Slug do tenant interno não abre
 *  tela de cliente. */
export function clientDetailArgs(slug: string) {
  return {
    where: { slug, isSystem: false },
    select: {
      ...clientListArgs().select,
      members: {
        select: {
          role: true,
          user: { select: { name: true, email: true } },
        },
      },
      charterMemberships: { select: { role: true } },
      charterPolicies: { select: { id: true }, take: 1 },
      meridianMemberships: { select: { role: true } },
      meridianTemplates: { select: { id: true }, take: 1 },
    },
  };
}
