import "server-only";

import {
  AuthError,
  requireTenantSession,
  type TenantContext,
} from "@repo/auth/server";
import type { ProductModule, SignalRole } from "@repo/database";
import {
  getSignalRole,
  hasModule,
  hasSignalPermission,
  ownsOrOutranksInitiative,
  type SignalPermission,
  signalDenialReason,
} from "@repo/rbac";
import { headers } from "next/headers";

// Guards do Signal.
//
// A ordem é sempre a mesma e não pode ser invertida:
//   1. requireTenantSession      — quem é e de qual tenant
//   2. requireModule             — o tenant contratou este produto
//   3. requireSignalContext      — a pessoa tem papel de medição neste tenant
//   4. requireSignalPermission   — o papel concede esta ação
//   5. requireInitiativeOwnership— (quando a ação é sobre uma iniciativa
//                                  específica) o papel alcança AQUELA linha
//
// Permissão checada sem sessão de tenant válida é vazamento cross-tenant.
// Layout protege navegação; NÃO protege RPC — toda server action repete o
// guard, sem exceção.
//
// O switcher de persona da casca NÃO passa por aqui e não deveria: ele é lente
// de leitura (o que aparece primeiro), não autorização. Trocar de persona nunca
// revela dado novo.

export type SignalContext = TenantContext & { signalRole: SignalRole };

// As classes de erro de domínio vivem em `./errors`, sem imports, para que quem
// só precisa do `instanceof` não arraste a cadeia do auth junto. Importe-as de
// lá, não daqui: um reexport neste arquivo transformaria os guards num barril e
// devolveria o problema pela porta dos fundos.

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
 * Sessão + módulo Signal + papel de medição, numa chamada.
 * Todo entry point do Signal (layout, page, server action) começa por aqui.
 */
export async function requireSignalContext(): Promise<SignalContext> {
  const ctx = await requireTenantSession(await headers());
  await requireModule("SIGNAL", ctx);

  const signalRole = await getSignalRole(ctx.userId, ctx.tenantId);
  if (!signalRole) {
    // Deliberadamente não herda de MemberRole.ADMIN: quem versiona uma fórmula
    // de ROI precisa ser nomeável, e um admin de plataforma que contorna o
    // papel invalida a trilha.
    throw new AuthError(
      "FORBIDDEN",
      "Sem papel de medição atribuído no Signal. Peça a um administrador do Signal para atribuir um papel."
    );
  }

  return { ...ctx, signalRole };
}

export function requireSignalPermission(
  permission: SignalPermission,
  ctx: SignalContext
): void {
  if (!hasSignalPermission(ctx.signalRole, permission)) {
    throw new AuthError(
      "FORBIDDEN",
      signalDenialReason(ctx.signalRole, permission) ??
        "Ação não permitida no Signal."
    );
  }
}

/** Contexto + permissão, para as actions que exigem uma ação específica. */
export async function requireSignalPermissionContext(
  permission: SignalPermission
): Promise<SignalContext> {
  const ctx = await requireSignalContext();
  requireSignalPermission(permission, ctx);
  return ctx;
}

/**
 * O quinto portão: OWNER escreve só nas próprias iniciativas.
 *
 * Fica separado dos outros porque depende da LINHA, não do papel — e por isso
 * só pode ser checado depois de a iniciativa ser carregada. Chamar
 * `requireSignalPermission` e parar por aí deixaria um OWNER editar a
 * iniciativa de qualquer colega.
 */
export function requireInitiativeOwnership(
  ctx: SignalContext,
  initiative: { ownerId: string; code: string }
): void {
  if (
    !ownsOrOutranksInitiative(ctx.signalRole, ctx.userId, initiative.ownerId)
  ) {
    throw new AuthError(
      "FORBIDDEN",
      `A iniciativa ${initiative.code} é de outra pessoa. Seu papel (Dono de iniciativa) alcança só as próprias — peça a um Analista ou Administrador.`
    );
  }
}
