import "server-only";

import {
  AuthError,
  requireTenantSession,
  type TenantContext,
} from "@repo/auth/server";
import type { CharterRole, ProductModule } from "@repo/database";
import {
  type CharterPermission,
  denialReason,
  getCharterRole,
  hasCharterPermission,
  hasModule,
} from "@repo/rbac";
import { headers } from "next/headers";

// Guards do Charter.
//
// A ordem é sempre a mesma e não pode ser invertida:
//   1. requireTenantSession  — quem é e de qual tenant
//   2. requireModule         — o tenant contratou este produto
//   3. requireCharterAccess  — a pessoa tem papel de governança neste tenant
//   4. requireCharterPermission — o papel concede esta ação
//
// Permissão checada sem sessão de tenant válida é vazamento cross-tenant.
// Layout protege navegação; NÃO protege RPC — toda server action repete o
// guard, sem exceção.

export type CharterContext = TenantContext & { charterRole: CharterRole };

/** Erro de regra de governança violada → 422 com a regra nomeada.
 *  Distinto de FORBIDDEN (403, falta permissão) e de conflito de estado (409). */
export class GovernanceError extends Error {
  readonly rule: string;
  readonly status = 422;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "GovernanceError";
    this.rule = rule;
  }
}

/** Conflito de estado → 409. Ex.: publicar versão com seção fora de published. */
export class StateConflictError extends Error {
  readonly rule: string;
  readonly status = 409;
  readonly blockers: string[];

  constructor(rule: string, message: string, blockers: string[] = []) {
    super(message);
    this.name = "StateConflictError";
    this.rule = rule;
    this.blockers = blockers;
  }
}

export async function requireModule(
  productModule: ProductModule,
  ctx: TenantContext
): Promise<void> {
  if (!(await hasModule(ctx.tenantId, productModule))) {
    throw new AuthError(
      "FORBIDDEN",
      `Módulo ${productModule} não contratado por esta organização.`
    );
  }
}

/**
 * Sessão + módulo Charter + papel de governança, numa chamada.
 * Todo entry point do Charter (layout, page, server action) começa por aqui.
 */
export async function requireCharterContext(): Promise<CharterContext> {
  const ctx = await requireTenantSession(await headers());
  await requireModule("CHARTER", ctx);

  const charterRole = await getCharterRole(ctx.userId, ctx.tenantId);
  if (!charterRole) {
    // Deliberadamente não herda de MemberRole.ADMIN: governança que o admin de
    // plataforma contorna não é evidência de auditoria.
    throw new AuthError(
      "FORBIDDEN",
      "Sem papel de governança atribuído no Charter. Peça a um Compliance Lead para atribuir um papel."
    );
  }

  return { ...ctx, charterRole };
}

export function requireCharterPermission(
  permission: CharterPermission,
  ctx: CharterContext
): void {
  if (!hasCharterPermission(ctx.charterRole, permission)) {
    throw new AuthError("FORBIDDEN", denialReason(permission));
  }
}

/** Contexto + permissão, para as actions que exigem uma ação específica. */
export async function requireCharterPermissionContext(
  permission: CharterPermission
): Promise<CharterContext> {
  const ctx = await requireCharterContext();
  requireCharterPermission(permission, ctx);
  return ctx;
}
