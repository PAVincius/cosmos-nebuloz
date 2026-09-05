import "server-only";

import {
  AuthError,
  requireTenantSession,
  type TenantContext,
} from "@repo/auth/server";
import type { ProductModule, ScaffoldRole } from "@repo/database";
import {
  getScaffoldRole,
  hasModule,
  hasScaffoldPermission,
  type ScaffoldPermission,
  scaffoldDenialReason,
} from "@repo/rbac";
import { headers } from "next/headers";

// Guards do Scaffold.
//
// A ordem é sempre a mesma e não pode ser invertida:
//   1. requireTenantSession      — quem é e de qual tenant
//   2. requireModule             — o tenant contratou este produto
//   3. requireScaffoldContext    — a pessoa tem papel de adoção neste tenant
//   4. requireScaffoldPermission — o papel concede esta ação
//
// Permissão checada sem sessão de tenant válida é vazamento cross-tenant.
// Layout protege navegação; NÃO protege RPC — toda server action repete o
// guard, sem exceção.
//
// A fila de supervisão da consultora NÃO passa por aqui: ela é cross-tenant e
// vive em `apps/backoffice` via `platformDb`, porque a ADR-0013 proíbe
// `apps/app` de importar aquela porta. Ver `specs/002-scaffold-adoption/research.md` §R4.

export type ScaffoldContext = TenantContext & { scaffoldRole: ScaffoldRole };

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
 * Sessão + módulo Scaffold + papel de adoção, numa chamada.
 * Todo entry point do Scaffold (layout, page, server action) começa por aqui.
 */
export async function requireScaffoldContext(): Promise<ScaffoldContext> {
  const ctx = await requireTenantSession(await headers());
  await requireModule("SCAFFOLD", ctx);

  const scaffoldRole = await getScaffoldRole(ctx.userId, ctx.tenantId);
  if (!scaffoldRole) {
    // Deliberadamente não herda de MemberRole.ADMIN: um admin de plataforma que
    // fecha um gate sem papel nomeado invalida a trilha do override, e o
    // override atribuído é o que faz o gate valer alguma coisa.
    throw new AuthError(
      "FORBIDDEN",
      "Sem papel de adoção atribuído no Scaffold. Peça a um consultor para atribuir um papel."
    );
  }

  return { ...ctx, scaffoldRole };
}

export function requireScaffoldPermission(
  permission: ScaffoldPermission,
  ctx: ScaffoldContext
): void {
  if (!hasScaffoldPermission(ctx.scaffoldRole, permission)) {
    throw new AuthError("FORBIDDEN", scaffoldDenialReason(permission));
  }
}

/** Contexto + permissão, para as actions que exigem uma ação específica. */
export async function requireScaffoldPermissionContext(
  permission: ScaffoldPermission
): Promise<ScaffoldContext> {
  const ctx = await requireScaffoldContext();
  requireScaffoldPermission(permission, ctx);
  return ctx;
}
