"use server";

// settings-security.ts — Segurança / SSO tab (Settings screen, tab 3).
//
// SECURITY: TenantSSOConfig.idpMetadataUrl/idpEntityId/idpCertificate are
// NEVER selected here for display — only `enabled` and `updatedAt`, same
// discipline as the existing getWorkspaceSettings in settings.ts. The
// mature app/actions/settings/sso.ts::getSSOConfig DOES select those
// fields (it backs a real SSO config editor elsewhere), so it is
// deliberately NOT used for the read path in this tab.
//
// The toggle write reuses the real ADMIN-gated saveSSOConfig — but that
// action's upsert unconditionally overwrites idpMetadataUrl/idpEntityId/
// idpCertificate/spEntityId with whatever it's given (`input.x || null`),
// so calling it with only `{ enabled }` would silently wipe a configured
// IdP. toggleSsoEnabled reads the current sensitive values server-side
// (inside this "use server" module only, never returned to the caller)
// purely to round-trip them back through saveSSOConfig unchanged.
//
// The security policy (2FA / grace period / IP allowlist) is a separate,
// non-sensitive, already-ADMIN-gated real settings surface
// (admin-settings.ts::upsertSecurityPolicy existed with no matching
// reader — this adds the read).
import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";
import { upsertSecurityPolicy } from "../../actions/settings/admin-settings";
import { saveSSOConfig } from "../../actions/settings/sso";

export type SecurityTabView = {
  ssoEnabled: boolean;
  /** Existe algum dado de IdP gravado. Booleano derivado por uma consulta que
   *  testa "não nulo" no `where` e devolve só o `tenantId` — nenhum campo
   *  sensível é selecionado, nem aqui nem na leitura de status. A tela precisa
   *  disto para não oferecer um botão de ativar que o servidor vai recusar. */
  ssoConfigured: boolean;
  ssoUpdatedAt: string | null;
  securityPolicy: {
    require2FA: boolean;
    gracePeriodDays: number;
    allowedIpRanges: string[];
  } | null;
  currentUserRole: string;
};

export async function getSecurityTab(): Promise<Result<SecurityTabView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const [sso, configured, policy] = await Promise.all([
      // SECURITY: select only enabled/updatedAt — never idp*/certificate fields.
      database.tenantSSOConfig.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { enabled: true, updatedAt: true },
      }),
      // SECURITY: o teste de "existe IdP" mora no `where`; o `select` devolve
      // só o tenantId, então nenhum valor de certificado/metadata entra em
      // variável nesta leitura.
      database.tenantSSOConfig.findFirst({
        where: {
          tenantId: ctx.tenantId,
          OR: [
            { idpMetadataUrl: { not: null } },
            { idpEntityId: { not: null } },
            { idpCertificate: { not: null } },
          ],
        },
        select: { tenantId: true },
      }),
      database.tenantSecurityPolicy.findUnique({
        where: { tenantId: ctx.tenantId },
        select: {
          require2FA: true,
          gracePeriodDays: true,
          allowedIpRanges: true,
        },
      }),
    ]);

    return {
      ssoEnabled: sso?.enabled ?? false,
      ssoConfigured: configured !== null,
      ssoUpdatedAt: sso?.updatedAt?.toISOString() ?? null,
      securityPolicy: policy,
      currentUserRole: ctx.role,
    };
  });
}

export async function toggleSsoEnabled(
  enabled: boolean
): Promise<Result<{ enabled: boolean }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    // Read current sensitive values server-side only, to round-trip them
    // unchanged through saveSSOConfig (see file header) — never returned.
    const current = await database.tenantSSOConfig.findUnique({
      where: { tenantId: ctx.tenantId },
      select: {
        idpMetadataUrl: true,
        idpEntityId: true,
        idpCertificate: true,
        spEntityId: true,
      },
    });

    // PRD UC-18 (docs/PRD-v1.0.md:1974): o SSO só é habilitado depois que os
    // metadados/certificado do IdP existem — e o E-2 diz que teste falho não
    // habilita. Este toggle, por construção, não recebe metadado nenhum; se
    // não houver IdP gravado, ligar publicaria um caminho de login incapaz de
    // autenticar qualquer pessoa. Desligar nunca é bloqueado: um tenant tem
    // que poder derrubar um SSO quebrado, e um guard simétrico aqui trancaria
    // todo mundo do lado de fora.
    if (
      enabled &&
      !(
        current?.idpMetadataUrl ||
        current?.idpEntityId ||
        current?.idpCertificate
      )
    ) {
      throw new Error(
        "SSO não pode ser ativado sem um provedor de identidade configurado (entity ID, metadata URL ou certificado). Configure o IdP antes de ativar."
      );
    }

    const res = await saveSSOConfig({
      enabled,
      idpMetadataUrl: current?.idpMetadataUrl ?? null,
      idpEntityId: current?.idpEntityId ?? null,
      idpCertificate: current?.idpCertificate ?? null,
      spEntityId: current?.spEntityId ?? null,
    });
    if (!res.ok) {
      throw new Error(res.error);
    }
    return { enabled: res.data.enabled };
  });
}

export type SecurityPolicyInput = {
  require2FA?: boolean;
  gracePeriodDays?: number;
  allowedIpRanges?: string[];
};

export async function saveSecurityPolicyAction(
  input: SecurityPolicyInput
): Promise<Result<{ updated: true }>> {
  return safeAction(async () => {
    await upsertSecurityPolicy(input);
    return { updated: true as const };
  });
}
