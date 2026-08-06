"use server";

import { database } from "@repo/database";
import { z } from "zod";
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

const FiltroSchema = z.object({
  /** Ausente = todos os tenants. É o ponto da tela. */
  tenantId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  /** ISO curto, "2026-08-01". */
  de: z.string().optional(),
  ate: z.string().optional(),
  pagina: z.number().int().min(1).optional(),
  porPagina: z.number().int().min(1).optional(),
});

export type FiltroAudit = z.input<typeof FiltroSchema>;

export type AuditEventoRow = {
  id: string;
  tenantSlug: string;
  tenantNome: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  alvo: string | null;
  ator: string | null;
  quando: string;
  diff: unknown;
  semDiff: boolean;
};

export type PaginaDeAudit = {
  eventos: AuditEventoRow[];
  total: number;
  pagina: number;
  porPagina: number;
};

/** Constrói o `where` a partir do filtro. Fora da action para poder ser lido
 *  de uma vez — é o pedaço que decide o que a tela mostra de quem. */
function montarWhere(f: z.infer<typeof FiltroSchema>) {
  const where: Record<string, unknown> = {};

  // Só entra no where quando escolhido. Ausente significa "todos", e forçar
  // um valor aqui transformaria a tela cross-tenant numa tela de um tenant só.
  if (f.tenantId) {
    where.tenantId = f.tenantId;
  }
  if (f.action) {
    where.action = f.action;
  }
  if (f.entityType) {
    where.entityType = f.entityType;
  }

  if (f.de || f.ate) {
    const periodo: { gte?: Date; lte?: Date } = {};
    if (f.de) {
      periodo.gte = new Date(f.de);
    }
    if (f.ate) {
      // Fim do dia, não meia-noite: filtrar "até 05/08" e perder o que
      // aconteceu às 14h do dia 5 é um corte que ninguém percebe até
      // procurar um evento que existe e não aparecer.
      const fim = new Date(f.ate);
      fim.setHours(23, 59, 59, 999);
      periodo.lte = fim;
    }
    where.createdAt = periodo;
  }

  return where;
}

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
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          diff: true,
          metadata: true,
          createdAt: true,
          tenant: { select: { slug: true, name: true } },
        },
      }),
      database.auditLog.count({ where }),
    ]);

    return {
      total,
      pagina,
      porPagina,
      eventos: eventos.map((e) => {
        const meta = (e.metadata ?? {}) as {
          target?: string;
          actorName?: string;
        };
        return {
          id: e.id,
          tenantSlug: e.tenant?.slug ?? "—",
          tenantNome: e.tenant?.name ?? "—",
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          alvo: meta.target ?? null,
          ator: meta.actorName ?? null,
          quando: e.createdAt.toISOString(),
          diff: e.diff ?? null,
          // Afirmação, não ausência silenciosa — mesma regra da aba do cliente.
          semDiff: e.diff === null || e.diff === undefined,
        };
      }),
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
