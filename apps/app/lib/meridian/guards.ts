import "server-only";

import {
  AuthError,
  requireTenantSession,
  type TenantContext,
} from "@repo/auth/server";
import type { MeridianRole, ProductModule } from "@repo/database";
import {
  getMeridianRole,
  hasMeridianPermission,
  hasModule,
  type MeridianPermission,
  meridianDenialReason,
} from "@repo/rbac";
import { headers } from "next/headers";

// Guards do Meridian.
//
// A ordem é sempre a mesma e não pode ser invertida:
//   1. requireTenantSession    — quem é e de qual tenant
//   2. requireModule           — o tenant contratou este produto
//   3. requireMeridianContext  — a pessoa tem papel de diagnóstico neste tenant
//   4. requireMeridianPermission — o papel concede esta ação
//
// Permissão checada sem sessão de tenant válida é vazamento cross-tenant.
// Layout protege navegação; NÃO protege RPC — toda server action repete o
// guard, sem exceção.
//
// A única porta que não passa por aqui é a do respondente, que não tem conta:
// ela resolve o tenant a partir do token (lib/meridian/respondent-token.ts) e
// nunca a partir do request.

export type MeridianContext = TenantContext & { meridianRole: MeridianRole };

/** Regra de domínio violada → 422 com a regra nomeada. Distinto de FORBIDDEN
 *  (403, falta permissão) e de conflito de estado (409, transição inválida). */
export class MeridianRuleError extends Error {
  readonly rule: string;
  readonly status = 422;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "MeridianRuleError";
    this.rule = rule;
  }
}

/** Conflito de estado → 409. Ex.: fechar coleta com eixo sem respondente.
 *  `blockers` carrega o que precisa ser resolvido, para a UI listar em vez de
 *  mandar a pessoa procurar. */
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
 * Sessão + módulo Meridian + papel de diagnóstico, numa chamada.
 * Todo entry point do Meridian (layout, page, server action) começa por aqui.
 */
export async function requireMeridianContext(): Promise<MeridianContext> {
  const ctx = await requireTenantSession(await headers());
  await requireModule("MERIDIAN", ctx);

  const meridianRole = await getMeridianRole(ctx.userId, ctx.tenantId);
  if (!meridianRole) {
    // Deliberadamente não herda de MemberRole.ADMIN: um admin de plataforma que
    // contorna o papel de consultor invalida a trilha do override.
    throw new AuthError(
      "FORBIDDEN",
      "Sem papel de diagnóstico atribuído no Meridian. Peça a um consultor para atribuir um papel."
    );
  }

  return { ...ctx, meridianRole };
}

export function requireMeridianPermission(
  permission: MeridianPermission,
  ctx: MeridianContext
): void {
  if (!hasMeridianPermission(ctx.meridianRole, permission)) {
    throw new AuthError("FORBIDDEN", meridianDenialReason(permission));
  }
}

/** Contexto + permissão, para as actions que exigem uma ação específica. */
export async function requireMeridianPermissionContext(
  permission: MeridianPermission
): Promise<MeridianContext> {
  const ctx = await requireMeridianContext();
  requireMeridianPermission(permission, ctx);
  return ctx;
}
