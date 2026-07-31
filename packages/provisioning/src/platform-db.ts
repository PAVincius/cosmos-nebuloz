import "server-only";
import { database } from "@repo/database";

/**
 * A porta única de acesso cross-tenant.
 *
 * Todo o produto lê e escreve por `withTenantDb(tenantId)`, que seta
 * `app.tenant_id` e filtra. O back-office é a primeira superfície que
 * legitimamente precisa enxergar através dos tenants — e isso não pode virar
 * um padrão difuso espalhado pelo código.
 *
 * Regras (ver ADR-0013):
 *   1. só `packages/provisioning` e `apps/backoffice` importam daqui;
 *   2. toda listagem de cliente filtra `isSystem: false`;
 *   3. escrita em tabela do Charter continua indo por `withTenantDb` — a RLS
 *      está FORCE e recusa INSERT sem contexto de tenant.
 */
export const platformDb = database;
