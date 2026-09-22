import { z } from "zod";

/**
 * O filtro da Trilha de auditoria, fora da action para servir a dois:
 * `listAuditEvents` (a tela, paginada) e a rota `/audit/exportar` (o CSV,
 * com o filtro inteiro). Dois `where` montados em dois lugares divergem — e
 * o sintoma seria o arquivo baixado trazer eventos que a tela não mostrou.
 *
 * Mora fora de `app/actions/audit.ts` porque um módulo `"use server"` só
 * exporta função async.
 */

export const FiltroSchema = z.object({
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

/** Constrói o `where` a partir do filtro. Separado para poder ser lido de
 *  uma vez — é o pedaço que decide o que a tela mostra de quem. */
export function montarWhere(
  f: z.infer<typeof FiltroSchema>
): Record<string, unknown> {
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

/** O filtro da tela como ele chega na URL (`?tenant=&acao=&entidade=&de=&ate=`).
 *  Os nomes da URL são os da tela, em português; os do schema, os do banco. */
export function filtroDaUrl(params: {
  get: (nome: string) => string | null;
}): z.infer<typeof FiltroSchema> {
  const ler = (nome: string) => params.get(nome) || undefined;
  return FiltroSchema.parse({
    action: ler("acao"),
    ate: ler("ate"),
    de: ler("de"),
    entityType: ler("entidade"),
    tenantId: ler("tenant"),
  });
}

/** O que a trilha lê de cada evento — a tela e o CSV leem o mesmo. */
export const SELECT_EVENTO = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  diff: true,
  metadata: true,
  createdAt: true,
  tenant: { select: { slug: true, name: true } },
} as const;

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

export function paraEventoRow(e: {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  diff: unknown;
  metadata: unknown;
  createdAt: Date;
  tenant: { slug: string; name: string } | null;
}): AuditEventoRow {
  const meta = (e.metadata ?? {}) as { target?: string; actorName?: string };
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
}
