"use server";

import { database } from "@repo/database";
import {
  type AuditEventoRow,
  type FiltroAudit,
  FiltroSchema,
  montarWhere,
  paraEventoRow,
  SELECT_EVENTO,
} from "@/lib/audit-filtro";
import { requirePlatformStaff } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Audit Explorer (FR-10.3): busca e filtro sobre o AuditLog de TODOS os
 * tenants ao mesmo tempo.
 *
 * A diferença para a aba Auditoria do detalhe do cliente é o escopo: lá o
 * `tenantId` é fixo, aqui ele é filtro. Isto é a única tela do painel que lê
 * dado de vários clientes de uma vez, e é por isso que o `where` daqui merece
 * teste próprio — montá-lo errado não quebra nada visível, só mostra demais.
 *
 * Leitura pura: sem `assertCanWrite`, porque ler é de todo staff (FR-0.4).
 * Auditoria também não tem escrita — o log é append-only por quem o gera.
 */

/** Teto de página. O AuditLog cresce sem parar; sem limite a tela fica lenta
 *  em silêncio, e o primeiro a perceber é produção. */
const MAX_POR_PAGINA = 200;
const PADRAO_POR_PAGINA = 50;

// Os tipos moram com o filtro (`lib/audit-filtro.ts`), que a rota de
// exportação também usa; quem já os importava daqui continua importando.
export type { AuditEventoRow, FiltroAudit } from "@/lib/audit-filtro";

export type PaginaDeAudit = {
  eventos: AuditEventoRow[];
  total: number;
  pagina: number;
  porPagina: number;
};

export async function listAuditEvents(
  filtro: FiltroAudit
): Promise<Result<PaginaDeAudit>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const f = FiltroSchema.parse(filtro);
    const pagina = f.pagina ?? 1;
    const porPagina = Math.min(
      f.porPagina ?? PADRAO_POR_PAGINA,
      MAX_POR_PAGINA
    );
    const where = montarWhere(f);

    // Contagem e página na mesma ida: a paginação precisa do total para saber
    // quantas páginas existem, e pedir depois duplicaria a latência.
    const [eventos, total] = await Promise.all([
      database.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: SELECT_EVENTO,
      }),
      database.auditLog.count({ where }),
    ]);

    return {
      total,
      pagina,
      porPagina,
      eventos: eventos.map(paraEventoRow),
    };
  });
}

export type TenantOpcao = { id: string; slug: string; name: string };

/** Tenants para o seletor de filtro. */
export async function listAuditTenants(): Promise<Result<TenantOpcao[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    // `isSystem: false` — o tenant interno não é cliente, e deixá-lo no
    // seletor faria o operador filtrar por algo que não é uma empresa.
    return await database.tenant.findMany({
      where: { isSystem: false },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true },
    });
  });
}
