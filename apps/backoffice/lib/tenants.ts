import "server-only";
import { database } from "@repo/database";
import { StaffAuthError } from "./guard";

/** Busca de tenant por slug, compartilhada pelas abas do detalhe do cliente.
 *
 *  Mora aqui, e não em `lib/client-queries.ts`, porque aquele módulo é livre de
 *  banco de propósito — os testes o importam direto para checar o filtro
 *  `isSystem` sem subir Postgres, e um `import { database }` lá derruba os dois.
 *
 *  Mora fora das actions porque um módulo `"use server"` só pode exportar
 *  função async, e porque a cópia era literal: `tenant-members.ts` e
 *  `tenant-observability.ts` traziam corpos idênticos byte a byte. Divergir
 *  custa caro justo aqui — no dia em que esta busca precisar filtrar
 *  `isSystem: false`, a correção tem que valer para as duas telas.
 */
export async function tenantPorSlug(slug: string) {
  const tenant = await database.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) {
    throw new StaffAuthError("FORBIDDEN", `Nenhum cliente com o slug ${slug}.`);
  }
  return tenant;
}
